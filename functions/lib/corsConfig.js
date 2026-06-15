"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = exports.ALLOWED_ORIGINS = void 0;
const cors = require("cors");
// Origins allowed to make credentialed cross-origin requests to the callable/
// HTTP functions. Custom domain + the project's default Firebase Hosting
// domains + local dev. Extra origins can be added via the CORS_EXTRA_ORIGINS
// env var (comma-separated) without a code change.
const STATIC_ALLOWED_ORIGINS = [
    'https://app.getprojectflow.com',
    'https://www.getprojectflow.com',
    'https://getprojectflow.com',
    'https://project-manager-9d0ad.web.app',
    'https://project-manager-9d0ad.firebaseapp.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173',
];
const envOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
exports.ALLOWED_ORIGINS = Array.from(new Set([...STATIC_ALLOWED_ORIGINS, ...envOrigins]));
const isEmulator = () => process.env.FUNCTIONS_EMULATOR === 'true';
exports.corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (mobile apps, curl, server-to-server) that
        // send no Origin header.
        if (!origin)
            return callback(null, true);
        // Keep the local emulator permissive for development.
        if (isEmulator() || exports.ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        // Reject everything else. The cors middleware omits the
        // Access-Control-Allow-Origin header, so the browser blocks the response.
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
});
//# sourceMappingURL=corsConfig.js.map