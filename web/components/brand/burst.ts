import { prefersReducedMotion } from './motion';
import './brand.scss';

/**
 * Success moment: four brand dots burst from the centre of `element` (e.g. a task's check button).
 * Rendered on <body> with fixed positioning, so it survives the row re-rendering or moving to another
 * group when the task is completed. Skipped under reduced motion.
 */
export const playCompletionBurst = (element: Element | null) => {
    if (!element || prefersReducedMotion()) return;
    const rect = element.getBoundingClientRect();
    const burst = document.createElement('span');
    burst.className = 'brand-burst brand-burst--fixed';
    burst.setAttribute('aria-hidden', 'true');
    burst.style.left = `${rect.left + rect.width / 2}px`;
    burst.style.top = `${rect.top + rect.height / 2}px`;
    for (let index = 0; index < 4; index += 1) burst.appendChild(document.createElement('i'));
    document.body.appendChild(burst);
    window.setTimeout(() => burst.remove(), 700);
};
