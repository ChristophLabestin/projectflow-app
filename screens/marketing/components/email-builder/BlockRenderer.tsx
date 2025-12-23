import React from 'react';
import { EmailBlock } from '../../../types';

export const BlockRenderer = ({ block }: { block: EmailBlock }) => {
    const { content, styles } = block;

    const commonStyle: React.CSSProperties = {
        color: styles.color || 'inherit',
        fontSize: styles.fontSize ? `${styles.fontSize}px` : '16px',
        fontWeight: styles.fontWeight || 'normal',
        textAlign: styles.textAlign as any || 'left',
        fontFamily: styles.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: '1.6',
        padding: `${styles.paddingTop ?? 0}px ${styles.paddingRight ?? 0}px ${styles.paddingBottom ?? 0}px ${styles.paddingLeft ?? 0}px`,
        backgroundColor: styles.backgroundColor || 'transparent',
        borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined,
        borderWidth: styles.borderWidth ? `${styles.borderWidth}px` : undefined,
        borderColor: styles.borderColor || undefined,
        borderStyle: styles.borderStyle || undefined,
        width: styles.width || '100%',
        height: styles.height || 'auto',
    };

    switch (block.type) {
        case 'text':
            return (
                <div style={commonStyle}>
                    <div
                        className="prose prose-sm max-w-none text-inherit dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: content.text || 'Start typing your content here...' }}
                    />
                </div>
            );

        case 'header':
            return (
                <div style={commonStyle}>
                    <h1 style={{
                        margin: 0,
                        fontSize: styles.fontSize ? `${styles.fontSize}px` : '32px',
                        fontWeight: styles.fontWeight || '800',
                        letterSpacing: '-0.025em',
                        lineHeight: '1.2'
                    }}>
                        {content.text || 'Catchy Headline'}
                    </h1>
                </div>
            );

        case 'list':
            return (
                <div style={commonStyle}>
                    <ul className="list-disc space-y-2 ml-5">
                        <li>Premium feature number one</li>
                        <li>Automated workflow integration</li>
                        <li>Cloud-native scalability</li>
                    </ul>
                </div>
            );

        case 'quote':
            return (
                <div style={commonStyle}>
                    <blockquote style={{
                        borderLeft: '4px solid #3b82f6',
                        paddingLeft: '20px',
                        fontStyle: 'italic',
                        color: '#666666',
                        fontSize: '1.1em'
                    }}>
                        {content.text || 'This tool has completely transformed how our team builds marketing assets.'}
                    </blockquote>
                </div>
            );

        case 'html':
            return (
                <div style={commonStyle}>
                    {content.text ? (
                        <div dangerouslySetInnerHTML={{ __html: content.text }} />
                    ) : (
                        <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded text-center text-xs text-zinc-400 font-mono">
                            {'<!-- Your custom HTML goes here -->'}
                        </div>
                    )}
                </div>
            );

        case 'button':
            return (
                <div style={{ textAlign: (styles.textAlign as any) || 'center', width: '100%', margin: '0 auto' }}>
                    <a
                        href={content.url || '#'}
                        onClick={e => !content.url && e.preventDefault()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-block',
                            backgroundColor: styles.backgroundColor || styles.color || '#000000',
                            color: styles.color && styles.backgroundColor ? styles.color : (styles.backgroundColor ? '#ffffff' : (styles.color || '#ffffff')),
                            padding: `${styles.paddingTop ?? 14}px ${styles.paddingRight ?? 28}px ${styles.paddingBottom ?? 14}px ${styles.paddingLeft ?? 28}px`,
                            borderRadius: `${styles.borderRadius ?? 12}px`,
                            borderWidth: styles.borderWidth ? `${styles.borderWidth}px` : undefined,
                            borderColor: styles.borderColor || undefined,
                            borderStyle: styles.borderStyle || undefined,
                            fontSize: `${styles.fontSize || 15}px`,
                            fontWeight: styles.fontWeight || '600',
                            textDecoration: 'none',
                            fontFamily: styles.fontFamily || 'inherit',
                            transition: 'all 0.2s ease',
                            width: styles.width === '100%' ? '100%' : 'auto',
                            boxSizing: 'border-box'
                        }}
                    >
                        {content.text || 'Get Started Now'}
                    </a>
                </div>
            );

        case 'image':
            return (
                <div style={{ ...commonStyle, textAlign: (styles.textAlign as any) || 'center' }}>
                    <img
                        src={content.src}
                        alt={content.alt}
                        style={{
                            maxWidth: '100%',
                            height: 'auto',
                            display: 'inline-block',
                            borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined,
                        }}
                    />
                </div>
            );

        case 'solid':
            return (
                <div style={{ ...commonStyle, minHeight: styles.height }}></div>
            );

        case 'divider':
            return (
                <div style={commonStyle}>
                    <hr style={{
                        margin: 0,
                        border: 'none',
                        borderTopWidth: styles.borderWidth ? `${styles.borderWidth}px` : '1px',
                        borderTopStyle: 'solid',
                        borderTopColor: styles.borderColor ?? '#e5e5e5'
                    }} />
                </div>
            );

        case 'spacer':
            return <div style={{ ...commonStyle, height: styles.height ?? 48 }} />;

        case 'menu':
            return (
                <div style={{ ...commonStyle, textAlign: 'center' }}>
                    <nav className="inline-flex gap-6">
                        {(content.menuLinks || []).map((link, idx) => (
                            <a
                                key={idx}
                                href={link.url}
                                onClick={e => e.preventDefault()}
                                className="text-sm font-medium hover:underline transition-colors"
                                style={{ color: styles.color || 'inherit' }}
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>
                </div>
            );

        case 'social':
            const iconMap: Record<string, string> = {
                twitter: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
                facebook: 'M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z',
                linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
                instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'
            };
            return (
                <div style={{ ...commonStyle, textAlign: 'center' }}>
                    <div className="inline-flex gap-4">
                        {(content.socialLinks || []).map((link, idx) => (
                            <a
                                key={idx}
                                href={link.url}
                                onClick={e => e.preventDefault()}
                                className="size-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d={iconMap[link.platform] || ''} />
                                </svg>
                            </a>
                        ))}
                    </div>
                </div>
            );

        case 'video':
            return (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="relative inline-block group cursor-pointer">
                        <img
                            src={content.src || 'https://placehold.co/640x360?text=Video'}
                            alt="Video Thumbnail"
                            style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="size-16 rounded-full bg-black/60 group-hover:bg-red-600 transition-colors flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-3xl">play_arrow</span>
                            </div>
                        </div>
                    </div>
                </div>
            );

        case 'div':
            return (
                <div style={{
                    ...commonStyle,
                    minHeight: styles.height || '40px',
                    border: '1px dashed #e5e5e5',
                    padding: '8px'
                }}>
                    <div className="text-[9px] uppercase tracking-widest text-zinc-300 font-bold mb-1">Div Container</div>
                    {/* Simplified preview for DragOverlay */}
                    {content.children?.map((child, i) => (
                        <div key={i} className="mb-1 p-1 bg-zinc-50 border border-zinc-100 rounded text-[8px] truncate">{child.type}</div>
                    ))}
                </div>
            );

        case 'flex':
            return (
                <div style={{
                    ...commonStyle,
                    display: 'flex',
                    flexDirection: styles.flexDirection || 'row',
                    flexWrap: styles.flexWrap || 'wrap',
                    gap: `${styles.gap ?? 10}px`,
                    minHeight: '60px',
                    border: '1px dashed #e5e5e5',
                    padding: '8px'
                }}>
                    <div className="w-full text-[9px] uppercase tracking-widest text-zinc-300 font-bold mb-1">Flex Container</div>
                    {content.children?.map((child, i) => (
                        <div key={i} className="p-1 bg-zinc-50 border border-zinc-100 rounded text-[8px] truncate">{child.type}</div>
                    ))}
                </div>
            );

        case 'columns':
            return (
                <div style={{
                    ...commonStyle,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${content.columns?.length || 2}, 1fr)`,
                    gap: `${styles.gap ?? 20}px`,
                    minHeight: '60px',
                    border: '1px dashed #e5e5e5',
                    padding: '8px'
                }}>
                    {content.columns?.map((col, idx) => (
                        <div key={idx} className="border border-dotted border-zinc-200 p-1 min-h-[40px]">
                            <div className="text-[8px] text-zinc-300 mb-1">Col {idx + 1}</div>
                        </div>
                    ))}
                </div>
            );

        default:
            return (
                <div className="p-8 m-2 border-2 border-dashed border-red-200 rounded-xl bg-red-50/30 text-red-500 text-center">
                    <span className="material-symbols-outlined mb-2 text-3xl">error</span>
                    <p className="font-bold text-sm uppercase tracking-wider">Unsupported: {block.type}</p>
                </div>
            );
    }
};
