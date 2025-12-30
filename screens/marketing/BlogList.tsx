import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { fetchExternalBlogPosts, BlogPost, deleteBlogPost } from '../../services/blogService';
import { useToast, useConfirm } from '../../context/UIContext';


// Mock data for initial development
const MOCK_BLOGS: BlogPost[] = [
    {
        id: '1',
        title: 'Getting Started with ProjectFlow',
        excerpt: 'Learn the basics of managing your projects efficiently...',
        coverImage: 'https://images.unsplash.com/photo-1499750310159-52f8f6f32fe1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80',
        author: 'Christoph L.',
        status: 'published',
        createdAt: new Date(2025, 11, 28),
        category: { name: 'Product', slug: 'product' },
        tags: ['guide', 'basics']
    },
    {
        id: '2',
        title: 'Q4 2025 Roadmap',
        excerpt: 'Here is what we are planning for the next quarter...',
        coverImage: null,
        author: 'Sarah M.',
        status: 'draft',
        createdAt: new Date(2025, 11, 29),
        category: { name: 'Announcements', slug: 'announcements' },
        tags: ['roadmap', 'planning']
    }
];

const BlogList = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { id: projectId } = useParams();
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    React.useEffect(() => {
        const loadBlogs = async () => {
            if (!projectId) return;
            setIsLoading(true);
            setError(null);
            try {
                // Fetch from external API
                const externalBlogs = await fetchExternalBlogPosts(projectId);
                setBlogs(externalBlogs);
            } catch (err) {
                console.error('Failed to fetch blogs', err);
                setError('Failed to load blog posts. Please check your integration settings.');
            } finally {
                setIsLoading(false);
            }
        };

        loadBlogs();
    }, [projectId]);

    const handleCreate = () => {
        navigate('create');
    };

    const handleDelete = async (e: React.MouseEvent, blogId: string) => {
        e.stopPropagation(); // Prevent navigation
        if (!projectId) return;

        const confirmed = await confirm(
            'Delete Blog Post',
            'Are you sure you want to delete this blog post? This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            await deleteBlogPost(projectId, blogId);
            setBlogs(prev => prev.filter(b => b.id !== blogId));
            showSuccess('Blog post deleted successfully');
        } catch (err) {
            console.error('Failed to delete post', err);
            showError('Failed to delete blog post');
        }
    };

    const handleEdit = (blogId: string) => {
        const blog = blogs.find(b => b.id === blogId);
        navigate(`${blogId}`, { state: { blogPost: blog } });
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)]">Blog Posts</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">Manage your blog content and publications</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center p-1 bg-[var(--color-surface-hover)] rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                                ? 'bg-white shadow-sm text-[var(--color-text-main)] dark:bg-[var(--color-surface-card)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            title="Grid View"
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                                ? 'bg-white shadow-sm text-[var(--color-text-main)] dark:bg-[var(--color-surface-card)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            title="List View"
                        >
                            <span className="material-symbols-outlined text-[20px]">view_list</span>
                        </button>
                    </div>

                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white dark:text-black rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm font-medium"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Create New Post
                    </button>
                </div>
            </div>

            {/* Grid */}
            {isLoading && (
                <div className="flex justify-center p-12">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">progress_activity</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="ml-auto underline text-sm">Retry</button>
                </div>
            )}

            {/* Content Area */}
            {!isLoading && (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                        {blogs.map((blog) => (
                            <div
                                key={blog.id}
                                onClick={() => handleEdit(blog.id)}
                                className="group relative flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden hover:shadow-md hover:border-[var(--color-primary-light)] transition-all cursor-pointer h-[280px]"
                            >
                                {/* Status Badge */}
                                <div className="absolute top-3 right-3 z-10">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border ${blog.status === 'published'
                                        ? 'bg-white text-emerald-600 border-emerald-500/20'
                                        : 'bg-white text-amber-600 border-amber-500/20'
                                        }`}>
                                        {blog.status === 'published' ? 'Published' : 'Draft'}
                                    </span>
                                </div>

                                {/* Delete Button (Visible on hover) */}
                                <button
                                    onClick={(e) => handleDelete(e, blog.id)}
                                    className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 shadow-sm"
                                    title="Delete Post"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>

                                {/* Cover Image */}
                                <div className="h-40 bg-[var(--color-surface-hover)] relative overflow-hidden">
                                    {blog.coverImage ? (
                                        <img
                                            src={blog.coverImage}
                                            alt={blog.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-5xl opacity-20">image</span>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-4 flex flex-col">
                                    <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-2 line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">
                                        {blog.title}
                                    </h3>
                                    <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-auto">
                                        {blog.excerpt}
                                    </p>

                                    {/* Category Badge */}
                                    {blog.category && (
                                        <div className="mt-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]">
                                                {blog.category.name}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mt-4">
                                        <span>{blog.author}</span>
                                        <span>{format(new Date(blog.createdAt), 'MMM d, yyyy')}</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Create New Card (Placeholder style) */}
                        <button
                            onClick={handleCreate}
                            className="flex flex-col items-center justify-center gap-3 h-[280px] border-2 border-dashed border-[var(--color-surface-border)] rounded-xl hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-all group text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                        >
                            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center group-hover:bg-[var(--color-primary-light)] transition-colors">
                                <span className="material-symbols-outlined text-2xl">add</span>
                            </div>
                            <span className="font-medium">Create New Blog</span>
                        </button>
                    </div>
                ) : (
                    <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[var(--color-surface-bg)] border-b border-[var(--color-surface-border)]">
                                    <tr>
                                        <th className="py-3 px-4 font-medium text-[var(--color-text-muted)] w-1/2">Post</th>
                                        <th className="py-3 px-4 font-medium text-[var(--color-text-muted)]">Author</th>
                                        <th className="py-3 px-4 font-medium text-[var(--color-text-muted)]">Status</th>
                                        <th className="py-3 px-4 font-medium text-[var(--color-text-muted)]">Date</th>
                                        <th className="py-3 px-4 font-medium text-[var(--color-text-muted)] text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-surface-border)]">
                                    {blogs.map((blog) => (
                                        <tr
                                            key={blog.id}
                                            onClick={() => handleEdit(blog.id)}
                                            className="hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors group"
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-hover)] overflow-hidden shrink-0">
                                                        {blog.coverImage ? (
                                                            <img src={blog.coverImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]/50">image</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">{blog.title}</div>
                                                        <div className="text-xs text-[var(--color-text-muted)] line-clamp-1 max-w-[300px]">{blog.excerpt}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-[var(--color-text-muted)]">{blog.author}</td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${blog.status === 'published'
                                                    ? 'bg-emerald-500/10 text-emerald-600'
                                                    : 'bg-amber-500/10 text-amber-600'
                                                    }`}>
                                                    {blog.status === 'published' ? 'Published' : 'Draft'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-[var(--color-text-muted)]">
                                                {format(new Date(blog.createdAt), 'MMM d, yyyy')}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={(e) => handleDelete(e, blog.id)}
                                                    className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {blogs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-[var(--color-text-muted)]">
                                                No blog posts found. <button onClick={handleCreate} className="text-[var(--color-primary)] hover:underline">Create your first post</button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export { BlogList };
