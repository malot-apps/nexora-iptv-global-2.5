'use client';

import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, RefreshCw, Tv, Check, 
  AlertCircle, Globe, Languages, ShieldCheck, Activity, Search, Power, Save, X
} from 'lucide-react';
import { IPTVChannel } from '@/lib/iptv-parser';

export interface PersonalPlaylistUrl {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface PersonalTVManagerProps {
  playlistUrls: PersonalPlaylistUrl[];
  onAddUrl: (name: string, url: string) => void;
  onEditUrl: (id: string, name: string, url: string) => void;
  onRemoveUrl: (id: string) => void;
  onReorderUrls: (urls: PersonalPlaylistUrl[]) => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  syncProgress: { stage: string; checked: number; total: number } | null;
  liveChannels: IPTVChannel[];
  lastSynced: string | null;
}

export default function PersonalTVManager({
  playlistUrls,
  onAddUrl,
  onEditUrl,
  onRemoveUrl,
  onReorderUrls,
  onSync,
  isSyncing,
  syncProgress,
  liveChannels,
  lastSynced
}: PersonalTVManagerProps) {
  // Form states for adding/editing
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  // Channel search/filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Form submit for adding
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onAddUrl(name, url);
    setName('');
    setUrl('');
  };

  // Start editing
  const startEdit = (item: PersonalPlaylistUrl) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditUrl(item.url);
  };

  // Save edit
  const handleSaveEdit = (id: string) => {
    if (!editName.trim() || !editUrl.trim()) return;
    onEditUrl(id, editName, editUrl);
    setEditingId(null);
  };

  // Reorder functions
  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...playlistUrls];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onReorderUrls(updated);
  };

  const moveDown = (index: number) => {
    if (index === playlistUrls.length - 1) return;
    const updated = [...playlistUrls];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onReorderUrls(updated);
  };

  // Toggle enabled/disabled status
  const toggleEnabled = (item: PersonalPlaylistUrl) => {
    const updated = playlistUrls.map(p => 
      p.id === item.id ? { ...p, enabled: !p.enabled } : p
    );
    onReorderUrls(updated);
  };

  // Get unique categories from compiled live channels
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    liveChannels.forEach(ch => {
      if (ch.group) cats.add(ch.group);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [liveChannels]);

  // Filtered live channels
  const filteredChannels = React.useMemo(() => {
    return liveChannels.filter(ch => {
      const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            ch.group.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || ch.group === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [liveChannels, searchQuery, selectedCategory]);

  return (
    <div id="personal-tv-dashboard" className="space-y-6 animate-fade-in">
      <div className="border-b border-white/10 pb-3 mb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Personal TV Studio</h2>
        <p className="text-xs text-slate-500">Add multiple M3U/M3U8 URLs, merge streams, auto-detect metadata, and generate a customized clean directory containing only live channels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Playlist URL management & Add form (Takes 7/12 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Add New Playlist URL Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              Add Stream Source URL
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. US Local Networks, Sports Source"
                    className="w-full text-xs text-white bg-black/40 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500/50 transition font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">M3U / M3U8 Playlist URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/playlist.m3u"
                    className="w-full text-xs text-white bg-black/40 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500/50 transition font-medium"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-400 text-black text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer select-none flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                Add Stream Source
              </button>
            </form>
          </div>

          {/* Playlist Sources Directory */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                Stream Sources ({playlistUrls.length})
              </h3>
              {playlistUrls.length > 0 && (
                <button
                  onClick={onSync}
                  disabled={isSyncing || playlistUrls.filter(p => p.enabled).length === 0}
                  className="bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-black disabled:opacity-40 disabled:hover:bg-blue-500/10 disabled:hover:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Scanning & Building...' : 'Scan & Build Playlist'}
                </button>
              )}
            </div>

            {playlistUrls.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/5 rounded-xl bg-black/20">
                <Tv className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No custom stream sources configured.</p>
                <p className="text-[10px] text-slate-500 mt-1">Add M3U or M3U8 links above to construct your Personal TV library.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {playlistUrls.map((item, index) => {
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 border rounded-xl transition backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        item.enabled 
                          ? 'bg-black/40 border-white/10' 
                          : 'bg-black/10 border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full text-xs text-white bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                            />
                            <input
                              type="url"
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              className="w-full text-xs text-white bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${item.enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{item.url}</p>
                          </>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/25 rounded-lg transition cursor-pointer"
                              title="Save Changes"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-white/5 rounded-lg transition cursor-pointer"
                              title="Cancel Edit"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Reorder Buttons */}
                            <button
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-lg disabled:opacity-30 transition cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveDown(index)}
                              disabled={index === playlistUrls.length - 1}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-lg disabled:opacity-30 transition cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Enable / Disable Source */}
                            <button
                              onClick={() => toggleEnabled(item)}
                              className={`p-1.5 border rounded-lg transition cursor-pointer ${
                                item.enabled 
                                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500 hover:text-black' 
                                  : 'bg-zinc-800/80 border-white/5 text-zinc-500 hover:bg-emerald-500/20 hover:text-emerald-400'
                              }`}
                              title={item.enabled ? 'Deactivate Source' : 'Activate Source'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Source */}
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-black border border-blue-500/25 rounded-lg transition cursor-pointer"
                              title="Edit Source"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove Source */}
                            <button
                              onClick={() => onRemoveUrl(item.id)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black border border-red-500/25 rounded-lg transition cursor-pointer"
                              title="Remove Source"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Compiled Personal TV Status, sync, and verified channel preview (Takes 5/12 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Status HUD Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Compiled Pipeline Status
            </h3>

            {isSyncing && syncProgress ? (
              <div className="space-y-3.5 bg-black/40 border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {syncProgress.stage}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {syncProgress.checked} / {syncProgress.total}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ 
                      width: `${syncProgress.total > 0 ? (syncProgress.checked / syncProgress.total) * 100 : 0}%` 
                    }}
                  />
                </div>
                
                <p className="text-[10px] text-slate-500 leading-normal">
                  Testing channels in parallel batches using the CORS bypass pipeline to weed out dead or offline links.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Live Channels</span>
                  <span className="text-lg font-bold text-white mt-1 block font-mono">{liveChannels.length}</span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Last Sync</span>
                  <span className="text-[11px] font-bold text-slate-400 mt-2 block truncate">
                    {lastSynced ? new Date(lastSynced).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-[10px] text-slate-400 leading-normal flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white mb-0.5">Automated Validation Protocol</p>
                <p>The compiler fetches all links, removes duplicate stream URLs, cleans up categories, identifies countries/languages, and tests feed health. Dead channels are automatically culled to guarantee a clean, instant stream layout.</p>
              </div>
            </div>
          </div>

          {/* Channels Preview list */}
          {liveChannels.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex flex-col h-[320px]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                Live Channel Preview ({liveChannels.length})
              </h3>

              {/* Filters */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search working channels..."
                    className="w-full text-[10px] text-white bg-black/40 border border-white/10 rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-[10px] text-white bg-black/40 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500/50 max-w-[120px]"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat} className="bg-neutral-900 text-white">{cat}</option>
                  ))}
                </select>
              </div>

              {/* List container */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/5 text-xs text-slate-300">
                {filteredChannels.length === 0 ? (
                  <p className="text-center text-slate-500 py-12 text-[10px]">No channels match your filters.</p>
                ) : (
                  filteredChannels.map(ch => (
                    <div key={ch.id} className="p-2 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-black/60 border border-white/5 flex items-center justify-center p-1 flex-shrink-0">
                        {ch.logo ? (
                          <img 
                            src={ch.logo} 
                            alt="" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-[11px] font-bold text-white truncate">{ch.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 rounded text-blue-400 font-bold uppercase tracking-wide">
                            {ch.group}
                          </span>
                          {ch.country && ch.country !== 'International' && (
                            <span className="text-[8px] text-slate-400 flex items-center gap-0.5">
                              <Globe className="w-2 h-2" />
                              {ch.country}
                            </span>
                          )}
                          {ch.language && (
                            <span className="text-[8px] text-slate-400 flex items-center gap-0.5">
                              <Languages className="w-2 h-2" />
                              {ch.language}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
