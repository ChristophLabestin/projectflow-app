import { flushSync } from 'react-dom';

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Runs a React state update inside a View Transition when the browser supports
 * it (Chrome/Edge 111+, Safari 18+); otherwise it just applies the update.
 *
 * `kind` is exposed as `html[data-view-transition="<kind>"]` while the
 * transition runs, so SCSS can scope `view-transition-name`s and
 * `::view-transition-*` animations to this one transition.
 * `afterUpdate` runs once the DOM is updated (e.g. to fix the scroll position)
 * and before the new state is captured.
 */
export const runViewTransition = (kind: string, update: () => void, afterUpdate?: () => void) => {
    const doc = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!doc.startViewTransition || reduceMotion) {
        flushSync(update);
        afterUpdate?.();
        return;
    }

    const root = document.documentElement;
    root.dataset.viewTransition = kind;
    const transition = doc.startViewTransition(() => {
        flushSync(update);
        afterUpdate?.();
    });
    transition.finished.finally(() => {
        if (root.dataset.viewTransition === kind) delete root.dataset.viewTransition;
    });
};
