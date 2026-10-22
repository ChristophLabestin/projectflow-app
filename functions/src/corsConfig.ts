import * as cors from 'cors';

// Origins allowed to make credentialed cross-origin requests to the callable/
// HTTP functions. Custom domain + the project's default Firebase Hosting
// domains + local dev. Extra origins can be added via the CORS_EXTRA_ORIGINS
// env var (comma-separated) without a code change.
const STATIC_ALLOWED_ORIGINS = [
    'https://app.getprojectflow.com',
    'https://www.getprojectflow.com',
    'https://getprojectflow.com',
    'https://projectflow-labestin.web.app',
    'https://projectflow-labestin.firebaseapp.com',
];

const isEmulatorEnv = process.env.FUNCTIONS_EMULATOR === 'true';

// Local dev origins are only allowed when running in the emulator.
const LOCAL_DEV_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173',
];

const envOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export const ALLOWED_ORIGINS = Array.from(
    new Set([...STATIC_ALLOWED_ORIGINS, ...(isEmulatorEnv ? LOCAL_DEV_ORIGINS : []), ...envOrigins]),
);

const isEmulator = () => process.env.FUNCTIONS_EMULATOR === 'true';

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (mobile apps, curl, server-to-server) that
        // send no Origin header.
        if (!origin) return callback(null, true);

        // Keep the local emulator permissive for development.
        if (isEmulator() || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            return callback(null, true);
        }

        // Reject everything else. The cors middleware omits the
        // Access-Control-Allow-Origin header, so the browser blocks the response.
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
});
