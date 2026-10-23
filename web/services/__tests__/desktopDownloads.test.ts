import { describe, expect, it } from 'vitest';
import { desktopDownloadUrl, detectDesktopOS } from '../desktopDownloads';

describe('detectDesktopOS', () => {
    const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });

    it('detects macOS and Windows desktop browsers', () => {
        expect(detectDesktopOS(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130'))).toBe('mac');
        expect(detectDesktopOS(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130'))).toBe('windows');
    });

    it('ignores phones, iPads (Macintosh UA with touch) and Linux', () => {
        expect(detectDesktopOS(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile'))).toBeNull();
        expect(detectDesktopOS(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 5))).toBeNull();
        expect(detectDesktopOS(nav('Mozilla/5.0 (Linux; Android 15) Mobile'))).toBeNull();
        expect(detectDesktopOS(nav('Mozilla/5.0 (X11; Linux x86_64) Chrome/130'))).toBeNull();
    });

    it('builds stable latest-release links', () => {
        expect(desktopDownloadUrl('mac')).toBe('https://github.com/ChristophLabestin/projectflow-app/releases/latest/download/ProjectFlow-mac.dmg');
        expect(desktopDownloadUrl('windows')).toMatch(/ProjectFlow-Setup\.exe$/);
    });
});
