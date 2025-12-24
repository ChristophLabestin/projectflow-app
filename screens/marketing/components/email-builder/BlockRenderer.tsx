import React from 'react';
import { EmailBlock } from '../../../types';

export const BlockRenderer = ({ block, variables, preview = false }: { block: EmailBlock, variables?: any[], preview?: boolean }) => {
    const { content, styles } = block;

    const isButton = block.type === 'button';
    const alignStyle = styles.textAlign as any || 'left';

    const commonStyle: React.CSSProperties = {
        color: styles.color || '#000000', // Default to black for email client compatibility
        fontSize: styles.fontSize ? `${styles.fontSize}px` : '16px',
        fontWeight: styles.fontWeight || 'normal',
        textAlign: alignStyle,
        fontFamily: styles.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: styles.lineHeight ? String(styles.lineHeight) : '1.6',
        letterSpacing: styles.letterSpacing ? `${styles.letterSpacing}px` : undefined,
        textTransform: styles.textTransform as any,
        textDecoration: styles.textDecoration as any,
        padding: `${styles.paddingTop ?? 0}px ${styles.paddingRight ?? 0}px ${styles.paddingBottom ?? 0}px ${styles.paddingLeft ?? 0}px`,
        backgroundColor: styles.backgroundColor || 'transparent',
        borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined,
        borderWidth: styles.borderWidth ? `${styles.borderWidth}px` : undefined,
        borderColor: styles.borderColor || undefined,
        borderStyle: styles.borderStyle || undefined,
        width: styles.width || (['columns', 'flex', 'divider', 'div'].includes(block.type) ? '100%' : undefined),
        height: styles.height || 'auto',
        maxWidth: styles.maxWidth ? (typeof styles.maxWidth === 'number' ? `${styles.maxWidth}px` : styles.maxWidth) : undefined,
        minWidth: styles.minWidth ? (typeof styles.minWidth === 'number' ? `${styles.minWidth}px` : styles.minWidth) : undefined,
    };

    switch (block.type) {
        case 'text':
            return (
                <div style={{
                    ...commonStyle,
                    color: styles.color || '#000000',
                    fontWeight: styles.fontWeight || 'normal',
                    fontStyle: styles.fontStyle || 'normal',
                    textDecoration: styles.textDecoration || 'none',
                    textTransform: (styles.textTransform as any) || 'none',
                    fontSize: styles.fontSize ? `${styles.fontSize}px` : '14px',
                    lineHeight: styles.lineHeight || 1.5,
                    letterSpacing: styles.letterSpacing ? `${styles.letterSpacing}px` : 'normal',
                }}>
                    {content.text || (preview ? '' : 'Enter your text here...')}
                </div>
            );

        case 'richtext':
            return (
                <div style={commonStyle}>
                    <div
                        className="prose prose-sm max-w-none"
                        style={{ color: styles.color || '#000000' }}
                        dangerouslySetInnerHTML={{ __html: content.text || (preview ? '' : '<p>Start typing your rich content here...</p>') }}
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
                        letterSpacing: styles.letterSpacing ? `${styles.letterSpacing}px` : '-0.025em',
                        lineHeight: styles.lineHeight ? String(styles.lineHeight) : '1.2',
                        color: styles.color || '#000000', // Force color
                        textTransform: styles.textTransform as any,
                        textDecoration: styles.textDecoration as any,
                    }}>
                        {content.text || (preview ? '' : 'Catchy Headline')}
                    </h1>
                </div>
            );

        case 'list':
            return (
                <div style={{ ...commonStyle, color: styles.color || '#000000' }}>
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
                        fontStyle: styles.fontStyle || 'italic',
                        color: styles.color || '#666666',
                        fontSize: styles.fontSize ? `${styles.fontSize}px` : '1.1em',
                        lineHeight: styles.lineHeight ? String(styles.lineHeight) : '1.6',
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
                        !preview && (
                            <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded text-center text-xs text-zinc-400 font-mono">
                                {'<!-- Your custom HTML goes here -->'}
                            </div>
                        )
                    )}
                </div>
            );

        case 'button':
            // Alignment Logic:
            // 1. If we are inside a Flex container, the parent Flex handles cross-axis alignment via alignItems.
            // 2. If we are block level (standard flow), the wrapper handles textAlign.
            // 3. Margin should be handled by commonStyle layout props (handled outside or via wrapper style if we want margins).

            // "Padding" in the context of a button usually means INNER padding (size of button).
            // "Margin" would be outer spacing.
            // Currently, `styles.paddingTop` etc are being applied to `commonStyle` which might be the wrapper.
            // We need to apply `styles.padding...` to the BUTTON itself for sizing.

            // Destructure padding from commonStyle to prevent it from being on the wrapper if we want it on the button
            const { padding, paddingTop, paddingBottom, paddingLeft, paddingRight, ...wrapperStyle } = commonStyle;

            return (
                <div style={{
                    ...wrapperStyle, // Apply width, height, margins, etc to wrapper
                    padding: 0, // Reset padding on wrapper so it doesn't inflate the container unexpectedly
                    textAlign: alignStyle, // Control horizontal alignment of the inline-block button
                    display: styles.width === '100%' ? 'block' : 'block', // Ensure wrapper takes full width to allow text-align to work
                }}>
                    <a
                        href={content.url || '#'}
                        onClick={e => !content.url && e.preventDefault()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: styles.width === '100%' ? 'block' : 'inline-block', // Full width or natural width
                            backgroundColor: styles.backgroundColor || '#000000',
                            color: styles.color || '#ffffff',
                            padding: `${styles.paddingTop ?? 14}px ${styles.paddingRight ?? 28}px ${styles.paddingBottom ?? 14}px ${styles.paddingLeft ?? 28}px`, // Apply padding to button for size
                            borderRadius: `${styles.borderRadius ?? 12}px`,
                            borderWidth: styles.borderWidth ? `${styles.borderWidth}px` : undefined,
                            borderColor: styles.borderColor || undefined,
                            borderStyle: styles.borderStyle || undefined,
                            fontSize: `${styles.fontSize || 15}px`,
                            fontWeight: styles.fontWeight || '600',
                            textDecoration: styles.textDecoration || 'none',
                            textTransform: styles.textTransform as any,
                            fontStyle: styles.fontStyle as any,
                            letterSpacing: styles.letterSpacing ? `${styles.letterSpacing}px` : undefined,
                            lineHeight: styles.lineHeight ? String(styles.lineHeight) : undefined,
                            fontFamily: styles.fontFamily || 'inherit',
                            transition: 'all 0.2s ease',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            textAlign: 'center', // Center text INSIDE the button
                            width: styles.width === '100%' ? '100%' : 'auto',
                        }}
                    >
                        {content.text || 'Get Started Now'}
                    </a>
                </div>
            );

        case 'image':
            const hasVariable = content.src?.includes('{{');

            return (
                <div style={{ ...commonStyle, textAlign: (styles.textAlign as any) || 'center' }}>
                    {content.src && !hasVariable && (
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
                    )}

                    {/* Show placeholder if no src OR if it contains a variable pattern */}
                    {(!content.src || hasVariable) && (
                        <div className="group relative w-full aspect-video bg-zinc-100 dark:bg-zinc-800 rounded flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700 overflow-hidden"
                            style={{ minHeight: '200px', borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined }}>

                            {content.src ? (
                                <>
                                    <div className="absolute inset-0 bg-[var(--color-primary)]/5 flex flex-col items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl mb-2 text-[var(--color-primary)] opacity-50">data_object</span>
                                        <span className="font-mono text-sm font-bold text-[var(--color-primary)] bg-white/50 px-2 py-1 rounded border border-[var(--color-primary)]/20">
                                            {content.src}
                                        </span>
                                    </div>
                                    <p className="absolute bottom-4 text-xs text-zinc-500 font-medium">Variable Image</p>
                                </>
                            ) : (
                                !preview && (
                                    <>
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-20">image</span>
                                        <span className="text-sm font-medium opacity-50">Image Placeholder</span>
                                    </>
                                )
                            )}
                        </div>
                    )}
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
                                style={{
                                    color: styles.color || 'inherit',
                                    textDecoration: styles.textDecoration || undefined,
                                    textTransform: styles.textTransform as any,
                                }}
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
                                className="flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                style={{
                                    width: styles.fontSize ? `calc(${styles.fontSize}px * 2)` : '40px',
                                    height: styles.fontSize ? `calc(${styles.fontSize}px * 2)` : '40px',
                                    color: styles.color || 'inherit'
                                }}
                            >
                                <svg
                                    style={{
                                        width: styles.fontSize ? `${styles.fontSize}px` : '20px',
                                        height: styles.fontSize ? `${styles.fontSize}px` : '20px'
                                    }}
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
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
            if (preview) {
                return (
                    <div style={{
                        ...commonStyle,
                        display: 'flex',
                        flexDirection: styles.flexDirection || 'column',
                        justifyContent: styles.justifyContent || 'flex-start',
                        alignItems: styles.alignItems || 'stretch',
                        gap: `${styles.gap ?? 0}px`,
                        minHeight: styles.height
                    }}>
                        {content.children?.map((child) => (
                            <BlockRenderer key={child.id} block={child} preview={true} />
                        ))}
                    </div>
                );
            }
            return (
                <div style={{
                    ...commonStyle,
                    minHeight: styles.height || '40px',
                    border: '1px dashed #e5e5e5',
                    // padding: '8px' removed to allow user control
                }}>
                    <div className="text-[9px] uppercase tracking-widest text-zinc-300 font-bold mb-1">Div Container</div>
                    {/* Simplified preview for DragOverlay */}
                    {content.children?.map((child, i) => (
                        <div key={i} className="mb-1 p-1 bg-zinc-50 border border-zinc-100 rounded text-[8px] truncate">{child.type}</div>
                    ))}
                </div>
            );

        case 'flex':
            if (preview) {
                return (
                    <div style={{
                        ...commonStyle,
                        display: 'flex',
                        flexDirection: styles.flexDirection || 'row',
                        flexWrap: styles.flexWrap || 'wrap',
                        justifyContent: styles.justifyContent || 'flex-start',
                        alignItems: styles.alignItems || 'stretch',
                        gap: `${styles.gap ?? 10}px`,
                    }}>
                        {content.children?.map((child) => (
                            <BlockRenderer key={child.id} block={child} preview={true} />
                        ))}
                    </div>
                );
            }
            return (
                <div style={{
                    ...commonStyle,
                    display: 'flex',
                    flexDirection: styles.flexDirection || 'row',
                    flexWrap: styles.flexWrap || 'wrap',
                    justifyContent: styles.justifyContent || 'flex-start',
                    alignItems: styles.alignItems || 'stretch',
                    gap: `${styles.gap ?? 10}px`,
                    minHeight: '60px',
                    border: '1px dashed #e5e5e5',
                    // padding: '8px' removed to allow user control
                }}>
                    <div className="w-full text-[9px] uppercase tracking-widest text-zinc-300 font-bold mb-1">Flex Container</div>
                    {content.children?.map((child, i) => (
                        <div key={i} className="p-1 bg-zinc-50 border border-zinc-100 rounded text-[8px] truncate">{child.type}</div>
                    ))}
                </div>
            );

        case 'columns':
            if (preview) {
                return (
                    <div style={{
                        ...commonStyle,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${content.columns?.length || 2}, 1fr)`,
                        gap: `${styles.gap ?? 20}px`,
                        justifyContent: styles.justifyContent || 'flex-start',
                        alignItems: styles.alignItems || 'stretch',
                    }}>
                        {content.columns?.map((col, idx) => (
                            <div key={idx} style={{
                                minHeight: '1px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: styles.justifyContent || 'flex-start',
                                alignItems: styles.alignItems || 'stretch',
                                gap: `${styles.gap ?? 0}px`
                            }}>
                                {col.children?.map((child) => (
                                    <BlockRenderer key={child.id} block={child} preview={true} />
                                ))}
                            </div>
                        ))}
                    </div>
                );
            }
            return (
                <div style={{
                    ...commonStyle,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${content.columns?.length || 2}, 1fr)`,
                    gap: `${styles.gap ?? 20}px`,
                    minHeight: '60px',
                    border: '1px dashed #e5e5e5',
                    // padding: '8px' removed to allow user control
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
