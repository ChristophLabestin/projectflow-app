/** Motion tokens, mirrored from src/styles/_tokens.scss (seconds for GSAP). */
export const motion = {
    ease: 'expo.out', // ≈ --ease-out cubic-bezier(0.16, 1, 0.3, 1)
    easeInOut: 'power3.inOut', // ≈ --ease-in-out
    easeSpring: 'back.out(1.6)', // ≈ --ease-spring, micro feedback only
    dur1: 0.15,
    dur2: 0.3,
    dur3: 0.6,
    dur4: 0.9,
    stagger: 0.06,
    rise: 24,
} as const;

export const prefersMotion = (): boolean => document.documentElement.classList.contains('motion');
export const finePointer = (): boolean => matchMedia('(hover: hover) and (pointer: fine)').matches;
