/**
 * Runtime options for user-facing gen 1 functions (login, billing, invitations, legal, MCP/OAuth).
 * Gen 1 CPU scales with memory (256 MB ≈ 400 MHz, 1 GB ≈ 1.4 GHz) and module loading is
 * CPU-bound, so 1 GB cuts cold starts noticeably. Billed only while running.
 * See brain/operations/functions-performance.md.
 */
export const FAST_START = { memory: '1GB' } as const;
