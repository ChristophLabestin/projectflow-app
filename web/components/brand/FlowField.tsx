import React, { useCallback, useEffect, useRef } from 'react';
import { readBrandPalette, useVisibleAnimationFrame } from './motion';
import './brand.scss';

interface FlowFieldProps {
    /** Ripple origin as fractions of the field (default: centre). */
    originX?: number;
    originY?: number;
    /** Grid spacing in px. */
    spacing?: number;
    /** Seconds per ripple. */
    period?: number;
    /** `onDark` for fields on an always-dark surface (login hero). */
    tone?: 'auto' | 'onDark';
    className?: string;
}

/**
 * Dotted canvas with ripples in the four brand hues, coloured by direction from the origin
 * (port of iOS PFFlowField / desktop splash). Fills its positioned parent; decorative only.
 */
export const FlowField = ({ originX = 0.5, originY = 0.5, spacing = 20, period = 3.6, tone = 'auto', className = '' }: FlowFieldProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({ width: 0, height: 0, palette: [] as Array<[number, number, number]>, dot: '' });
    // Resizing the canvas clears it; keep the last frame time to repaint when paused or with reduced motion.
    const lastTimeRef = useRef(0.6);
    const drawRef = useRef<(time: number) => void>(() => undefined);

    const measure = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
        const style = getComputedStyle(canvas);
        stateRef.current = {
            width,
            height,
            palette: readBrandPalette(canvas),
            dot: tone === 'onDark' ? 'rgba(255, 255, 255, 0.08)' : style.getPropertyValue('--brand-field-dot').trim() || 'rgba(0, 0, 0, 0.06)'
        };
        drawRef.current(lastTimeRef.current);
    }, [tone]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(canvas);
        // Theme switches change --brand-field-dot.
        const themeObserver = new MutationObserver(measure);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        return () => {
            observer.disconnect();
            themeObserver.disconnect();
        };
    }, [measure]);

    const draw = useCallback((time: number) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const { width, height, palette, dot } = stateRef.current;
        lastTimeRef.current = time;
        if (!context || !width || !height || palette.length < 4) return;
        context.clearRect(0, 0, width, height);
        const band = spacing * 2.7;
        const ox = width * originX;
        const oy = height * originY;
        const reach = Math.hypot(Math.max(ox, width - ox), Math.max(oy, height - oy)) * 1.05;
        const phases = [0, 0.5].map((offset) => ((time / period) + offset) % 1);
        for (let y = spacing / 2; y < height; y += spacing) {
            for (let x = spacing / 2; x < width; x += spacing) {
                const dx = x - ox;
                const dy = y - oy;
                const distance = Math.hypot(dx, dy);
                let boost = 0;
                for (const phase of phases) {
                    const delta = Math.abs(distance - phase * reach);
                    if (delta < band) boost = Math.max(boost, (1 - delta / band) * (1 - phase));
                }
                if (boost > 0.04) {
                    const angle = Math.atan2(dy, dx) + Math.PI;
                    const [r, g, b] = palette[Math.floor((angle / (2 * Math.PI)) * 4) % 4];
                    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.18 + 0.62 * boost})`;
                } else {
                    context.fillStyle = dot;
                }
                context.beginPath();
                context.arc(x, y, 0.75 + 1.7 * boost, 0, Math.PI * 2);
                context.fill();
            }
        }
    }, [originX, originY, period, spacing]);
    drawRef.current = draw;

    useVisibleAnimationFrame(canvasRef, draw);

    return <canvas ref={canvasRef} className={`brand-flow-field ${className}`.trim()} aria-hidden="true" />;
};
