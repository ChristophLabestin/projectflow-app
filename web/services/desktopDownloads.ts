/**
 * Desktop app downloads (GitHub Releases of this repo, built by .github/workflows/desktop-release.yml).
 * Artifact names are version-less, so `releases/latest/download/<name>` is a stable link. The release API is
 * only used to know whether a release (with the file for this OS) exists yet and which version it is.
 */
import { useEffect, useState } from 'react';
import { isDesktop } from './desktop';

const REPO = 'ChristophLabestin/projectflow-app';
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const DESKTOP_RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const CACHE_KEY = 'pf_desktop_release_cache_v2';
const CACHE_MS = 6 * 60 * 60 * 1000;

export type DesktopOS = 'mac' | 'windows';

export const DESKTOP_ASSETS: Record<DesktopOS, string> = {
    mac: 'ProjectFlow-mac.dmg',
    windows: 'ProjectFlow-Setup.exe'
};

export interface DesktopRelease {
    version: string;
    publishedAt: string | null;
    assets: string[];
    /** Download size in bytes per asset name. */
    sizes: Record<string, number>;
}

/** macOS or Windows desktop browsers only (iPad reports "Macintosh" but has touch). */
export const detectDesktopOS = (nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): DesktopOS | null => {
    const ua = nav.userAgent || '';
    if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return null;
    if (/Macintosh|Mac OS X/i.test(ua)) return nav.maxTouchPoints > 1 ? null : 'mac';
    if (/Windows NT/i.test(ua)) return 'windows';
    return null;
};

export const desktopDownloadUrl = (os: DesktopOS) => `https://github.com/${REPO}/releases/latest/download/${DESKTOP_ASSETS[os]}`;

const readCache = (): { at: number; release: DesktopRelease | null } | null => {
    try {
        const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        return parsed && Date.now() - parsed.at < CACHE_MS ? parsed : null;
    } catch {
        return null;
    }
};

let inflight: Promise<DesktopRelease | null> | null = null;

/** Latest published desktop release, or null while none exists (cached for a few hours, GitHub rate limits). */
export const fetchLatestDesktopRelease = (): Promise<DesktopRelease | null> => {
    const cached = readCache();
    if (cached) return Promise.resolve(cached.release);
    if (inflight) return inflight;
    inflight = fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
        .then(async (response) => {
            if (!response.ok) return null;
            const data = await response.json() as { tag_name?: string; published_at?: string; assets?: { name: string; size?: number }[] };
            const assets = data.assets || [];
            return {
                version: (data.tag_name || '').replace(/^v/, ''),
                publishedAt: data.published_at || null,
                assets: assets.map((asset) => asset.name),
                sizes: Object.fromEntries(assets.map((asset) => [asset.name, asset.size || 0]))
            } satisfies DesktopRelease;
        })
        .catch(() => null)
        .then((release) => {
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release })); } catch { /* ignore */ }
            inflight = null;
            return release;
        });
    return inflight;
};

/** Download offer for the current browser: null in the desktop app, on mobile/Linux or before a release exists. */
export const useDesktopDownload = () => {
    const [offer, setOffer] = useState<{ os: DesktopOS; version: string; url: string } | null>(null);
    useEffect(() => {
        if (isDesktop()) return;
        const os = detectDesktopOS();
        if (!os) return;
        let mounted = true;
        void fetchLatestDesktopRelease().then((release) => {
            if (!mounted || !release || !release.assets.includes(DESKTOP_ASSETS[os])) return;
            setOffer({ os, version: release.version, url: desktopDownloadUrl(os) });
        });
        return () => { mounted = false; };
    }, []);
    return offer;
};

/** Latest release + detected OS for the download page (also works in the desktop app and on mobile). */
export const useDesktopRelease = () => {
    const [state, setState] = useState<{ loading: boolean; release: DesktopRelease | null }>({ loading: true, release: null });
    useEffect(() => {
        let mounted = true;
        void fetchLatestDesktopRelease().then((release) => { if (mounted) setState({ loading: false, release }); });
        return () => { mounted = false; };
    }, []);
    return { ...state, os: typeof navigator === 'undefined' ? null : detectDesktopOS() };
};

export const formatDownloadSize = (bytes: number | undefined, locale: string) => (
    bytes ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(bytes / (1024 * 1024))} MB` : ''
);

/** In-app route of the download page. */
export const DESKTOP_DOWNLOAD_PATH = '/download';
