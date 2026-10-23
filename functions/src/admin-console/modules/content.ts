import { FieldValue } from 'firebase-admin/firestore';
import { computeOnboardingStats } from '../../onboarding-stats';
import type { HandlerMap } from '../types';
import { AdminInputError, str, toMs } from '../types';

/** Plain JSON for the console: Timestamps → ms, nested objects kept, long strings cut. */
export const plain = (value: any, depth = 0): any => {
    if (value == null) return value ?? null;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (Array.isArray(value)) return value.slice(0, 200).map((v) => plain(v, depth + 1));
    if (typeof value === 'object') {
        if (depth > 4) return null;
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v, depth + 1)]));
    }
    if (typeof value === 'string' && value.length > 20000) return value.slice(0, 20000);
    return value;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEAD_COLLECTIONS = {
    subscribers: 'newsletter_subscribers',
    pending: 'newsletter_pending',
    legacy: 'newsletter',
    waitlist: 'waitlist',
    contact: 'contact_submissions',
} as const;
type LeadKind = keyof typeof LEAD_COLLECTIONS;
const leadKind = (value: unknown): LeadKind => {
    if (typeof value !== 'string' || !(value in LEAD_COLLECTIONS)) throw new AdminInputError('kind is invalid');
    return value as LeadKind;
};

const postInput = (raw: any) => {
    const slug = str(raw?.slug, 120).toLowerCase();
    if (!SLUG.test(slug)) throw new AdminInputError('Slug: nur a–z, 0–9 und Bindestriche');
    const title = str(raw?.title, 300);
    if (!title) throw new AdminInputError('Titel fehlt');
    const content = typeof raw?.content === 'string' ? raw.content.slice(0, 400_000) : '';
    if (!content.trim()) throw new AdminInputError('Inhalt fehlt');
    const category = raw?.category && typeof raw.category === 'object' ? { name: str(raw.category.name, 80), slug: str(raw.category.slug, 80) } : { name: '', slug: '' };
    const author = raw?.author && typeof raw.author === 'object'
        ? { id: str(raw.author.id, 80), name: str(raw.author.name, 120), role: str(raw.author.role, 120), avatar: str(raw.author.avatar, 600), bio: str(raw.author.bio, 600) }
        : { id: '', name: '', role: '', avatar: '', bio: '' };
    const publishedAt = raw?.publishedAt && Number.isFinite(Date.parse(raw.publishedAt)) ? new Date(raw.publishedAt).toISOString() : new Date().toISOString();
    return {
        slug,
        id: slug,
        title,
        excerpt: str(raw?.excerpt, 1000),
        content,
        coverImage: str(raw?.coverImage, 1000),
        publishedAt,
        readTime: str(raw?.readTime, 40) || `${Math.max(1, Math.round(content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 200))} min read`,
        author,
        category,
        tags: Array.isArray(raw?.tags) ? raw.tags.map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 20) : [],
        featured: raw?.featured === true,
        language: raw?.language === 'de' ? 'de' : 'en',
        translationId: str(raw?.translationId, 80) || null,
        translationGroupId: str(raw?.translationId, 80) || null,
    };
};

export const contentHandlers: HandlerMap = {
    'onboarding.stats': {
        audit: 'none',
        run: async (_ctx, params) => computeOnboardingStats(params?.sinceDays),
    },

    'blog.list': {
        audit: 'none',
        run: async ({ db }) => {
            const snap = await db.collection('blog_posts').select('title', 'slug', 'excerpt', 'publishedAt', 'updatedAt', 'language', 'category', 'author', 'tags', 'featured', 'translationId', 'coverImage', 'readTime').get();
            return { posts: snap.docs.map((doc) => ({ id: doc.id, ...plain(doc.data()) })) };
        },
    },
    'blog.get': {
        audit: 'none',
        run: async ({ db }, params) => {
            const snap = await db.collection('blog_posts').doc(str(params?.id, 120)).get();
            if (!snap.exists) throw new AdminInputError('Beitrag nicht gefunden');
            return { id: snap.id, ...plain(snap.data()) };
        },
    },
    'blog.save': {
        audit: 'mutation',
        target: (p) => `blog_posts/${str(p?.post?.slug, 120)}`,
        summary: (p) => (p?.originalId ? 'aktualisiert' : 'erstellt'),
        run: async ({ db, uid }, params) => {
            const post = postInput(params?.post);
            const originalId = str(params?.originalId, 120);
            const ref = db.collection('blog_posts').doc(post.slug);
            await db.runTransaction(async (tx) => {
                const existing = await tx.get(ref);
                if (!originalId && existing.exists) throw new AdminInputError('Slug ist schon vergeben');
                if (originalId && originalId !== post.slug) {
                    if (existing.exists) throw new AdminInputError('Slug ist schon vergeben');
                    tx.delete(db.collection('blog_posts').doc(originalId));
                }
                tx.set(ref, { ...post, updatedAt: new Date().toISOString(), updatedBy: uid }, { merge: Boolean(originalId) && originalId === post.slug });
            });
            return { ok: true, id: post.slug };
        },
    },
    'blog.delete': {
        audit: 'mutation',
        target: (p) => `blog_posts/${str(p?.id, 120)}`,
        run: async ({ db }, params) => {
            const id = str(params?.id, 120);
            if (!id) throw new AdminInputError('id fehlt');
            await db.collection('blog_posts').doc(id).delete();
            return { ok: true };
        },
    },
    'blog.categories': {
        audit: 'none',
        run: async ({ db }) => {
            const snap = await db.collection('blog_categories').orderBy('name', 'asc').get();
            return { categories: snap.docs.map((doc) => ({ id: doc.id, ...plain(doc.data()) })) };
        },
    },
    'blog.saveCategory': {
        audit: 'mutation',
        target: (p) => `blog_categories/${str(p?.id, 80) || 'neu'}`,
        summary: (p) => str(p?.name, 80),
        run: async ({ db }, params) => {
            const name = str(params?.name, 80);
            if (!name) throw new AdminInputError('Name fehlt');
            const slug = (str(params?.slug, 80) || name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const data = { name, slug, description: str(params?.description, 500) };
            const id = str(params?.id, 80);
            if (id) await db.collection('blog_categories').doc(id).set(data, { merge: true });
            else await db.collection('blog_categories').add({ ...data, createdAt: FieldValue.serverTimestamp() });
            return { ok: true };
        },
    },
    'blog.deleteCategory': {
        audit: 'mutation',
        target: (p) => `blog_categories/${str(p?.id, 80)}`,
        run: async ({ db }, params) => {
            const id = str(params?.id, 80);
            if (!id) throw new AdminInputError('id fehlt');
            await db.collection('blog_categories').doc(id).delete();
            return { ok: true };
        },
    },

    /** Marketing leads: newsletter (confirmed/pending/legacy), waitlist, contact form. Personal data → audited read. */
    'leads.list': {
        audit: 'read',
        target: (p) => LEAD_COLLECTIONS[p?.kind as LeadKind] ?? String(p?.kind),
        run: async ({ db }, params) => {
            const kind = leadKind(params?.kind);
            const snap = await db.collection(LEAD_COLLECTIONS[kind]).limit(2000).get();
            const rows = snap.docs.map((doc) => {
                const d = plain(doc.data());
                const at = toMs(doc.get('subscribedAt')) ?? toMs(doc.get('createdAt')) ?? toMs(doc.get('submittedAt')) ?? toMs(doc.get('timestamp')) ?? toMs(doc.get('confirmedAt')) ?? null;
                return { id: doc.id, at, ...d };
            });
            const counts = Object.fromEntries(await Promise.all(Object.entries(LEAD_COLLECTIONS).map(async ([k, c]) => [k, (await db.collection(c).count().get()).data().count])));
            return { rows, counts };
        },
    },
    'leads.delete': {
        audit: 'mutation',
        target: (p) => `${LEAD_COLLECTIONS[p?.kind as LeadKind] ?? '?'}/${str(p?.id, 200)}`,
        summary: () => 'gelöscht (DSGVO/Support)',
        run: async ({ db }, params) => {
            const kind = leadKind(params?.kind);
            const id = str(params?.id, 200);
            if (!id) throw new AdminInputError('id fehlt');
            await db.collection(LEAD_COLLECTIONS[kind]).doc(id).delete();
            return { ok: true };
        },
    },
};
