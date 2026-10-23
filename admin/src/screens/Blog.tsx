import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Star, Tags, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/api';
import { dateTime, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer, useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Segmented, Skeleton } from '../ui/primitives';

type Category = { id: string; name: string; slug: string; description?: string };
type Author = { id: string; name: string; role: string; avatar: string; bio?: string };
type Post = { id: string; slug: string; title: string; excerpt?: string; content?: string; coverImage?: string; publishedAt?: string; updatedAt?: string; language?: string; category?: { name: string; slug: string }; author?: Author; tags?: string[]; featured?: boolean; translationId?: string | null; readTime?: string };

const CategoryDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { confirm, toast } = useUi();
    const { data, reload } = useAdminQuery<{ categories: Category[] }>('blog.categories');
    const [edit, setEdit] = useState<Partial<Category>>({});
    const save = async () => {
        try {
            await adminApi('blog.saveCategory', edit);
            setEdit({});
            reload();
            toast('Kategorie gespeichert');
        } catch (err: any) { toast(err.message, 'error'); }
    };
    const remove = async (c: Category) => {
        if (!(await confirm({ title: `„${c.name}“ löschen?`, message: 'Beiträge behalten ihren Kategorienamen.', danger: true, confirmLabel: 'Löschen' }))) return;
        try { await adminApi('blog.deleteCategory', { id: c.id }); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };
    return (
        <Drawer title="Kategorien" onClose={onClose}>
            <div className="ac-row">
                <input className="ac-input" style={{ flex: 1 }} placeholder="Name" value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <input className="ac-input" style={{ width: 140 }} placeholder="slug (optional)" value={edit.slug || ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
                <button className="ac-btn ac-btn--primary" disabled={!edit.name} onClick={save}>{edit.id ? 'Speichern' : 'Anlegen'}</button>
            </div>
            <table className="ac-table">
                <thead><tr><th>Name</th><th>Slug</th><th /></tr></thead>
                <tbody>
                    {(data?.categories || []).map((c) => (
                        <tr key={c.id} className="is-clickable" onClick={() => setEdit(c)}>
                            <td className="ac-strong">{c.name}</td><td className="mono">{c.slug}</td>
                            <td style={{ textAlign: 'right' }}><button className="ac-btn ac-btn--ghost ac-btn--icon ac-btn--sm" onClick={(e) => { e.stopPropagation(); void remove(c); }} aria-label="Löschen"><Trash2 size={13} /></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Drawer>
    );
};

export const BlogList: React.FC = () => {
    const navigate = useNavigate();
    const [lang, setLang] = useState('all');
    const [search, setSearch] = useState('');
    const [cats, setCats] = useState(false);
    const { data, loading, error, reload } = useAdminQuery<{ posts: Post[] }>('blog.list');
    const q = search.trim().toLowerCase();
    const rows = (data?.posts || []).filter((p) => (lang === 'all' || p.language === lang) && (!q || `${p.title} ${p.slug} ${p.category?.name} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)));
    const groups = useMemo(() => {
        const map = new Map<string, string[]>();
        (data?.posts || []).forEach((p) => p.translationId && map.set(p.translationId, [...(map.get(p.translationId) || []), p.language || '?']));
        return map;
    }, [data]);

    const columns: Column<Post>[] = [
        { key: 'title', label: 'Titel', render: (p) => <span className="ac-row" style={{ flexWrap: 'nowrap' }}>{p.featured && <Star size={13} color="var(--brand-amber)" />}<span className="ac-strong">{p.title}</span></span> },
        { key: 'language', label: 'Sprache', render: (p) => <Badge plain tone="blue">{(p.language || '?').toUpperCase()}</Badge> },
        { key: 'translations', label: 'Übersetzungen', value: (p) => (p.translationId ? (groups.get(p.translationId) || []).join(', ') : ''), render: (p) => <span className="ac-muted">{p.translationId ? (groups.get(p.translationId) || []).filter((l) => l !== p.language).join(', ').toUpperCase() || '–' : '–'}</span> },
        { key: 'category', label: 'Kategorie', value: (p) => p.category?.name || '' },
        { key: 'author', label: 'Autor', value: (p) => p.author?.name || '' },
        { key: 'publishedAt', label: 'Veröffentlicht', value: (p) => (p.publishedAt ? Date.parse(p.publishedAt) : null), render: (p) => (p.publishedAt ? dateTime(Date.parse(p.publishedAt)) : '–') },
        { key: 'updatedAt', label: 'Geändert', value: (p) => (p.updatedAt ? Date.parse(p.updatedAt) : null), render: (p) => (p.updatedAt ? relative(Date.parse(p.updatedAt)) : '–') },
        { key: 'slug', label: 'Slug', render: (p) => <span className="mono ac-muted">{p.slug}</span>, hidden: true },
    ];
    return (
        <div className="ac-page">
            <PageHead title="Blog" subtitle="Plattform-Blog (blog_posts), öffentlich lesbar über die Blog-API." actions={<>
                <button className="ac-btn" onClick={() => setCats(true)}><Tags size={14} />Kategorien</button>
                <button className="ac-btn ac-btn--primary" onClick={() => navigate('/blog/new')}><Plus size={14} />Neuer Beitrag</button>
            </>} />
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id="blog" rows={data ? rows : null} loading={loading} columns={columns} rowKey={(p) => p.id} onOpen={(p) => navigate(`/blog/${encodeURIComponent(p.id)}`)} defaultSort={{ key: 'publishedAt', dir: 'desc' }} emptyTitle="Noch keine Beiträge"
                toolbar={<>
                    <div className="ac-search"><input className="ac-input" placeholder="Titel, Tag, Kategorie …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <Segmented value={lang} onChange={setLang} options={[{ value: 'all', label: 'Alle' }, { value: 'de', label: 'DE' }, { value: 'en', label: 'EN' }]} />
                </>} />
            {cats && <CategoryDrawer onClose={() => setCats(false)} />}
        </div>
    );
};

/** Strips scripts, handlers and javascript: URLs before the preview renders (CSP blocks them anyway). */
const sanitize = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, style, link, meta').forEach((el) => el.remove());
    doc.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            if (attr.name.startsWith('on') || (/^(href|src|xlink:href)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
        }
    });
    return doc.body.innerHTML;
};

const slugify = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100);
const blank = (): Post => ({ id: '', slug: '', title: '', excerpt: '', content: '', coverImage: '', language: 'de', publishedAt: new Date().toISOString(), tags: [], featured: false, author: { id: 'christoph', name: 'Christoph Labestin', role: 'Founder', avatar: '' }, category: { name: '', slug: '' }, translationId: null });

export const BlogEditor: React.FC = () => {
    const { id = 'new' } = useParams();
    const isNew = id === 'new';
    const navigate = useNavigate();
    const { confirm, toast } = useUi();
    const post = useAdminQuery<Post>(isNew ? null : 'blog.get', { id });
    const cats = useAdminQuery<{ categories: Category[] }>('blog.categories');
    const [form, setForm] = useState<Post | null>(isNew ? blank() : null);
    const [slugTouched, setSlugTouched] = useState(!isNew);
    const [view, setView] = useState<'split' | 'source' | 'preview'>('split');
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => { if (post.data) setForm(post.data); }, [post.data]);
    const patch = (p: Partial<Post>) => { setForm((f) => (f ? { ...f, ...p } : f)); setDirty(true); };
    const preview = useMemo(() => sanitize(form?.content || ''), [form?.content]);

    const save = async () => {
        if (!form) return;
        setBusy(true);
        try {
            const result = await adminApi<{ id: string }>('blog.save', { post: form, originalId: isNew ? null : id });
            toast('Beitrag gespeichert');
            setDirty(false);
            if (result.id !== id) navigate(`/blog/${encodeURIComponent(result.id)}`, { replace: true });
            else post.reload();
        } catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
    };
    const remove = async () => {
        if (!(await confirm({ title: 'Beitrag löschen?', message: `„${form?.title}“ wird endgültig gelöscht und verschwindet aus der Blog-API.`, danger: true, confirmLabel: 'Löschen', requireText: form?.slug }))) return;
        try { await adminApi('blog.delete', { id }); toast('Beitrag gelöscht'); navigate('/blog'); } catch (err: any) { toast(err.message, 'error'); }
    };

    if (!form) return <div className="ac-page">{post.error ? <ErrorNote error={post.error} onRetry={post.reload} /> : <Skeleton rows={12} />}</div>;
    return (
        <div className="ac-page">
            <button className="ac-btn ac-btn--ghost ac-btn--sm" style={{ marginBottom: 10 }} onClick={() => navigate('/blog')}><ArrowLeft size={14} />Blog</button>
            <PageHead title={isNew ? 'Neuer Beitrag' : form.title || 'Beitrag'} subtitle={<>{form.slug ? <span className="mono">/{form.slug}</span> : 'Noch kein Slug'}{dirty ? ' · ungespeichert' : ''}</>} actions={<>
                {!isNew && <button className="ac-btn ac-btn--danger" onClick={remove}><Trash2 size={14} />Löschen</button>}
                <button className="ac-btn ac-btn--primary" disabled={busy || !form.title || !form.slug || !form.content} onClick={save}>{isNew ? 'Veröffentlichen' : 'Speichern'}</button>
            </>} />
            <div className="ac-grid ac-grid--main-side">
                <Card title="Inhalt (HTML)" actions={<Segmented value={view} onChange={setView} options={[{ value: 'split', label: 'Geteilt' }, { value: 'source', label: 'Quelltext' }, { value: 'preview', label: 'Vorschau' }]} />}>
                    <div className="ac-stack">
                        <input className="ac-input ac-input--lg" placeholder="Titel" value={form.title} onChange={(e) => patch({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
                        <textarea className="ac-textarea" rows={2} placeholder="Teaser / Excerpt" value={form.excerpt || ''} onChange={(e) => patch({ excerpt: e.target.value })} />
                        <div className={`ac-blog-edit ac-blog-edit--${view}`}>
                            {view !== 'preview' && <textarea className="ac-textarea ac-textarea--code" value={form.content || ''} onChange={(e) => patch({ content: e.target.value })} placeholder="<h2>…</h2><p>…</p>" />}
                            {view !== 'source' && <article className="ac-prose" dangerouslySetInnerHTML={{ __html: preview }} />}
                        </div>
                    </div>
                </Card>
                <div className="ac-stack">
                    <Card title="Metadaten">
                        <div className="ac-stack">
                            <label className="ac-field"><span>Slug</span><input className="ac-input mono" value={form.slug} onChange={(e) => { setSlugTouched(true); patch({ slug: slugify(e.target.value) }); }} /></label>
                            <div className="ac-field"><span>Sprache</span><Segmented value={form.language || 'de'} onChange={(v) => patch({ language: v })} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} /></div>
                            <label className="ac-field"><span>Kategorie</span>
                                <select className="ac-select" value={form.category?.slug || ''} onChange={(e) => { const c = cats.data?.categories.find((x) => x.slug === e.target.value); patch({ category: c ? { name: c.name, slug: c.slug } : { name: '', slug: '' } }); }}>
                                    <option value="">–</option>
                                    {(cats.data?.categories || []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                                </select>
                            </label>
                            <label className="ac-field"><span>Tags (Komma-getrennt)</span><input className="ac-input" value={(form.tags || []).join(', ')} onChange={(e) => patch({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} /></label>
                            <label className="ac-field"><span>Veröffentlicht am</span><input className="ac-input" type="date" value={(form.publishedAt || '').slice(0, 10)} onChange={(e) => patch({ publishedAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : '' })} /></label>
                            <label className="ac-field"><span>Cover-Bild (URL)</span><input className="ac-input" value={form.coverImage || ''} onChange={(e) => patch({ coverImage: e.target.value })} /></label>
                            {form.coverImage && <img src={form.coverImage} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-surface-border)' }} />}
                            <label className="ac-field"><span>Übersetzungsgruppe</span><input className="ac-input mono" placeholder="gleiche ID = Übersetzungen" value={form.translationId || ''} onChange={(e) => patch({ translationId: e.target.value })} /></label>
                            <label className="ac-check"><input type="checkbox" checked={form.featured === true} onChange={(e) => patch({ featured: e.target.checked })} />Hervorgehoben</label>
                        </div>
                    </Card>
                    <Card title="Autor">
                        <div className="ac-stack">
                            <input className="ac-input" placeholder="Name" value={form.author?.name || ''} onChange={(e) => patch({ author: { ...(form.author as Author), name: e.target.value, id: slugify(e.target.value) } })} />
                            <input className="ac-input" placeholder="Rolle" value={form.author?.role || ''} onChange={(e) => patch({ author: { ...(form.author as Author), role: e.target.value } })} />
                            <input className="ac-input" placeholder="Avatar-URL" value={form.author?.avatar || ''} onChange={(e) => patch({ author: { ...(form.author as Author), avatar: e.target.value } })} />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
