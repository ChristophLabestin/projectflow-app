import fs from 'node:fs';
import path from 'node:path';

/**
 * Local shell pages (launch scene, offline page) as `data:` URLs. Packaged builds flip the
 * GrantFileProtocolExtraPrivileges fuse off, and Chromium's plain file:// handler cannot read inside app.asar
 * (ERR_FILE_NOT_FOUND), so `loadFile` of an asset fails there. Node's fs can: the HTML is read here, referenced
 * SVGs (`url(name.svg)`) are inlined, and parameters travel in the fragment (pages read `location.hash`).
 */
const ASSETS = path.join(__dirname, '..', 'assets');
const cache = new Map<string, string>();

const inlineSvgs = (html: string) => html.replace(/url\(([\w.-]+\.svg)\)/g, (_match, file: string) => {
    const svg = fs.readFileSync(path.join(ASSETS, file)).toString('base64');
    return `url("data:image/svg+xml;base64,${svg}")`;
});

export const localPageUrl = (name: 'splash.html' | 'offline.html', params: Record<string, string>) => {
    let html = cache.get(name);
    if (!html) {
        html = inlineSvgs(fs.readFileSync(path.join(ASSETS, name), 'utf8'));
        cache.set(name, html);
    }
    return `data:text/html;charset=utf-8;base64,${Buffer.from(html).toString('base64')}#${new URLSearchParams(params).toString()}`;
};
