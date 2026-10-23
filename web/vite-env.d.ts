/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Firebase
    readonly VITE_USE_FIREBASE_EMULATORS?: string;
    readonly VITE_CORA_STUDIO_ENABLED?: string;
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID: string;
    readonly VITE_FIREBASE_VAPID_KEY: string;
    readonly VITE_FIREBASE_DATABASE_URL: string;

    // Cloud Functions
    readonly VITE_CLOUD_FUNCTIONS_URL: string;
    readonly VITE_CLOUD_FUNCTIONS_BASE_URL: string;

    // Feature flags
    readonly VITE_PM_CORE_ONLY: string;
    readonly VITE_SIDEBAR_V2: string;

    // Integrations
    readonly VITE_UNSPLASH_ACCESS_KEY: string;
    readonly VITE_GEMINI_API_KEY: string;

    // Error monitoring (Sentry)
    readonly VITE_SENTRY_DSN: string;
    readonly VITE_SENTRY_ENVIRONMENT: string;
    readonly VITE_SENTRY_TRACES_SAMPLE_RATE: string;
    readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare const __PF_BUILD__: string;
