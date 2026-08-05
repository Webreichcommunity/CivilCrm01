import React, { useEffect, useState } from 'react';
import { Download, LogOut, Menu, RotateCw } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../Firebase/config';

const TopBar = ({ onMenuClick, showMenuButton, userName, currentProjectName }) => {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window !== 'undefined' && Boolean(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleRefresh = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    window.location.reload();
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-3 py-3 text-white md:px-6">
        <div className="flex min-w-0 items-center gap-1">
          {showMenuButton && (
            <button
              type="button"
              onClick={onMenuClick}
              className="mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/80 text-slate-100 transition hover:border-blue-400"
              aria-label="Toggle project menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <img src="/brandlogo.png" alt="Webreich" loading="eager" decoding="async" className="mr-2 h-12 w-12 shrink-0 rounded-md bg-white p-1 object-contain" />

          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.2em] text-slate-300">Vastushobha Construction</p>
            <p className="truncate text-sm font-semibold text-slate-100">
              {currentProjectName ? currentProjectName : `Hello ${userName}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 sm:block">
            Hello {userName}
          </span>
          {installPrompt && !isStandalone && (
            <button
              type="button"
              onClick={handleInstall}
              className="neutral-btn border-blue-500/50 bg-blue-600 px-3 py-2 text-white hover:border-blue-400 hover:bg-blue-700"
              title="Install app"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Install</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            className="neutral-btn border-slate-700 bg-slate-800/80 px-3 py-2 text-slate-200 hover:bg-slate-700"
            title="Clear cache and refresh"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={handleLogout} className="neutral-btn border-slate-700 bg-slate-800/80 px-3 py-2 text-slate-200 hover:bg-slate-700">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
