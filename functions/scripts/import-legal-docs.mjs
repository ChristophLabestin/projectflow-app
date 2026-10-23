#!/usr/bin/env node
// Imports legal Markdown files into the versioned legal documents system.
//
//   node scripts/import-legal-docs.mjs <dir>                    # files → admin drafts (review + publish in /admin/legal)
//   node scripts/import-legal-docs.mjs <dir> --publish-initial  # seed version 1 where no version exists (no mails)
//
// Files: <dir>/<type>.<lang>.md with type = privacy|terms|imprint, lang = de|en (both languages
// required per type; missing types are skipped). Optional change summary: <dir>/<type>.summary.<lang>.md.
// The first "# " heading becomes the title. Repo layout: legal/v1 (initial texts), legal/ (next version).
// Uses application default credentials (gcloud auth application-default login); set
// FIRESTORE_EMULATOR_HOST to target an emulator. Project: GCLOUD_PROJECT or projectflow-labestin.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const TYPES = ['privacy', 'terms', 'imprint'];
const LANGS = ['de', 'en'];
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
const args = process.argv.slice(2);
const dir = args.find((arg) => !arg.startsWith('--'));
const publishInitial = args.includes('--publish-initial');

if (!dir) {
    console.error('Usage: node scripts/import-legal-docs.mjs <dir> [--publish-initial]');
    process.exit(1);
}

admin.initializeApp(process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId: PROJECT_ID }
    : { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const { Timestamp } = admin.firestore;

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null);
const splitTitle = (markdown) => {
    const match = /^#\s+(.+)\n+/.exec(markdown);
    return match ? { title: match[1].trim(), content: markdown.slice(match[0].length).trim() } : { title: '', content: markdown };
};
const INITIAL_SUMMARY = {
    de: 'Erste Fassung im neuen Versionssystem. Bitte bestätigen Sie die geltende Fassung.',
    en: 'First version in the new versioning system. Please confirm the current version.',
};

for (const type of TYPES) {
    const parts = {};
    for (const lang of LANGS) {
        const raw = read(path.join(dir, `${type}.${lang}.md`));
        if (raw) parts[lang] = splitTitle(raw);
    }
    if (!parts.de || !parts.en) {
        console.log(`skip ${type}: needs ${type}.de.md and ${type}.en.md`);
        continue;
    }
    const title = { de: parts.de.title || type, en: parts.en.title || type };
    const content = { de: parts.de.content, en: parts.en.content };
    const summary = {
        de: read(path.join(dir, `${type}.summary.de.md`)) || '',
        en: read(path.join(dir, `${type}.summary.en.md`)) || '',
    };
    const indexRef = db.collection('legal_documents').doc(type);
    const index = await indexRef.get();
    const currentVersion = index.data()?.currentVersion ?? null;

    if (publishInitial) {
        if (currentVersion != null) {
            console.log(`skip ${type}: already has version ${currentVersion}`);
            continue;
        }
        const now = Timestamp.now();
        const changeType = type === 'imprint' ? 'notifyOnly' : 'requiresAcceptance';
        const initialSummary = summary.de || summary.en ? summary : INITIAL_SUMMARY;
        const batch = db.batch();
        batch.set(indexRef.collection('versions').doc('1'), {
            type, version: 1, status: 'published', title, content, summary: initialSummary, changeType,
            notifyByEmail: false, effectiveAt: now, publishedAt: now, publishedBy: 'import-legal-docs',
        });
        batch.set(indexRef, {
            type, acceptanceRequired: type !== 'imprint', currentVersion: 1, title,
            versions: [{ version: 1, changeType, effectiveAt: now, publishedAt: now, summary: initialSummary }],
            updatedAt: now,
        });
        await batch.commit();
        console.log(`published ${type} v1 (no mail)`);
        continue;
    }

    await indexRef.collection('drafts').doc('current').set({
        type, title, content, summary,
        changeType: type === 'terms' ? 'requiresAcceptance' : 'notifyOnly',
        effectiveAt: null,
        notifyByEmail: type === 'terms',
        baseVersion: currentVersion,
        updatedAt: Timestamp.now(),
        updatedBy: 'import-legal-docs',
    });
    console.log(`draft ${type} saved (base version ${currentVersion ?? 'none'}) — review and publish in /admin/legal`);
}
process.exit(0);
