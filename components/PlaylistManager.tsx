'use client';

import React, { useState, useRef } from 'react';
import { 
  Plus, Upload, Link, List, Loader2, Play, Sparkles, Check, Info, FileText, Database, Key, Server, Activity
} from 'lucide-react';
import { parseM3U, IPTVPlaylist, IPTVChannel } from '@/lib/iptv-parser';

interface PlaylistManagerProps {
  onPlaylistLoaded: (playlist: IPTVPlaylist) => void;
  activePlaylistId?: string | null;
  loadedPlaylistsCount: number;
  activePlaylist?: IPTVPlaylist | null;
  isScanning?: boolean;
  scanProgress?: { checked: number; total: number } | null;
  onReScan?: () => void;
}

export default function PlaylistManager({ 
  onPlaylistLoaded, 
  activePlaylistId, 
  loadedPlaylistsCount,
  activePlaylist,
  isScanning = false,
  scanProgress = null,
  onReScan
}: PlaylistManagerProps) {
  const [importTab, setImportTab] = useState<'url' | 'xtream' | 'file'>('url');
  
  // M3U URL state
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  
  // Xtream Codes state
  const [xtreamName, setXtreamName] = useState('');
  const [xtreamServer, setXtreamServer] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');

  const [loading, setLoading] = useState<string | null>(null); // holds type of loading ('url', 'xtream', 'file')
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAndParseUrl = async (url: string, nameToUse: string, importType: 'url' | 'xtream') => {
    setLoading(importType);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let text = '';
      let fetchedViaProxy = false;

      // Try local proxy first
      try {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          text = await response.text();
          fetchedViaProxy = true;
        } else {
          throw new Error(`Server returned status ${response.status}`);
        }
      } catch (proxyErr: any) {
        console.warn('Local proxy failed, trying direct or public proxy fallback:', proxyErr);
      }

      // Fallback for GitHub Pages compatibility
      if (!fetchedViaProxy) {
        try {
          const publicProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const response = await fetch(publicProxyUrl);
          if (response.ok) {
            text = await response.text();
          } else {
            throw new Error('Public CORS proxy failed');
          }
        } catch (pubErr) {
          // Direct fetch
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error ${response.status}`);
          text = await response.text();
        }
      }

      const channels = parseM3U(text);

      if (channels.length === 0) {
        throw new Error('No valid channels found in this playlist. Ensure it uses standard #EXTM3U formatting.');
      }

      onPlaylistLoaded({
        id: importType + '_' + Date.now(),
        name: nameToUse,
        channelsCount: channels.length,
        url: url,
        channels: channels,
      });

      setSuccessMsg(`Successfully imported ${channels.length} channels from ${nameToUse}!`);
      
      // Reset forms
      if (importType === 'url') {
        setPlaylistUrl('');
        setPlaylistName('');
      } else {
        setXtreamServer('');
        setXtreamUsername('');
        setXtreamPassword('');
        setXtreamName('');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to load playlist: ${err.message || 'Network, CORS, or playlist format error'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistUrl) return;

    let targetUrl = playlistUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const nameToUse = playlistName.trim() || `Playlist ${new URL(targetUrl).hostname}`;
    await fetchAndParseUrl(targetUrl, nameToUse, 'url');
  };

  const handleXtreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xtreamServer || !xtreamUsername || !xtreamPassword) return;

    let server = xtreamServer.trim();
    if (!server.startsWith('http://') && !server.startsWith('https://')) {
      server = 'http://' + server;
    }
    // Remove trailing slash if present
    if (server.endsWith('/')) {
      server = server.slice(0, -1);
    }

    const constructedUrl = `${server}/get.php?username=${encodeURIComponent(xtreamUsername.trim())}&password=${encodeURIComponent(xtreamPassword.trim())}&output=ts`;
    const nameToUse = xtreamName.trim() || `Xtream: ${new URL(server).hostname}`;

    await fetchAndParseUrl(constructedUrl, nameToUse, 'xtream');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setLoading('file');
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const channels = parseM3U(text);

        if (channels.length === 0) {
          throw new Error('No valid channels found in this M3U file.');
        }

        const nameToUse = file.name.replace(/\.[^/.]+$/, ""); // strip extension

        onPlaylistLoaded({
          id: 'file_' + Date.now(),
          name: nameToUse,
          channelsCount: channels.length,
          channels: channels,
        });

        setSuccessMsg(`Successfully imported ${channels.length} channels from ${nameToUse}!`);
      } catch (err: any) {
        setErrorMsg(`Failed to parse file: ${err.message || 'Invalid format'}`);
      } finally {
        setLoading(null);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Error reading file.');
      setLoading(null);
    };

    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div id="playlist-manager-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Input Options Column */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl animate-fade-in">
          {/* Tabs for loading method */}
          <div className="flex border-b border-white/10 pb-4 mb-4 gap-2">
            <button
              onClick={() => { setImportTab('url'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer select-none ${
                importTab === 'url'
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              M3U/M3U8 URL
            </button>
            <button
              onClick={() => { setImportTab('xtream'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer select-none ${
                importTab === 'xtream'
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Xtream Codes API
            </button>
            <button
              onClick={() => { setImportTab('file'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer select-none ${
                importTab === 'file'
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Local File
            </button>
          </div>

          {/* URL Form */}
          {importTab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">
                  <Link className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Remote M3U Stream URL</span>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Playlist Name (Optional)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. My Premium Live Stream" 
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-3 py-2 text-xs text-white transition placeholder-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  M3U / M3U8 URL *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="https://example.com/playlist.m3u" 
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-3 py-2 text-xs text-white transition placeholder-slate-600 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading !== null}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-white/5 disabled:text-slate-500 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg shadow-blue-500/10 cursor-pointer"
              >
                {loading === 'url' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Bypassing CORS & Fetching...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Load M3U Playlist
                  </>
                )}
              </button>
            </form>
          )}

          {/* Xtream Form */}
          {importTab === 'xtream' && (
            <form onSubmit={handleXtreamSubmit} className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Xtream Codes Credentials</span>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Playlist Title (Optional)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. My Xtream Server" 
                  value={xtreamName}
                  onChange={(e) => setXtreamName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-3 py-2 text-xs text-white transition placeholder-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Server URL / Host Address *
                </label>
                <div className="relative">
                  <Server className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input 
                    type="text" 
                    required
                    placeholder="http://example.com:8080" 
                    value={xtreamServer}
                    onChange={(e) => setXtreamServer(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl pl-10 pr-3 py-2 text-xs text-white transition placeholder-slate-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Username *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Username" 
                    value={xtreamUsername}
                    onChange={(e) => setXtreamUsername(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl px-3 py-2 text-xs text-white transition placeholder-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input 
                      type="password" 
                      required
                      placeholder="Password" 
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white transition placeholder-slate-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading !== null}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-white/5 disabled:text-slate-500 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg shadow-blue-500/10 cursor-pointer"
              >
                {loading === 'xtream' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting & Syncing Xtream Streams...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Connect Xtream Playlist
                  </>
                )}
              </button>
            </form>
          )}

          {/* Local File Form */}
          {importTab === 'file' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Upload local M3U file</span>
              </div>
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`bg-black/20 border ${
                  dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'
                } border-dashed rounded-2xl p-6 text-center backdrop-blur-md cursor-pointer transition relative group flex flex-col items-center justify-center min-h-[160px]`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileUpload}
                  className="hidden" 
                />
                
                <div className="p-3 bg-black rounded-2xl border border-white/10 group-hover:border-blue-500/40 transition mb-3">
                  {loading === 'file' ? (
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-500 group-hover:text-blue-400 transition" />
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-200">Drag & Drop M3U File</h4>
                <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                  Supports local <strong>.m3u</strong>, <strong>.m3u8</strong>, or standard playlist text files from your filesystem
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alerts Feedback */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Error Loading Playlist:</span>
              <p className="text-[10px] text-zinc-400 leading-normal">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Success!</span>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{successMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Information Card Column (Replaces Curated preloads) */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {activePlaylist && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl animate-fade-in flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wider uppercase">Active Playlist Status</h3>
                  <p className="text-[10px] text-slate-500">Live stream validation controls</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Name:</span>
                <span className="font-bold text-white truncate max-w-[200px]" title={activePlaylist.name}>
                  {activePlaylist.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Channels:</span>
                <span className="font-bold text-blue-400 font-mono">{activePlaylist.channels.length}</span>
              </div>
              
              {isScanning && scanProgress && (
                <div className="space-y-2 pt-2 animate-pulse">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-blue-400 flex items-center gap-1.5 font-bold">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Validating Streams...
                    </span>
                    <span className="text-slate-300 font-bold">
                      {scanProgress.checked} / {scanProgress.total} ({Math.round((scanProgress.checked / scanProgress.total) * 100)}%)
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-black/40 border border-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                      style={{ width: `${(scanProgress.checked / scanProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onReScan}
              disabled={isScanning || activePlaylist.channels.length === 0}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500 hover:to-indigo-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Pruning Dead Streams...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  Re-scan Playlist
                </>
              )}
            </button>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex flex-col animate-fade-in justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight">100% Playlist-Driven</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Nexora is built exclusively to run on playlists you provide. There are no demo, fake, or hardcoded channels included, ensuring your streaming pipeline remains fast, lightweight, and completely private.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-slate-200">M3U & M3U8 Formats:</span>
                  <p className="text-[10px] text-slate-500">Fully parsed client-side. Dynamically extracts channel logos, groups, countries, and languages.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-slate-200">Xtream Codes Integration:</span>
                  <p className="text-[10px] text-slate-500">Connect to your Xtream Codes IPTV provider line using Host, Username, and Password secure pipelines.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-slate-200">Dynamic UI Compilation:</span>
                  <p className="text-[10px] text-slate-500">Home page catalogs, categories, search queries, and menus are compiled automatically from the contents of the playlist you add.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-slate-200">Continuous Stream Verification:</span>
                  <p className="text-[10px] text-slate-500">Nexora scans all active channels in the background. Offline, dead, or failing streams are removed automatically to keep only live, working streams counted.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-[10px] text-slate-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>Nexora stores your playlist data only in your local browser storage. No credentials or stream URLs are ever transmitted to external servers.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
