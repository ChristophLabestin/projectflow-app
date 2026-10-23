#!/usr/bin/env node
// Exports the startup-company seed content (tracks, jurisdictions, initiatives, tasks, milestones) from the web
// config + both locales into the iOS app resource ios/App/Resources/StartupSeeds.json, with de/en copy resolved.
// Source of truth: web/config/projectTemplates.ts, web/locales/{en,de}.ts. Run: node scripts/export-startup-seeds.mjs
// (No TS toolchain needed: the plain array/object literals are extracted from the sources and evaluated.)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const templatesSrc = read('web/config/projectTemplates.ts');

/** Text of the bracketed literal that starts at the first `[`/`{` after `marker`, balanced and string-aware. */
function literalAfter(src, marker) {
    const start = src.indexOf(marker);
    if (start < 0) throw new Error(`marker not found: ${marker}`);
    let i = src.indexOf('=', start);
    while (!'[{'.includes(src[i])) i++;
    const open = src[i], close = open === '[' ? ']' : '}';
    let depth = 0, quote = null;
    for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (quote) { if (c === '\\') j++; else if (c === quote) quote = null; continue; }
        if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
        if (c === open) depth++;
        else if (c === close && --depth === 0) return src.slice(i, j + 1);
    }
    throw new Error(`unbalanced literal: ${marker}`);
}
const evalLiteral = (text, scope = {}) => new Function(...Object.keys(scope), `return (${text});`)(...Object.values(scope));

const SOURCE_REVIEW_DATE = /const SOURCE_REVIEW_DATE = '([^']+)'/.exec(templatesSrc)[1];
const scope = { SOURCE_REVIEW_DATE, normalizeModulesForPmCore: (m) => m };
const list = (name) => evalLiteral(literalAfter(templatesSrc, `export const ${name}`), scope);

const tracks = list('STARTUP_TRACK_DEFINITIONS');
const jurisdictions = list('STARTUP_JURISDICTION_TEMPLATES');
const initiatives = list('STARTUP_SEED_INITIATIVES');
const tasks = list('STARTUP_SEED_TASKS');
const jurisdictionTasks = list('STARTUP_JURISDICTION_SEED_TASKS');
const milestones = list('STARTUP_SEED_MILESTONES');
const templates = list('PROJECT_TEMPLATE_DEFINITIONS');
const startup = templates.find((t) => t.id === 'startup_company_formation');

const dict = (file, name) => evalLiteral(literalAfter(read(file), `const ${name} =`));
const locales = { en: dict('web/locales/en.ts', 'en'), de: dict('web/locales/de.ts', 'de') };
const tr = (key) => {
    if (!key) return undefined;
    const out = {};
    for (const [lang, table] of Object.entries(locales)) {
        if (!(key in table)) throw new Error(`missing ${lang} string: ${key}`);
        out[lang] = table[key];
    }
    return out;
};

const out = {
    generatedBy: 'scripts/export-startup-seeds.mjs',
    suggestedTrackIds: startup.suggestedStartupTrackIds,
    tracks: tracks.map((t) => ({ id: t.id, sensitive: t.sensitive === true, label: tr(t.labelKey), description: tr(t.descriptionKey) })),
    jurisdictions: jurisdictions.map((j) => ({
        id: j.id, label: tr(j.labelKey), description: tr(j.descriptionKey), regionHint: tr(j.regionHintKey),
        countryCodes: j.countryCodes, advisorReviewRequired: j.advisorReviewRequired,
        suggestedTrackIds: j.suggestedStartupTrackIds,
        sources: j.sourceReferences, // {id,labelKey,url,publisher,lastReviewedAt} - stored as-is like the web
    })),
    initiatives: initiatives.map((i) => ({ id: i.id, trackId: i.trackId, priority: i.priority, title: tr(i.titleKey), description: tr(i.descriptionKey) })),
    tasks: [...tasks, ...jurisdictionTasks].map((t) => ({
        id: t.id, trackId: t.trackId, jurisdictionId: t.jurisdictionTemplateId ?? null, priority: t.priority,
        sourceReferenceIds: t.sourceReferenceIds ?? [], title: tr(t.titleKey), description: tr(t.descriptionKey),
    })),
    milestones: milestones.map((m) => ({ id: m.id, trackIds: m.trackIds, riskRating: m.riskRating, title: tr(m.titleKey), description: tr(m.descriptionKey) })),
};
const target = join(root, 'ios/App/Resources/StartupSeeds.json');
writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${target}: ${out.tracks.length} tracks, ${out.jurisdictions.length} jurisdictions, ${out.initiatives.length} initiatives, ${out.tasks.length} tasks, ${out.milestones.length} milestones`);
