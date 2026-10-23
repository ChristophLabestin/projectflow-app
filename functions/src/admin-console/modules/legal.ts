import { deleteLegalDraftCore, legalAdminOverviewCore, publishLegalDraftCore, saveLegalDraftCore } from '../../legal';
import { isLegalType, LEGAL_TYPES } from '../../legal-logic';
import type { HandlerMap } from '../types';
import { AdminInputError, int, toMs } from '../types';

/** Legal documents (contract brain/plans/legal-consent-contract.md); logic lives in functions/src/legal.ts. */

const typeOf = (params: any) => {
    if (!isLegalType(params?.type)) throw new AdminInputError('type is invalid');
    return params.type;
};

const versionOut = (d: FirebaseFirestore.DocumentData | undefined) => d ? ({
    version: Number(d.version) || 0,
    title: d.title || { de: '', en: '' },
    content: d.content || { de: '', en: '' },
    summary: d.summary || { de: '', en: '' },
    changeType: d.changeType || 'notifyOnly',
    notifyByEmail: d.notifyByEmail === true,
    effectiveAt: toMs(d.effectiveAt),
    publishedAt: toMs(d.publishedAt),
    machineGraceDays: d.machineGraceDays ?? null,
}) : null;

export const legalHandlers: HandlerMap = {
    'legal.overview': {
        audit: 'none',
        run: async ({ db }) => {
            const overview = await legalAdminOverviewCore(db);
            const [indexes, drafts] = await Promise.all([
                db.getAll(...LEGAL_TYPES.map((t) => db.collection('legal_documents').doc(t))),
                db.getAll(...LEGAL_TYPES.map((t) => db.collection('legal_documents').doc(t).collection('drafts').doc('current'))),
            ]);
            return {
                ...overview,
                meta: LEGAL_TYPES.map((type, i) => ({
                    type,
                    title: indexes[i].get('title') || null,
                    currentVersion: indexes[i].get('currentVersion') ?? null,
                    acceptanceRequired: indexes[i].get('acceptanceRequired') ?? null,
                    draft: drafts[i].exists ? { updatedAt: toMs(drafts[i].get('updatedAt')), baseVersion: drafts[i].get('baseVersion') ?? null, changeType: drafts[i].get('changeType') } : null,
                })),
            };
        },
    },

    /** Editor payload: current published version (for the diff) + the draft. */
    'legal.get': {
        audit: 'none',
        run: async ({ db }, params) => {
            const type = typeOf(params);
            const ref = db.collection('legal_documents').doc(type);
            const [index, draft] = await Promise.all([ref.get(), ref.collection('drafts').doc('current').get()]);
            const current = index.get('currentVersion');
            const currentSnap = current ? await ref.collection('versions').doc(String(current)).get() : null;
            const d = draft.data();
            return {
                type,
                currentVersion: current ?? null,
                current: versionOut(currentSnap?.data()),
                draft: d ? { ...versionOut(d), baseVersion: d.baseVersion ?? null, updatedAt: toMs(d.updatedAt), updatedBy: d.updatedBy ?? null } : null,
            };
        },
    },

    'legal.version': {
        audit: 'none',
        run: async ({ db }, params) => {
            const type = typeOf(params);
            const version = int(params?.version, 0, 1, 100000);
            const snap = await db.collection('legal_documents').doc(type).collection('versions').doc(String(version)).get();
            if (!snap.exists) throw new AdminInputError('Version not found');
            return versionOut(snap.data());
        },
    },

    'legal.saveDraft': {
        audit: 'mutation',
        target: (p) => `legal_documents/${p?.type}/drafts/current`,
        summary: (p) => `${p?.changeType}${p?.effectiveAt ? `, wirksam ${p.effectiveAt}` : ''}`,
        run: async ({ db, uid }, params) => saveLegalDraftCore(db, params, uid),
    },

    'legal.deleteDraft': {
        audit: 'mutation',
        target: (p) => `legal_documents/${p?.type}/drafts/current`,
        run: async ({ db }, params) => deleteLegalDraftCore(db, typeOf(params)),
    },

    'legal.publish': {
        audit: 'mutation',
        target: (p) => `legal_documents/${p?.type}`,
        summary: (p, r) => `v${r?.version ?? '?'} veröffentlicht (Basis v${p?.baseVersion ?? '–'})`,
        run: async ({ db, uid }, params) => publishLegalDraftCore(db, typeOf(params), uid, typeof params?.baseVersion === 'number' ? params.baseVersion : null),
    },
};
