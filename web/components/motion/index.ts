// Motion primitives (STYLING.md §4.1). CSS side: styles/_motion.scss, tokens --motion-* in _tokens.scss.
// All primitives use transform/opacity only and fall back to the end state under reduced motion.
export { prefersReducedMotion } from '../brand/motion';
export { usePresence } from './usePresence';
export { useFlipList } from './useFlipList';
export { useMotionOnChange } from './useMotionOnChange';
export { useSlidingIndicator } from './useSlidingIndicator';
export { AnimatedNumber } from './AnimatedNumber';
export { MOTION } from './tokens';
