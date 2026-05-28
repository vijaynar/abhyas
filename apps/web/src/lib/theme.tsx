'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// ── Theme Definitions ─────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export type ThemeName =
  | 'indigo-space'
  | 'emerald-forest'
  | 'rose-sunset'
  | 'amber-gold'
  | 'cyan-ocean'
  | 'violet-galaxy';

export interface ThemeDefinition {
  name: ThemeName;
  label: string;
  description: string;
  preview: [string, string, string]; // 3 gradient stops for swatch
  vars: {
    primary: string;
    primaryGlow: string;
    primaryHover: string;
    accent: string;
    accentGlow: string;
    panelBorder: string;
    glowIndigo: string;
    scrollThumb: string;
    scrollThumbHover: string;
    radialA: string;
    radialB: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    name: 'indigo-space',
    label: 'Indigo Space',
    description: 'Deep cosmic indigo — the default',
    preview: ['#6366f1', '#4f46e5', '#a855f7'],
    vars: {
      primary: '#6366f1',
      primaryGlow: 'rgba(99,102,241,0.5)',
      primaryHover: '#4f46e5',
      accent: '#a855f7',
      accentGlow: 'rgba(168,85,247,0.4)',
      panelBorder: 'rgba(99,102,241,0.15)',
      glowIndigo: '0 0 15px rgba(99,102,241,0.5)',
      scrollThumb: 'rgba(99,102,241,0.3)',
      scrollThumbHover: 'rgba(99,102,241,0.6)',
      radialA: 'rgba(99,102,241,0.12)',
      radialB: 'rgba(168,85,247,0.10)',
    },
  },
  {
    name: 'emerald-forest',
    label: 'Emerald Forest',
    description: 'Lush green with teal accents',
    preview: ['#10b981', '#059669', '#06b6d4'],
    vars: {
      primary: '#10b981',
      primaryGlow: 'rgba(16,185,129,0.5)',
      primaryHover: '#059669',
      accent: '#06b6d4',
      accentGlow: 'rgba(6,182,212,0.4)',
      panelBorder: 'rgba(16,185,129,0.15)',
      glowIndigo: '0 0 15px rgba(16,185,129,0.5)',
      scrollThumb: 'rgba(16,185,129,0.3)',
      scrollThumbHover: 'rgba(16,185,129,0.6)',
      radialA: 'rgba(16,185,129,0.12)',
      radialB: 'rgba(6,182,212,0.10)',
    },
  },
  {
    name: 'rose-sunset',
    label: 'Rose Sunset',
    description: 'Warm rose with orange fire',
    preview: ['#f43f5e', '#e11d48', '#f97316'],
    vars: {
      primary: '#f43f5e',
      primaryGlow: 'rgba(244,63,94,0.5)',
      primaryHover: '#e11d48',
      accent: '#f97316',
      accentGlow: 'rgba(249,115,22,0.4)',
      panelBorder: 'rgba(244,63,94,0.15)',
      glowIndigo: '0 0 15px rgba(244,63,94,0.5)',
      scrollThumb: 'rgba(244,63,94,0.3)',
      scrollThumbHover: 'rgba(244,63,94,0.6)',
      radialA: 'rgba(244,63,94,0.12)',
      radialB: 'rgba(249,115,22,0.10)',
    },
  },
  {
    name: 'amber-gold',
    label: 'Amber Gold',
    description: 'Royal amber with warm yellow',
    preview: ['#f59e0b', '#d97706', '#fbbf24'],
    vars: {
      primary: '#f59e0b',
      primaryGlow: 'rgba(245,158,11,0.5)',
      primaryHover: '#d97706',
      accent: '#fbbf24',
      accentGlow: 'rgba(251,191,36,0.4)',
      panelBorder: 'rgba(245,158,11,0.15)',
      glowIndigo: '0 0 15px rgba(245,158,11,0.5)',
      scrollThumb: 'rgba(245,158,11,0.3)',
      scrollThumbHover: 'rgba(245,158,11,0.6)',
      radialA: 'rgba(245,158,11,0.12)',
      radialB: 'rgba(251,191,36,0.10)',
    },
  },
  {
    name: 'cyan-ocean',
    label: 'Cyan Ocean',
    description: 'Deep sea cyan with sky blue',
    preview: ['#06b6d4', '#0891b2', '#3b82f6'],
    vars: {
      primary: '#06b6d4',
      primaryGlow: 'rgba(6,182,212,0.5)',
      primaryHover: '#0891b2',
      accent: '#3b82f6',
      accentGlow: 'rgba(59,130,246,0.4)',
      panelBorder: 'rgba(6,182,212,0.15)',
      glowIndigo: '0 0 15px rgba(6,182,212,0.5)',
      scrollThumb: 'rgba(6,182,212,0.3)',
      scrollThumbHover: 'rgba(6,182,212,0.6)',
      radialA: 'rgba(6,182,212,0.12)',
      radialB: 'rgba(59,130,246,0.10)',
    },
  },
  {
    name: 'violet-galaxy',
    label: 'Violet Galaxy',
    description: 'Electric violet with hot pink',
    preview: ['#8b5cf6', '#7c3aed', '#ec4899'],
    vars: {
      primary: '#8b5cf6',
      primaryGlow: 'rgba(139,92,246,0.55)',
      primaryHover: '#7c3aed',
      accent: '#ec4899',
      accentGlow: 'rgba(236,72,153,0.4)',
      panelBorder: 'rgba(139,92,246,0.15)',
      glowIndigo: '0 0 15px rgba(139,92,246,0.55)',
      scrollThumb: 'rgba(139,92,246,0.3)',
      scrollThumbHover: 'rgba(139,92,246,0.6)',
      radialA: 'rgba(139,92,246,0.14)',
      radialB: 'rgba(236,72,153,0.10)',
    },
  },
];

// ── Light mode overrides ───────────────────────────────────────────────────────
const LIGHT_MODE_VARS = {
  background: '#f8fafc',
  foreground: '#0f172a',
  panelBg: 'rgba(255,255,255,0.75)',
  glassBg: 'rgba(241,245,249,0.85)',
  glassInputBg: 'rgba(241,245,249,0.9)',
  glassInputBorder: 'rgba(0,0,0,0.1)',
  trackBg: 'rgba(241,245,249,0.6)',
};

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  themeData: ThemeDefinition;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

function applyTheme(def: ThemeDefinition, mode: ThemeMode) {
  const root = document.documentElement;
  const v = def.vars;

  root.setAttribute('data-theme', def.name);
  root.setAttribute('data-mode', mode);

  // Primary palette
  root.style.setProperty('--primary', v.primary);
  root.style.setProperty('--primary-glow', v.primaryGlow);
  root.style.setProperty('--primary-hover', v.primaryHover);
  root.style.setProperty('--accent', v.accent);
  root.style.setProperty('--accent-glow', v.accentGlow);
  root.style.setProperty('--panel-border', v.panelBorder);
  root.style.setProperty('--glow-primary', v.glowIndigo);
  root.style.setProperty('--scroll-thumb', v.scrollThumb);
  root.style.setProperty('--scroll-thumb-hover', v.scrollThumbHover);
  root.style.setProperty('--radial-a', v.radialA);
  root.style.setProperty('--radial-b', v.radialB);

  // Mode-specific vars
  if (mode === 'light') {
    root.style.setProperty('--background', LIGHT_MODE_VARS.background);
    root.style.setProperty('--foreground', LIGHT_MODE_VARS.foreground);
    root.style.setProperty('--panel-bg', LIGHT_MODE_VARS.panelBg);
    root.style.setProperty('--glass-bg', LIGHT_MODE_VARS.glassBg);
    root.style.setProperty('--glass-input-bg', LIGHT_MODE_VARS.glassInputBg);
    root.style.setProperty('--glass-input-border', LIGHT_MODE_VARS.glassInputBorder);
    root.style.setProperty('--track-bg', LIGHT_MODE_VARS.trackBg);
  } else {
    root.style.setProperty('--background', '#060814');
    root.style.setProperty('--foreground', '#f1f5f9');
    root.style.setProperty('--panel-bg', 'rgba(15,23,42,0.45)');
    root.style.setProperty('--glass-bg', 'rgba(15,23,42,0.6)');
    root.style.setProperty('--glass-input-bg', 'rgba(15,23,42,0.6)');
    root.style.setProperty('--glass-input-border', 'rgba(255,255,255,0.08)');
    root.style.setProperty('--track-bg', 'rgba(6,8,20,0.3)');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('indigo-space');
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Load from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem('upasthiti-theme') as ThemeName) || 'indigo-space';
    const savedMode = (localStorage.getItem('upasthiti-mode') as ThemeMode) || 'dark';
    const def = THEMES.find(t => t.name === savedTheme) ?? THEMES[0];
    setThemeState(savedTheme);
    setModeState(savedMode);
    applyTheme(def, savedMode);
  }, []);

  const setTheme = (t: ThemeName) => {
    const def = THEMES.find(d => d.name === t) ?? THEMES[0];
    setThemeState(t);
    localStorage.setItem('upasthiti-theme', t);
    applyTheme(def, mode);
  };

  const setMode = (m: ThemeMode) => {
    const def = THEMES.find(d => d.name === theme) ?? THEMES[0];
    setModeState(m);
    localStorage.setItem('upasthiti-mode', m);
    applyTheme(def, m);
  };

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const themeData = THEMES.find(d => d.name === theme) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, setMode, toggleMode, themeData }}>
      {children}
    </ThemeContext.Provider>
  );
}
