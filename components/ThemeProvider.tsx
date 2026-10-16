'use client';

import { useEffect, type ReactNode } from 'react';
import { loadPrefs } from '@/lib/prefs';
import { useStore } from '@/lib/store';

/** Applies saved preferences once, then mirrors the store's theme onto `html[data-theme]`. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useStore(s => s.theme);
  useEffect(() => { loadPrefs(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return <>{children}</>;
}
