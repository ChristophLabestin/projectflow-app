import type { HandlerMap } from './types';
import { contentHandlers } from './modules/content';
import { crashHandlers } from './modules/crashes';
import { legalHandlers } from './modules/legal';
import { opsHandlers } from './modules/ops';
import { overviewHandlers } from './modules/overview';
import { peopleHandlers } from './modules/people';

/** Feature handlers of the admin console, loaded lazily on the first adminApi call. */
export const handlers: HandlerMap = {
    ...crashHandlers,
    ...legalHandlers,
    ...contentHandlers,
    ...overviewHandlers,
    ...peopleHandlers,
    ...opsHandlers,
};
