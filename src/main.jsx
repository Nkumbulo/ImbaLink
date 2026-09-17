import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/ThemeStyles.css';
import './styles/desktop-light.css';
import './styles/GlobalStyles.css';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { supabaseAuthProvider } from './auth/supabaseAuthProvider';
import { startSyncCoordinator } from './core/sync/syncCoordinator';

startSyncCoordinator();

// Apply the saved palette before React paints the app. Capacitor Preferences
// is intentionally used here instead of localStorage so native startup reads
// the same source that ProfilePage writes. React waits only for this tiny
// native preference read; the rest of app/network hydration remains async.
const THEMES = {
  classic: { green:'#2F7A55', soft:'#E7F0EA', deep:'#204F3A', surface:'#FBF8F0', surface2:'#F1EBDB', surface3:'#E9E1CB', ink:'#14201A', muted:'#62695F', line:'#E7DFC9', rgb:'47,122,85' },
  ocean: { green:'#287C86', soft:'#E4F1F2', deep:'#1D5961', surface:'#F7FAF9', surface2:'#EAF2F1', surface3:'#DDEAE8', ink:'#142325', muted:'#617073', line:'#D8E4E2', rgb:'40,124,134' },
  blush: { green:'#B85C7A', soft:'#F8E8EE', deep:'#873F5A', surface:'#FFF9FA', surface2:'#F7ECEF', surface3:'#F0DEE5', ink:'#2B1D24', muted:'#75666D', line:'#EAD7DE', rgb:'184,92,122' },
  liquid: { green:'#8B9CFF', soft:'rgba(255,255,255,.10)', deep:'#080B14', surface:'#070A11', surface2:'rgba(255,255,255,.075)', surface3:'#111728', ink:'#F5F7FF', muted:'#A8B0C4', line:'rgba(255,255,255,.14)', rgb:'139,156,255' },
};

function applyStartupTheme(id) {
  const t = THEMES[id] || THEMES.classic;
  const root = document.documentElement;
  root.dataset.imbalinkTheme = THEMES[id] ? id : 'classic';
  root.style.setProperty('--theme-green', t.green);
  root.style.setProperty('--theme-green-soft', t.soft);
  root.style.setProperty('--theme-green-deep', t.deep);
  root.style.setProperty('--theme-surface', t.surface);
  root.style.setProperty('--theme-surface-2', t.surface2);
  root.style.setProperty('--theme-surface-3', t.surface3);
  root.style.setProperty('--theme-ink', t.ink);
  root.style.setProperty('--theme-muted', t.muted);
  root.style.setProperty('--theme-line', t.line);
  root.style.setProperty('--theme-nav-text', '#FFFFFF');
  root.style.setProperty('--theme-green-rgb', t.rgb);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', t.green);
}

async function bootstrap() {
  // Mount React immediately with the default theme applied synchronously.
  // The previous version awaited Preferences.get() (a native/Capacitor
  // bridge call) BEFORE the very first ReactDOM.render() — meaning if that
  // plugin call is slow, or never resolves at all (Safari's web
  // implementation of Preferences can be affected by ITP/private-mode
  // storage restrictions in ways the native implementation never is),
  // React never mounts and the page stays blank before Splash, App.jsx, or
  // anything else in the app even gets a chance to run. Applying the
  // 'classic' default synchronously and rendering immediately means React
  // is always on screen right away, on every platform, regardless of
  // whether/when that plugin call resolves.
  applyStartupTheme('classic');

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // The other half of native Google sign-in (see signInWithGoogle() in
  // supabaseAuthProvider.js for the full explanation of why iPhone needs a
  // completely different flow than the web build). This has to be
  // registered here, at the true app entrypoint, rather than inside any
  // one page/component — the OS can hand the app this redirect at any
  // point while the in-app browser is open, regardless of which screen
  // was showing when the person tapped "Continue with Google", and this
  // listener has to already exist by the time that happens.
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      supabaseAuthProvider.handleNativeOAuthRedirect(url).catch((err) => {
        console.error('Native Google sign-in redirect failed:', err?.message || err);
      });
    });

    // Belt-and-suspenders alongside capacitor.config.json's
    // Keyboard.resize:"none": that setting stops the WebView itself from
    // resizing when the keyboard opens, but iOS can still try to scroll
    // the page's content to bring a focused input into view, which moves
    // position:fixed elements right along with it in exactly the way
    // useMessageViewport.js's keyboardInset-driven layout is meant to
    // handle on its own. Disabling native scroll leaves that entirely to
    // the app's own layout math — see useMessageViewport.js's
    // Keyboard.addListener block for the other half of this.
    Keyboard.setScroll({ isDisabled: true }).catch(() => {});
  }

  // Fetch the user's saved theme in the background and swap it in once
  // known. If this never resolves, or resolves to 'classic' anyway, the
  // user simply keeps seeing the default they already have on screen —
  // never a blocked mount.
  try {
    const { value } = await Preferences.get({ key: 'imbalink-theme' });
    if (value && THEMES[value] && value !== 'classic') applyStartupTheme(value);
  } catch { /* theme preference is a cosmetic best-effort read */ }
}

void bootstrap();

