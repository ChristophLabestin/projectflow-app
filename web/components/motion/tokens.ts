/** JS mirror of the --motion-* tokens for the Web Animations API (keep in sync with _tokens.scss). */
export const MOTION = {
    instant: 90,
    fast: 140,
    base: 200,
    slow: 280,
    exit: 150,
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    spring: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
    stagger: 24,
    rise: 6,
} as const;
