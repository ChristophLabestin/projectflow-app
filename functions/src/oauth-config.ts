/**
 * Public URLs of the OAuth authorization server and the MCP resource. Production: issuer and consent on
 * app.getprojectflow.com (Hosting rewrites → functions `oauth` / `mcp`); the MCP resource is whichever
 * ProjectFlow host the client called. Emulator: everything derives from the emulator host.
 */
import { MCP_RESOURCES } from './oauth-core';

const REGION = 'europe-west3';
export const APP_ORIGIN = 'https://app.getprojectflow.com';

/**
 * Human docs linked from the OAuth / protected-resource metadata. Points to the in-app setup page until
 * getprojectflow.com/docs/mcp is live on the landing site; then set MCP_DOCS_URL (functions env) or change
 * the default (brain/operations/domains-setup.md).
 */
export const MCP_DOCS_URL = process.env.MCP_DOCS_URL || `${APP_ORIGIN}/?openSettings=ai`;

const isEmulator = () => process.env.FUNCTIONS_EMULATOR === 'true';
const projectId = () => process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-projectflow';

const requestHost = (req: any) =>
    String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();

const emulatorBase = (req: any, fn: string) => `http://${requestHost(req)}/${projectId()}/${REGION}/${fn}`;

export const issuerFor = (req: any) => (isEmulator() ? emulatorBase(req, 'oauth') : APP_ORIGIN);

export const consentUrl = (requestId: string) =>
    `${isEmulator() ? process.env.OAUTH_APP_ORIGIN || 'http://localhost:5173' : APP_ORIGIN}/oauth/consent?request=${encodeURIComponent(requestId)}`;

export const mcpResourceFor = (req: any) => {
    if (isEmulator()) return emulatorBase(req, 'mcp');
    const candidate = `https://${requestHost(req)}/mcp`;
    return MCP_RESOURCES.includes(candidate) ? candidate : `${APP_ORIGIN}/mcp`;
};

/** RFC 9728 metadata URL for a resource (path-inserted well-known URL; emulator: served by the mcp function). */
export const protectedResourceMetadataUrl = (req: any) => {
    if (isEmulator()) return `${emulatorBase(req, 'mcp')}/.well-known/oauth-protected-resource`;
    const resource = new URL(mcpResourceFor(req));
    return `${resource.origin}/.well-known/oauth-protected-resource${resource.pathname}`;
};

export const acceptedResources = (req: any) => (isEmulator() ? [emulatorBase(req, 'mcp')] : MCP_RESOURCES);
