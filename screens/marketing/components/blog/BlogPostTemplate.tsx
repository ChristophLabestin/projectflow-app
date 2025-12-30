import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Calendar, Clock, Share2, Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { BlogPost } from '../../../../services/blogService';
import { auth } from '../../../../services/firebase';
import '../../../../components/editor/editorStyles.css'; // Import editor styles for preview

interface BlogPostTemplateProps {
    post: Partial<BlogPost>;
    onBack?: () => void;
    isPreview?: boolean;
}

export const BlogPostTemplate: React.FC<BlogPostTemplateProps> = ({ post, onBack, isPreview = false }) => {
    // Default values for preview mode
    const title = post.title || 'Untitled Post';
    const coverImage = post.coverImage;
    const authorName = post.author || auth.currentUser?.displayName || 'Anonymous';
    const date = post.createdAt ? format(new Date(post.createdAt), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy');
    const readTime = '5 min read'; // Placeholder or calc
    const categoryName = 'General'; // Placeholder
    const content = post.content || '';

    return (
        <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`min-h-full bg-dots ${isPreview ? 'pt-8 pb-8' : 'pt-32 pb-24'}`}
        >
            <div className={`container mx-auto px-6 md:px-12 ${isPreview ? 'max-w-full' : 'max-w-5xl'}`}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors mb-12"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Journal
                    </button>
                )}

                <div className="bg-white dark:bg-black/40 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                    {coverImage && (
                        <div className="aspect-[21/9] w-full bg-neutral-100 dark:bg-neutral-900 relative">
                            <img
                                src={coverImage}
                                alt={title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-6 left-6">
                                <span className="px-3 py-1 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider text-black dark:text-white border border-white/20 shadow-sm">
                                    {categoryName}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className={`p-8 md:p-16 mx-auto ${isPreview ? '' : 'max-w-3xl'}`}>
                        <header className="mb-12 text-center">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-neutral-900 dark:text-white leading-tight text-balance">
                                {title}
                            </h1>
                            {post.excerpt && (
                                <p className="text-xl text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8">
                                    {post.excerpt}
                                </p>
                            )}

                            <div className="flex items-center justify-center gap-6 text-sm text-neutral-500 dark:text-neutral-400 border-t border-b border-neutral-100 dark:border-neutral-800 py-6">
                                <div className="flex items-center gap-2">
                                    <User size={16} />
                                    <span className="font-medium text-neutral-900 dark:text-white">{authorName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} />
                                    <span>{date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock size={16} />
                                    <span>{readTime}</span>
                                </div>
                            </div>
                        </header>

                        <div className="prose prose-lg prose-neutral dark:prose-invert mx-auto">
                            {/* Render HTML Content */}
                            <div
                                className="ProseMirror"
                                dangerouslySetInnerHTML={{ __html: content }}
                            />
                        </div>

                        <div className="mt-16 pt-8 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                            <h4 className="font-bold text-sm text-neutral-900 dark:text-white">Share this article</h4>
                            <div className="flex gap-2">
                                <button className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white">
                                    <Share2 size={20} />
                                </button>
                                <button className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white">
                                    <Bookmark size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.article>
    );
};
