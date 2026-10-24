// Lean entry for public forms (/f/:token, brain/plans/forms-concept.md §5): no app shell, no Firebase SDK,
// no app dictionaries. Firebase Hosting rewrites /f/** to form.html; Vite dev does the same (vite.config.ts).
import React from 'react';
import { createRoot } from 'react-dom/client';

import { PublicFormPage } from './PublicFormPage';

const root = document.getElementById('form-root');
if (root) createRoot(root).render(<React.StrictMode><PublicFormPage /></React.StrictMode>);
