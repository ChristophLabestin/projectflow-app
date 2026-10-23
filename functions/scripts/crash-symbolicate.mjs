#!/usr/bin/env node
// Symbolicates stored crash events (crashIssues/*/crashEvents, functions/src/crash-reports.ts) on the Mac:
//   iOS: image + address → function/file/line with `xcrun atos`, binary found by UUID (Spotlight index of the
//        Xcode archives, then --binary-dir / ~/Library/Developer/Xcode/Archives via `dwarfdump --uuid`).
//   web: bundle path + line/column → original source with the maps the production build stashed in
//        PF_SOURCEMAP_DIR (default ~/Library/Application Support/ProjectFlow/sourcemaps/<release>/).
// Writes `symbolicatedFrames` + `symbolicated: true` on the event and `symbolicatedCulprit` on the issue.
// Events whose binaries/maps are missing stay unsymbolicated and are retried on the next run.
//
// Usage: node scripts/crash-symbolicate.mjs [--issue <id>] [--binary-dir <dir>] [--limit 200] [--dry-run]
// Production uses application default credentials (gcloud auth application-default login);
// with FIRESTORE_EMULATOR_HOST set it talks to the emulator (project demo-projectflow).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const { SourceMapConsumer } = createRequire(new URL('../../web/package.json', import.meta.url))('source-map-js');

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const dryRun = args.includes('--dry-run');
const issueFilter = option('--issue');
const binaryDirs = [option('--binary-dir'), path.join(os.homedir(), 'Library/Developer/Xcode/Archives')].filter(Boolean);
const limit = Number(option('--limit', 200));
const sourcemapDir = process.env.PF_SOURCEMAP_DIR || path.join(os.homedir(), 'Library/Application Support/ProjectFlow/sourcemaps');

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.GCLOUD_PROJECT || (emulator ? 'demo-projectflow' : 'projectflow-labestin');
admin.initializeApp(emulator ? { projectId } : { projectId, credential: admin.credential.applicationDefault() });
const db = admin.firestore();

// ---- iOS ---------------------------------------------------------------------------------------------------------

const run = (cmd, cmdArgs) => { try { return execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return ''; } };

let uuidIndex = null; // UUID → Mach-O path, built lazily from the binary dirs
const indexBinaries = () => {
    uuidIndex = new Map();
    const candidates = [];
    const walk = (dir, depth) => {
        if (depth > 8 || !fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.name.endsWith('.dSYM')) { candidates.push(full); continue; }
            if (entry.isDirectory()) walk(full, depth + 1);
            else if (/\.(dylib)$/.test(entry.name) || (!entry.name.includes('.') && dir.endsWith('.app'))) candidates.push(full);
        }
    };
    binaryDirs.forEach((dir) => walk(dir, 0));
    for (const candidate of candidates) {
        for (const line of run('xcrun', ['dwarfdump', '--uuid', candidate]).split('\n')) {
            const match = /^UUID: ([0-9A-F-]{36}) \((\w+)\) (.+)$/.exec(line.trim());
            if (match) uuidIndex.set(match[1], match[3]);
        }
    }
};

const binaryFor = (uuid) => {
    const spotlight = run('mdfind', [`com_apple_xcode_dsym_uuids == ${uuid}`]).split('\n').find(Boolean);
    if (spotlight) {
        const dwarf = path.join(spotlight, 'Contents/Resources/DWARF');
        const file = fs.existsSync(dwarf) ? fs.readdirSync(dwarf)[0] : null;
        if (file) return path.join(dwarf, file);
    }
    if (!uuidIndex) indexBinaries();
    return uuidIndex.get(uuid) ?? null;
};

const parseAtos = (line) => {
    // "function (in Image) (File.swift:12)" or "function (in Image) + 40"; unresolved lines echo the address.
    const match = /^(.*?) \(in ([^)]+)\)(?: \((.+?):(\d+)\))?/.exec(line);
    if (!match) return null;
    return { function: match[1], image: match[2], ...(match[3] ? { file: match[3], line: Number(match[4]) } : {}) };
};

const symbolicateIos = (event) => {
    const images = new Map((event.images ?? []).map((image) => [image.uuid, image]));
    const resolved = event.frames.map((frame) => ({ ...frame }));
    const byUuid = new Map();
    resolved.forEach((frame, index) => {
        if (!frame.uuid || !images.has(frame.uuid) || !frame.address) return;
        if (!byUuid.has(frame.uuid)) byUuid.set(frame.uuid, []);
        byUuid.get(frame.uuid).push(index);
    });
    let hits = 0;
    for (const [uuid, indexes] of byUuid) {
        const binary = binaryFor(uuid);
        if (!binary) continue;
        const image = images.get(uuid);
        const output = run('xcrun', ['atos', '-arch', image.arch || 'arm64', '-o', binary, '-l', image.loadAddress,
            ...indexes.map((i) => resolved[i].address)]).trim().split('\n');
        indexes.forEach((frameIndex, i) => {
            const parsed = output[i] && parseAtos(output[i]);
            if (parsed) { Object.assign(resolved[frameIndex], parsed); hits += 1; }
        });
    }
    return hits ? resolved : null;
};

// ---- web ---------------------------------------------------------------------------------------------------------

const consumers = new Map();
const consumerFor = (release, file) => {
    const mapPath = path.join(sourcemapDir, release.replace(/:/g, '-'), `${file.replace(/^\//, '')}.map`);
    if (!consumers.has(mapPath)) {
        consumers.set(mapPath, fs.existsSync(mapPath) ? new SourceMapConsumer(JSON.parse(fs.readFileSync(mapPath, 'utf8'))) : null);
    }
    return consumers.get(mapPath);
};

const symbolicateWeb = (event) => {
    let hits = 0;
    const resolved = event.frames.map((frame) => {
        if (!frame.file || !frame.line || !frame.column) return frame;
        const consumer = consumerFor(event.release, frame.file);
        if (!consumer) return frame;
        const original = consumer.originalPositionFor({ line: frame.line, column: frame.column - 1 });
        if (!original.source) return frame;
        hits += 1;
        const source = original.source.replace(/^(\.\.\/)+/, '').replace(/^webpack:\/\/\//, '');
        return {
            function: original.name || frame.function, file: source, line: original.line, column: (original.column ?? 0) + 1,
            inApp: !source.includes('node_modules'),
        };
    });
    return hits ? resolved : null;
};

// ---- main --------------------------------------------------------------------------------------------------------

const culprit = (frames) => {
    const frame = frames.find((f) => f.inApp !== false && f.function) ?? frames.find((f) => f.function);
    if (!frame) return null;
    return frame.file ? `${frame.function} · ${path.basename(frame.file)}${frame.line ? `:${frame.line}` : ''}` : frame.function;
};

let queryRef = issueFilter
    ? db.collection('crashIssues').doc(issueFilter).collection('crashEvents').where('symbolicated', '==', false)
    : db.collectionGroup('crashEvents').where('symbolicated', '==', false);
const snapshot = await queryRef.limit(limit).get();
let done = 0;
let missing = 0;
for (const doc of snapshot.docs) {
    const event = doc.data();
    const frames = event.platform === 'ios' ? symbolicateIos(event) : symbolicateWeb(event);
    if (!frames) { missing += 1; console.log(`- ${doc.ref.path}: no ${event.platform === 'ios' ? 'binary/dSYM' : 'source map'} for ${event.release}`); continue; }
    const top = culprit(frames);
    console.log(`✓ ${doc.ref.path}: ${top ?? '(no symbol)'}`);
    done += 1;
    if (dryRun) continue;
    await doc.ref.update({ symbolicatedFrames: frames, symbolicated: true, symbolicatedAt: admin.firestore.FieldValue.serverTimestamp() });
    if (top) await doc.ref.parent.parent.update({ symbolicatedCulprit: top });
}
console.log(`${done} symbolicated, ${missing} without symbols, ${snapshot.size} checked${dryRun ? ' (dry run)' : ''}.`);
