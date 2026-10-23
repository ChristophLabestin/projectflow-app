import React, { useCallback, useRef } from 'react';
import { useVisibleAnimationFrame } from './motion';
import './brand.scss';

/** The ProjectFlow glyph (same path as desktop/assets/glyph-mark.svg), drawn in currentColor. */
export const BrandGlyph = ({ className = '' }: { className?: string }) => (
    <svg className={`brand-glyph ${className}`.trim()} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z"
        />
    </svg>
);

type BrandMarkSize = 'sm' | 'md' | 'lg';
const GLYPH_PX: Record<BrandMarkSize, number> = { sm: 18, md: 30, lg: 46 };
const TILT = (-18 * Math.PI) / 180;

/**
 * Glyph on a floating disc with a soft brand-hue aurora and four orbiting status dots
 * (port of iOS PFBrandMark). Decorative; pair it with visible text.
 */
export const BrandMark = ({ size = 'md', className = '' }: { size?: BrandMarkSize; className?: string }) => {
    const rootRef = useRef<HTMLSpanElement>(null);
    const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);
    const glyph = GLYPH_PX[size];

    const frame = useCallback((time: number) => {
        dotRefs.current.forEach((dot, index) => {
            if (!dot) return;
            const angle = time * 0.85 + (index * Math.PI) / 2;
            const depth = Math.sin(angle);
            const ox = Math.cos(angle) * glyph * 1.3;
            const oy = Math.sin(angle) * glyph * 0.42;
            // In front of the disc on the near half of the ellipse, behind it on the far half.
            dot.style.zIndex = depth >= 0 ? '3' : '1';
            const scale = 0.75 + (0.35 * (depth + 1)) / 2;
            dot.style.opacity = String(0.55 + (0.45 * (depth + 1)) / 2);
            dot.style.transform = `translate(${ox * Math.cos(TILT) - oy * Math.sin(TILT)}px, ${ox * Math.sin(TILT) + oy * Math.cos(TILT)}px) scale(${scale})`;
        });
    }, [glyph]);

    useVisibleAnimationFrame(rootRef, frame);

    return (
        <span ref={rootRef} className={`brand-mark brand-mark--${size} ${className}`.trim()} aria-hidden="true">
            <span className="brand-mark__aurora" />
            <span className="brand-mark__ring" />
            <span className="brand-mark__disc" />
            <BrandGlyph className="brand-mark__glyph" />
            {[0, 1, 2, 3].map((index) => (
                <span key={index} ref={(node) => { dotRefs.current[index] = node; }} className={`brand-mark__dot brand-mark__dot--${index}`} />
            ))}
        </span>
    );
};
