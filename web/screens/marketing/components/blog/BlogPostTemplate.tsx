import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Calendar, Clock, Share2, Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../../../../context/LanguageContext';
import { BlogPost } from '../../../../services/blogService';
import { auth } from '../../../../services/firebase';
import { sanitizeHtml } from '../../../../utils/sanitizeHtml';
import '../../../../components/editor/editorStyles.css'; // Import editor styles for preview

interface BlogPostTemplateProps {
    post: Partial<BlogPost>;
    onBack?: () => void;
    isPreview?: boolean;
}

export const BlogPostTemplate: React.FC<BlogPostTemplateProps> = ({ post, onBack, isPreview = false }) => {
    const { t, dateLocale } = useLanguage();
    // Default values for preview mode
    const title = post.title || t('marketing.blogPreview.untitled');
    const coverImage = post.coverImage;
    const authorName = typeof post.author === 'object' ? post.author.name : (post.author || auth.currentUser?.displayName || t('marketing.blogPreview.anonymous'));
    const date = post.createdAt ? format(new Date(post.createdAt), 'PP', { locale: dateLocale }) : format(new Date(), 'PP', { locale: dateLocale });
    const readTime = t('marketing.blogPreview.readTime'); // Placeholder or calc
    const categoryName = t('marketing.blogPreview.general'); // Placeholder
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
                        className="group flex items-center gap-2 text-sm font-medium text-muted hover:text-main transition-colors mb-12"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        {t('marketing.blogPreview.back')}
                    </button>
                )}

                <div className="bg-surface-card rounded-3xl border border-surface shadow-sm overflow-hidden">
                    {coverImage && (
                        <div className="aspect-[21/9] w-full bg-surface-hover relative">
                            <img
                                src={coverImage}
                                alt={title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-6 left-6">
                                <span className="px-3 py-1 bg-surface-card/90 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider text-main border border-white/20 shadow-sm">
                                    {categoryName}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className={`p-8 md:p-16 mx-auto ${isPreview ? '' : 'max-w-3xl'}`}>
                        <header className="mb-12 text-center">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-main leading-tight text-balance">
                                {title}
                            </h1>
                            {post.excerpt && (
                                <p className="text-xl text-muted leading-relaxed mb-8">
                                    {post.excerpt}
                                </p>
                            )}

                            <div className="flex items-center justify-center gap-6 text-sm text-muted border-t border-b border-surface py-6">
                                <div className="flex items-center gap-2">
                                    <User size={16} />
                                    <span className="font-medium text-main">{authorName}</span>
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
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                            />
                        </div>

                        <div className="mt-16 pt-8 border-t border-surface flex justify-between items-center">
                            <h4 className="font-bold text-sm text-main">{t('marketing.blogPreview.share')}</h4>
                            <div className="flex gap-2">
                                <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted hover:text-main">
                                    <Share2 size={20} />
                                </button>
                                <button className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted hover:text-main">
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
