import { createRoot } from 'react-dom/client';

import '../../../web/app/globals.css';
import { App } from './App';
import { installDesktopApiFetch } from './api';

installInitialThemeClass();
installDesktopApiFetch();

const root = document.getElementById('root');
if (root == null) {
  throw new Error('Missing #root');
}

createRoot(root).render(<App />);

function installInitialThemeClass(): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.add(prefersDark ? 'dark' : 'light');
}
