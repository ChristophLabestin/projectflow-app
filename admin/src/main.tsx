import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.scss';

const stored = localStorage.getItem('pf.admin.theme');
document.documentElement.classList.toggle('dark', stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
