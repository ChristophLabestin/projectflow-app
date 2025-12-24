import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { subscribeSocialPosts } from '../../services/dataService';
import { SocialPost } from '../../types';

export const PostList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [posts, setPosts] = useState<SocialPost[]>([]);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeSocialPosts(projectId, (data) => setPosts(data));
        return () => unsub();
    }, [projectId]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="h2 mb-1">Posts</h1>
                    <p className="text-[var(--color-text-muted)]">All social media posts.</p>
                </div>
                <Link
                    to={`/project/${projectId}/social/create`}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined">add</span>
                    <span>New Post</span>
                </Link>
            </div>

            <div className="space-y-3">
                {posts.map(post => (
                    <div
                        key={post.id}
                        className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-4 flex gap-4 cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors"
                        onClick={() => navigate(`/project/${projectId}/social/edit/${post.id}`)}
                    >
                        <div className="size-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            {post.assets && post.assets.length > 0 ? (
                                <img src={post.assets[0].url} className="size-full object-cover rounded-lg" />
                            ) : (
                                <span className="material-symbols-outlined text-gray-400">image</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between">
                                <span className="text-xs font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{post.platform}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${post.status === 'Published' ? 'bg-green-100 text-green-700' :
                                    post.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>{post.status}</span>
                            </div>
                            <p className="mt-1 font-medium line-clamp-2">{post.content.caption || <span className="text-gray-400 italic">No caption</span>}</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">{post.content.hashtags?.join(' ')}</p>
                            {post.scheduledFor && <p className="text-xs text-[var(--color-primary)] mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                {new Date(post.scheduledFor).toLocaleString()}
                            </p>}
                        </div>
                    </div>
                ))}
                {posts.length === 0 && (
                    <div className="py-12 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)]">
                        <p>No posts yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
