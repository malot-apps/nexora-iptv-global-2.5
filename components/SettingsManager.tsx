'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Laptop, Languages, Sliders, Play, Maximize, 
  Clock, FolderHeart, Trash2, History, Download, Upload, 
  Info, Check, ShieldAlert, Sparkles 
} from 'lucide-react';

interface SettingsManagerProps {
  onThemeChange?: (theme: 'light' | 'dark' | 'auto') => void;
  onClearCache?: () => void;
  onClearHistory?: () => void;
  onImportPersonalTV?: (importedUrls: any[], importedChannels: any[]) => void;
}

export default function SettingsManager({
  onThemeChange,
  onClearCache,
  onClearHistory,
  onImportPersonalTV
}: SettingsManagerProps) {
  // 1. Settings state loaded from localStorage via lazy initializers
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('nexora_theme') as 'light' | 'dark' | 'auto') || 'dark';
  });
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem('nexora_language') || 'en';
  });
  const [playerQuality, setPlayerQuality] = useState<string>(() => {
    if (typeof window === 'undefined') return 'auto';
    return localStorage.getItem('nexora_quality') || 'auto';
  });
  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem('nexora_autoplay');
    return val !== null ? val === 'true' : true;
  });
  const [autoFullscreen, setAutoFullscreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const val = localStorage.getItem('nexora_auto_fullscreen');
    return val !== null ? val === 'true' : false;
  });
  const [continueWatching, setContinueWatching] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem('nexora_continue_watching_enabled');
    return val !== null ? val === 'true' : true;
  });
  const [defaultCategory, setDefaultCategory] = useState<string>(() => {
    if (typeof window === 'undefined') return 'All';
    return localStorage.getItem('nexora_default_category') || 'All';
  });
  
  // Status message state
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Show status indicator and clear it
  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  // 2. Settings setters
  const handleThemeUpdate = (val: 'light' | 'dark' | 'auto') => {
    setTheme(val);
    localStorage.setItem('nexora_theme', val);
    if (onThemeChange) {
      onThemeChange(val);
    }
    // Update theme class on HTML element
    const isDark = val === 'dark' || (val === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    showStatus(`Theme updated to ${val.toUpperCase()}`);
  };

  const handleLanguageUpdate = (val: string) => {
    setLanguage(val);
    localStorage.setItem('nexora_language', val);
    showStatus(`Language preference updated to ${val.toUpperCase()}`);
  };

  const handleQualityUpdate = (val: string) => {
    setPlayerQuality(val);
    localStorage.setItem('nexora_quality', val);
    showStatus(`Default video track quality changed to ${val}`);
  };

  const handleToggleAutoPlay = () => {
    const nextVal = !autoPlay;
    setAutoPlay(nextVal);
    localStorage.setItem('nexora_autoplay', String(nextVal));
    showStatus(`Auto play stream: ${nextVal ? 'ON' : 'OFF'}`);
  };

  const handleToggleAutoFullscreen = () => {
    const nextVal = !autoFullscreen;
    setAutoFullscreen(nextVal);
    localStorage.setItem('nexora_auto_fullscreen', String(nextVal));
    showStatus(`Auto Fullscreen on load: ${nextVal ? 'ON' : 'OFF'}`);
  };

  const handleToggleContinueWatching = () => {
    const nextVal = !continueWatching;
    setContinueWatching(nextVal);
    localStorage.setItem('nexora_continue_watching_enabled', String(nextVal));
    showStatus(`Recently Watched history tracking: ${nextVal ? 'ON' : 'OFF'}`);
  };

  const handleDefaultCategoryUpdate = (val: string) => {
    setDefaultCategory(val);
    localStorage.setItem('nexora_default_category', val);
    showStatus(`Default home category set to ${val}`);
  };

  // 3. Clear Cache & History Actions
  const handleClearHistoryAction = () => {
    if (confirm('Clear your Continue Watching history from the browser?')) {
      localStorage.removeItem('nexora_continue_watching');
      localStorage.removeItem('nexora_recently_watched');
      if (onClearHistory) onClearHistory();
      showStatus('Recently watched stream history wiped.');
    }
  };

  const handleClearCacheAction = () => {
    if (confirm('Warning: This will clear all stored IPTV Playlists, Favorites, and custom CORS proxy settings. Continue?')) {
      localStorage.removeItem('nexora_playlists');
      localStorage.removeItem('nexora_active_playlist_id');
      localStorage.removeItem('nexora_favorites');
      localStorage.removeItem('nexora_personal_tv_urls');
      localStorage.removeItem('nexora_personal_tv_channels');
      localStorage.removeItem('nexora_personal_tv_last_synced');
      if (onClearCache) onClearCache();
      showStatus('Local cache fully cleared. Redirecting...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // 4. Import & Export Personal TV Playlists
  const handleExportPersonalTV = () => {
    try {
      const urls = localStorage.getItem('nexora_personal_tv_urls');
      const channels = localStorage.getItem('nexora_personal_tv_channels');
      
      const payload = {
        app: 'Nexora Premium',
        exportedAt: new Date().toISOString(),
        version: 'v2.5.0-premium',
        personalTV: {
          urls: urls ? JSON.parse(urls) : [],
          channels: channels ? JSON.parse(channels) : []
        }
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `nexora_personal_tv_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showStatus('Personal TV database exported successfully.');
    } catch (e) {
      console.error(e);
      showStatus('Export failed: local database empty or corrupted.', 'error');
    }
  };

  const handleImportPersonalTVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.personalTV) {
          const importedUrls = json.personalTV.urls || [];
          const importedChannels = json.personalTV.channels || [];

          localStorage.setItem('nexora_personal_tv_urls', JSON.stringify(importedUrls));
          localStorage.setItem('nexora_personal_tv_channels', JSON.stringify(importedChannels));
          localStorage.setItem('nexora_personal_tv_last_synced', new Date().toISOString());

          if (onImportPersonalTV) {
            onImportPersonalTV(importedUrls, importedChannels);
          }
          showStatus(`Imported ${importedUrls.length} sources and ${importedChannels.length} cached channels!`, 'success');
        } else {
          showStatus('Invalid backup file structure.', 'error');
        }
      } catch (err) {
        showStatus('Failed to parse backup JSON file.', 'error');
      }
    };
    fileReader.readAsText(files[0]);
  };

  return (
    <div id="premium-settings-dashboard" className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            Nexora Premium Settings
          </h2>
          <p className="text-xs text-slate-500">Customize stream quality, playback triggers, system parameters, and coordinate data backups.</p>
        </div>
        <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400 rounded">
          PREMIUM SUITE ACTIVE
        </span>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fade-in ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Visual and Language */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
            Preferences & Language
          </h3>

          {/* Theme selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Interface Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', name: 'Light', icon: Sun },
                { id: 'dark', name: 'Dark', icon: Moon },
                { id: 'auto', name: 'System', icon: Laptop }
              ].map((t) => {
                const isActive = theme === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleThemeUpdate(t.id as any)}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-500 border-blue-600 text-black shadow-lg shadow-blue-500/15'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              System Language
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageUpdate(e.target.value)}
              className="w-full text-xs text-white bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500/50 transition font-medium"
            >
              <option value="en">English (US)</option>
              <option value="es">Español (ES)</option>
              <option value="fr">Français (FR)</option>
              <option value="de">Deutsch (DE)</option>
              <option value="pt">Português (PT)</option>
              <option value="hi">हिन्दी (IN)</option>
            </select>
          </div>

          {/* Default Category */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Default Home Group / Category
            </label>
            <select
              value={defaultCategory}
              onChange={(e) => handleDefaultCategoryUpdate(e.target.value)}
              className="w-full text-xs text-white bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500/50 transition font-medium"
            >
              <option value="All">All Channels</option>
              <option value="Sports">Sports Only</option>
              <option value="News">News Only</option>
              <option value="Movies">Movies & Cinema</option>
              <option value="Documentary">Documentaries</option>
            </select>
          </div>
        </div>

        {/* Section 2: Player Preferences */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
            Video Stream Player Setup
          </h3>

          {/* Player Quality Preference */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              Default Stream Track Quality
            </label>
            <select
              value={playerQuality}
              onChange={(e) => handleQualityUpdate(e.target.value)}
              className="w-full text-xs text-white bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500/50 transition font-medium"
            >
              <option value="auto">Auto (Adaptive Bitrate)</option>
              <option value="1080p">1080p Full HD Preferred</option>
              <option value="720p">720p HD Ready</option>
              <option value="480p">480p Standard Quality</option>
              <option value="360p">360p Data Saver</option>
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-3.5 pt-1">
            {/* Auto Play */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Auto Play Streams</span>
                <span className="text-[10px] text-slate-400 block">Launch feed instantly on channel select</span>
              </div>
              <button
                onClick={handleToggleAutoPlay}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  autoPlay ? 'bg-blue-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    autoPlay ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Auto Fullscreen */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Auto Fullscreen Mode</span>
                <span className="text-[10px] text-slate-400 block">Expand video player upon launch</span>
              </div>
              <button
                onClick={handleToggleAutoFullscreen}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  autoFullscreen ? 'bg-blue-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    autoFullscreen ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Continue Watching Tracking */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Continue Watching History</span>
                <span className="text-[10px] text-slate-400 block">Log recently viewed live feeds</span>
              </div>
              <button
                onClick={handleToggleContinueWatching}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  continueWatching ? 'bg-blue-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    continueWatching ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Data & Backups */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
            Data, Import & Export Backups
          </h3>
          <p className="text-[11px] text-slate-400 leading-normal">
            Export your merged Personal TV URLs and live channel sync configurations, or import a pre-saved backup file.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={handleExportPersonalTV}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Personal TV</span>
            </button>

            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-black rounded-xl text-xs font-bold transition cursor-pointer text-center">
              <Upload className="w-4 h-4" />
              <span>Import Personal TV</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportPersonalTVFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-2">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-[10px] leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Importing will overwrite your current Personal TV URLs and synchronized channels with the backup file data.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: System Reset & Cache */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
            System Care & Cache
          </h3>
          <p className="text-[11px] text-slate-400 leading-normal">
            Flush temporary browser states, reset playlist caches, or restore Nexora to its initial factory default configuration.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleClearHistoryAction}
              className="flex items-center justify-between p-3 bg-black/30 hover:bg-red-500/5 border border-white/5 hover:border-red-500/20 rounded-xl text-xs font-semibold text-slate-300 hover:text-red-400 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Clear Continue Watching History</span>
              </span>
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <button
              onClick={handleClearCacheAction}
              className="flex items-center justify-between p-3 bg-black/30 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-xl text-xs font-bold text-red-400 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>Wipe Database & Reset Cache</span>
              </span>
              <span className="text-[9px] bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                DANGER
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-[#0c101a] border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col sm:flex-row gap-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[1.5px] shadow-lg flex-shrink-0 flex items-center justify-center font-black text-white text-xl">
          NX
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white tracking-tight">About Nexora v2.5.0 Premium</h4>
            <span className="text-[9px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              OFFICIAL
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Nexora is engineered as an ultra-low latency, 100% responsive IPTV media terminal. Utilizing cutting-edge HLS protocols, adaptive bitrates, automated client-side and cloud proxy pipelines, Nexora delivers lag-free feeds and cross-origin bypass capabilities across standard desktop, mobile, and home console devices without requiring system installations.
          </p>
          <div className="pt-2 text-[10px] font-mono text-slate-500">
            Engineered with pride • Build 1001-A • PWA Certified
          </div>
        </div>
      </div>
    </div>
  );
}
