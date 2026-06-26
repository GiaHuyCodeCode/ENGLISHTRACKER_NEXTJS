'use client';

import { useEffect, useState } from 'react';

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    <circle cx="17" cy="6" r="1" fill="currentColor" opacity="0.4" stroke="none"/>
  </svg>
);

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('et_theme') as 'dark' | 'light' | null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const applyTheme = (t: 'dark' | 'light') => {
    const html = document.documentElement;
    if (t === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
  };

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('et_theme', next);
    applyTheme(next);
  };

  if (!mounted) return null;

  const isDark = theme === 'dark';

  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-95"
        style={{
          background: isDark ? 'hsl(47 72% 58% / 0.12)' : 'hsl(340 60% 50% / 0.10)',
          border: isDark ? '1px solid hsl(47 72% 58% / 0.25)' : '1px solid hsl(340 60% 50% / 0.22)',
          color: isDark ? 'hsl(47 72% 65%)' : 'hsl(340 60% 45%)',
        }}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.97]"
      style={{
        background: isDark ? 'hsl(47 72% 58% / 0.10)' : 'hsl(150 30% 50% / 0.10)',
        border: isDark ? '1px solid hsl(47 72% 58% / 0.2)' : '1px solid hsl(150 30% 40% / 0.2)',
        color: isDark ? 'hsl(47 72% 62%)' : 'hsl(150 35% 30%)',
      }}
    >
      <span className="transition-transform duration-300" style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      {isDark ? 'Chế độ sáng' : 'Chế độ tối'}
    </button>
  );
}
