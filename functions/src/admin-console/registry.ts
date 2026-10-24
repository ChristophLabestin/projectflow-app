import { auditHandlers } from './audit';
import type { HandlerMap } from './types';

/** All feature handlers (console + admin MCP share them), loaded lazily on first use. */
let cache: HandlerMap | null = null;
export const featureHandlers = (): HandlerMap => (cache ??= {
    ...auditHandlers,
    ...require('./handlers').handlers,
    ...require('./mcp/admin-actions').mcpConsoleHandlers,
});
