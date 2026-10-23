import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// Production builds without the Firebase web config ship a blank app ("auth/invalid-api-key"), e.g. when
// deployed from a checkout without web/.env.local. Fail the build instead of deploying it.
const REQUIRED_PRODUCTION_ENV = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID'
];

const requireFirebaseConfig = (env: Record<string, string>): Plugin => ({
    name: 'projectflow-require-firebase-config',
    apply: 'build',
    buildStart() {
        const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !env[key]?.trim());
        if (missing.length) {
            this.error(`Missing Firebase config for the production build: ${missing.join(', ')}. `
                + 'Set them in web/.env.local (or the CI secrets) before building/deploying.');
        }
    }
});

// Crash reports carry this build id as `release` (web/services/errorReporting.ts). Production builds emit hidden
// source maps and move them out of dist/ (never deployed) into PF_SOURCEMAP_DIR/<release>/ for
// functions/scripts/crash-symbolicate.mjs.
const BUILD_ID = new Date().toISOString().slice(0, 16);
const SOURCEMAP_DIR = process.env.PF_SOURCEMAP_DIR
    || path.join(os.homedir(), 'Library', 'Application Support', 'ProjectFlow', 'sourcemaps');

const stashSourceMaps = (): Plugin => ({
    name: 'projectflow-stash-sourcemaps',
    apply: 'build',
    closeBundle() {
        const outDir = path.resolve(__dirname, 'dist');
        const target = path.join(SOURCEMAP_DIR, BUILD_ID.replace(/:/g, '-'));
        const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
            .flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
        const maps = fs.existsSync(outDir) ? walk(outDir).filter((file) => file.endsWith('.map')) : [];
        for (const file of maps) {
            const dest = path.join(target, path.relative(outDir, file));
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(file, dest);
            fs.rmSync(file);
        }
        if (maps.length) console.log(`[crash] ${maps.length} source maps for release ${BUILD_ID} → ${target}`);
    }
});

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';
    const env = loadEnv(mode, __dirname, 'VITE_');
    return {
      cacheDir: '.vite',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), ...(isProd ? [requireFirebaseConfig(env), stashSourceMaps()] : [])],
      // Some deps/legacy code read process.env.*; resolve to an empty object instead of a runtime shim.
      // __PF_BUILD__ identifies the web build in legal consent records (platform web/desktop) and crash reports.
      define: { 'process.env': {}, __PF_BUILD__: JSON.stringify(BUILD_ID) },
      // Strip noisy debug logging from production bundles. console.warn/error are
      // kept so genuine problems still surface.
      esbuild: isProd
        ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'] }
        : undefined,
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Hidden: no sourceMappingURL comment; the maps are stashed by stashSourceMaps, not deployed.
        sourcemap: isProd ? 'hidden' : false,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('commonjsHelpers.js')) return 'commonjs-helpers';

              if (id.includes('node_modules')) {
                if (id.includes('react-router-dom')) return 'router';
                if (/node_modules[\\/]react-dom[\\/]/.test(id)) return 'react-core';
                if (/node_modules[\\/](react|scheduler)[\\/]/.test(id)) return 'react-core';
                if (id.includes('firebase/auth')) return 'firebase-auth';
                if (id.includes('firebase/firestore')) return 'firebase-firestore';
                if (id.includes('firebase/functions')) return 'firebase-functions';
                if (id.includes('firebase/storage')) return 'firebase-storage';
                if (id.includes('firebase/')) return 'firebase-core';
                if (id.includes('@dnd-kit/')) return 'drag-vendor';
                if (id.includes('canvas-confetti')) return 'celebration';
                if (id.includes('recharts')) return 'charts';
                if (id.includes('react-colorful')) return 'color-tools';
                if (id.includes('react-image-crop')) return 'media-tools';
                if (id.includes('qrcode') || id.includes('@simplewebauthn/')) return 'data-tools';
                // One editor chunk: split core/extension chunks import each other in a cycle and the
                // extensions then evaluate before @tiptap/core (`Extension.create` of undefined → blank app).
                if (
                  id.includes('@tiptap/') ||
                  id.includes('prosemirror') ||
                  id.includes('lowlight') ||
                  id.includes('highlight.js')
                ) {
                  return 'editor-vendor';
                }
                if (id.includes('tippy.js')) return 'overlay-vendor';
                if (id.includes('date-fns') || id.includes('lucide-react') || id.includes('framer-motion')) {
                  return 'ui-vendor';
                }
                return undefined;
              }

              if (
                id.includes('/web/screens/marketing/components/email-builder/PropertiesPanel.tsx') ||
                id.includes('/web/screens/marketing/components/email-builder/LayerTree.tsx') ||
                id.includes('/web/screens/marketing/components/email-builder/GlobalSettingsPanel.tsx') ||
                id.includes('/web/screens/marketing/components/email-builder/VariableManager.tsx')
              ) {
                return 'email-builder-panels';
              }

              if (
                id.includes('/web/screens/marketing/components/email-builder/RichTextModal.tsx') ||
                id.includes('/web/screens/marketing/components/email-builder/RichTextEditor.tsx') ||
                id.includes('/web/screens/marketing/components/email-builder/VariablePicker.tsx')
              ) {
                return 'email-builder-richtext';
              }

              if (id.includes('/web/components/editor/extensions/')) {
                return 'editor-extensions';
              }

              if (
                id.includes('/web/components/editor/AdvancedEditorCore.tsx') ||
                id.includes('/web/components/editor/editorStyles.css')
              ) {
                return 'editor-runtime';
              }

              if (id.includes('/web/components/editor/AdvancedEditorImageModal.tsx')) {
                return 'editor-overlays';
              }

              if (
                id.includes('/web/locales/profile-en.ts') ||
                id.includes('/web/locales/profile-de.ts')
              ) {
                return 'profile-i18n';
              }

              if (id.includes('/web/locales/help/')) {
                return id.includes('-de.ts') ? 'help-content-de' : 'help-content-en';
              }

              if (
                id.includes('/web/locales/team-en.ts') ||
                id.includes('/web/locales/team-de.ts')
              ) {
                return 'team-i18n';
              }

              if (
                id.includes('/web/locales/calendar-en.ts') ||
                id.includes('/web/locales/calendar-de.ts')
              ) {
                return 'calendar-i18n';
              }

              if (
                id.includes('/web/locales/auth-action-en.ts') ||
                id.includes('/web/locales/auth-action-de.ts')
              ) {
                return 'auth-action-i18n';
              }

              if (
                id.includes('/web/locales/auth-screen-en.ts') ||
                id.includes('/web/locales/auth-screen-de.ts')
              ) {
                return 'auth-screen-i18n';
              }

              if (
                id.includes('/web/locales/dashboard-en.ts') ||
                id.includes('/web/locales/dashboard-de.ts')
              ) {
                return 'dashboard-i18n';
              }

              if (
                id.includes('/web/locales/project-overview-en.ts') ||
                id.includes('/web/locales/project-overview-de.ts')
              ) {
                return 'project-overview-i18n';
              }

              if (
                id.includes('/web/locales/settings-en.ts') ||
                id.includes('/web/locales/settings-de.ts')
              ) {
                return 'settings-i18n';
              }

              // LanguageContext pulls in firebase auth/data services; keep it out of the
              // locale chunk (and in the default chunk) to avoid circular chunks.
              if (id.includes('/web/locales/')) {
                return 'app-i18n';
              }

              if (
                id.includes('/web/screens/marketing/') ||
                id.includes('/web/services/marketingSettingsService') ||
                id.includes('/web/services/blogService')
              ) {
                return 'marketing';
              }

              if (id.includes('/web/services/dataService.ts')) {
                return 'data-service';
              }

              return undefined;
            },
          },
        },
      },
      test: {
        environment: 'jsdom',
        setupFiles: './test/setup.ts',
        globals: true,
        cacheDir: './.vitest',
        include: ['**/__tests__/**/*.test.{ts,tsx}'],
        exclude: [...configDefaults.exclude, '**/e2e/**'],
      }
    };
});
