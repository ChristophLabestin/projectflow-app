import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

export default defineConfig(() => {
    return {
      cacheDir: '.vite',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
          output: {
            manualChunks(id) {
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
                if (id.includes('react-easy-crop') || id.includes('react-image-crop')) return 'media-tools';
                if (id.includes('papaparse') || id.includes('qrcode') || id.includes('@simplewebauthn/')) return 'data-tools';
                if (
                  id.includes('@tiptap/react') ||
                  id.includes('@tiptap/core') ||
                  id.includes('prosemirror')
                ) {
                  return 'editor-core';
                }
                if (
                  id.includes('@tiptap/') ||
                  id.includes('lowlight') ||
                  id.includes('highlight.js')
                ) {
                  return 'editor-vendor';
                }
                if (id.includes('tippy.js')) return 'overlay-vendor';
                if (id.includes('date-fns') || id.includes('lucide-react') || id.includes('framer-motion')) {
                  return 'ui-vendor';
                }
                return 'vendor';
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
                id.includes('/web/locales/finance-en.ts') ||
                id.includes('/web/locales/finance-de.ts')
              ) {
                return 'finance-i18n';
              }

              if (
                id.includes('/web/locales/profile-en.ts') ||
                id.includes('/web/locales/profile-de.ts')
              ) {
                return 'profile-i18n';
              }

              if (
                id.includes('/web/locales/team-en.ts') ||
                id.includes('/web/locales/team-de.ts')
              ) {
                return 'team-i18n';
              }

              if (
                id.includes('/web/locales/tasks-page-en.ts') ||
                id.includes('/web/locales/tasks-page-de.ts')
              ) {
                return 'tasks-page-i18n';
              }

              if (
                id.includes('/web/locales/calendar-en.ts') ||
                id.includes('/web/locales/calendar-de.ts')
              ) {
                return 'calendar-i18n';
              }

              if (
                id.includes('/web/locales/invite-landing-en.ts') ||
                id.includes('/web/locales/invite-landing-de.ts')
              ) {
                return 'invite-landing-i18n';
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
                id.includes('/web/locales/project-invite-en.ts') ||
                id.includes('/web/locales/project-invite-de.ts')
              ) {
                return 'project-invite-i18n';
              }

              if (
                id.includes('/web/locales/join-link-en.ts') ||
                id.includes('/web/locales/join-link-de.ts')
              ) {
                return 'join-link-i18n';
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

              if (
                id.includes('/web/locales/social-en.ts') ||
                id.includes('/web/locales/social-de.ts')
              ) {
                return 'social-i18n';
              }

              if (
                id.includes('/web/locales/flow-stages-en.ts') ||
                id.includes('/web/locales/flow-stages-de.ts')
              ) {
                return 'flow-stages-i18n';
              }

              if (
                id.includes('/web/locales/legal-en.ts') ||
                id.includes('/web/locales/legal-de.ts')
              ) {
                return 'legal-i18n';
              }

              if (
                id.includes('/web/context/LanguageContext.tsx') ||
                id.includes('/web/locales/')
              ) {
                return 'app-i18n';
              }

              if (
                id.includes('/web/screens/social/') ||
                id.includes('/web/services/domain/socialService.ts') ||
                id.includes('/web/services/domain/socialSettingsService.ts')
              ) {
                return 'social';
              }

              if (
                id.includes('/web/screens/marketing/') ||
                id.includes('/web/services/domain/marketingTemplatesService.ts') ||
                id.includes('/web/services/marketing') ||
                id.includes('/web/services/marketingSettingsService') ||
                id.includes('/web/services/recipientService') ||
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
