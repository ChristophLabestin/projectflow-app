import { afterEach, describe, expect, it } from 'vitest';
import { getDesktopBridge, hasDesktopCapability, isDesktop, isDesktopQuickAccessWindow, pinnedItemPath, type DesktopBridge } from '../desktop';

const fakeBridge = (overrides: Partial<DesktopBridge> = {}) => ({
    apiVersion: 1,
    capabilities: ['titlebar', 'popout'],
    platform: 'darwin',
    windowKind: 'main',
    isDev: true,
    ...overrides
}) as DesktopBridge;

describe('desktop bridge helpers', () => {
    afterEach(() => {
        delete window.projectflowDesktop;
    });

    it('is a no-op in the browser', () => {
        expect(getDesktopBridge()).toBeNull();
        expect(isDesktop()).toBe(false);
        expect(hasDesktopCapability('popout')).toBe(false);
        expect(isDesktopQuickAccessWindow()).toBe(false);
    });

    it('feature-detects capabilities of older shells', () => {
        window.projectflowDesktop = fakeBridge();
        expect(isDesktop()).toBe(true);
        expect(hasDesktopCapability('popout')).toBe(true);
        expect(hasDesktopCapability('tray')).toBe(false);
    });

    it('recognises the quick access pop-out window', () => {
        window.projectflowDesktop = fakeBridge({ windowKind: 'quick-access' });
        expect(isDesktopQuickAccessWindow()).toBe(true);
    });
});

describe('pinnedItemPath', () => {
    it('builds app paths for the tray and notifications', () => {
        expect(pinnedItemPath({ id: 't1', type: 'task', projectId: 'p1' })).toBe('/project/p1/tasks/t1');
        expect(pinnedItemPath({ id: 'i1', type: 'initiative', projectId: 'p1' })).toBe('/project/p1/initiatives/i1');
        expect(pinnedItemPath({ id: 'x', type: 'personal-task', projectId: '' })).toBe('/personal-tasks/x');
        expect(pinnedItemPath({ id: 't2', type: 'task', projectId: '' })).toBeNull();
    });
});
