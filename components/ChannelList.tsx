'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Heart, Grid, List, Star, Tv, AlertCircle, Sparkles, SlidersHorizontal, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { IPTVChannel } from '@/lib/iptv-parser';

interface ChannelListProps {
  channels: IPTVChannel[];
  activeChannelId?: string | null;
  onSelectChannel: (channel: IPTVChannel) => void;
  favorites: string[]; // List of channel IDs
  onToggleFavorite: (channel: IPTVChannel) => void;
}

const ITEMS_PER_PAGE = 48;

export default function ChannelList({ 
  channels, 
  activeChannelId, 
  onSelectChannel, 
  favorites, 
  onToggleFavorite 
}: ChannelListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [healthStatus, setHealthStatus] = useState<Record<string, 'checking' | 'online' | 'offline'>>({});

  // Extract all unique groups / categories (unconditionally exclude offline channels)
  const groups = useMemo(() => {
    const set = new Set<string>();
    channels.forEach(ch => {
      if (healthStatus[ch.id] !== 'offline') {
        if (ch.group) set.add(ch.group);
      }
    });
    // Sort groups and put General/Others at the end
    const list = Array.from(set).sort();
    
    // Put Sports/News/Movies at the front if they exist
    const ordered = ['All'];
    ['Sports', 'News', 'Movies', 'Documentary', 'Music', 'Kids'].forEach(cat => {
      if (list.includes(cat)) {
        ordered.push(cat);
      }
    });

    list.forEach(cat => {
      if (!ordered.includes(cat)) {
        ordered.push(cat);
      }
    });

    return ordered;
  }, [channels, healthStatus]);

  // Filter channels based on Search, Group, and Favorites
  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      // Unconditionally exclude offline channels
      if (healthStatus[ch.id] === 'offline') return false;

      // Favorite filter
      const isFav = favorites.includes(ch.id);
      if (showFavoritesOnly && !isFav) return false;

      // Group filter
      if (selectedGroup !== 'All' && ch.group !== selectedGroup) return false;

      // Search query filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = ch.name.toLowerCase().includes(query);
        const matchesGroup = ch.group.toLowerCase().includes(query);
        if (!matchesName && !matchesGroup) return false;
      }

      return true;
    });
  }, [channels, favorites, showFavoritesOnly, selectedGroup, searchTerm, healthStatus]);

  // Paginated channels for high performance rendering
  const paginatedChannels = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredChannels.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredChannels, currentPage]);

  const totalPages = Math.ceil(filteredChannels.length / ITEMS_PER_PAGE);

  // Passive health checks for paginated channels
  useEffect(() => {
    let active = true;
    const channelsToCheck = paginatedChannels;

    // Filter to channels that do not have a health status checked yet
    const toCheck = channelsToCheck.filter(ch => !healthStatus[ch.id]);

    if (toCheck.length === 0) return;

    // Set status to checking for these channels
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHealthStatus(prev => {
      const next = { ...prev };
      toCheck.forEach(ch => {
        next[ch.id] = 'checking';
      });
      return next;
    });

    const checkChannel = async (ch: IPTVChannel) => {
      try {
        const res = await fetch(`/api/ping?url=${encodeURIComponent(ch.url)}`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setHealthStatus(prev => ({
            ...prev,
            [ch.id]: data.reachable ? 'online' : 'offline'
          }));
          return;
        }
      } catch (err) {
        // Fallback to direct client check
      }

      // Client-side/GitHub Pages direct ping fallback
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        await fetch(ch.url, {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal,
          headers: {
            'Accept': '*/*',
          }
        });
        clearTimeout(timeoutId);
        if (!active) return;
        setHealthStatus(prev => ({
          ...prev,
          [ch.id]: 'online'
        }));
      } catch (err) {
        if (!active) return;
        setHealthStatus(prev => ({
          ...prev,
          [ch.id]: 'offline'
        }));
      }
    };

    // Stagger checks in small batches to preserve network resources
    const runChecks = async () => {
      const batchSize = 4;
      for (let i = 0; i < toCheck.length; i += batchSize) {
        if (!active) break;
        const batch = toCheck.slice(i, i + batchSize);
        await Promise.all(batch.map(ch => checkChannel(ch)));
        // Tiny pause between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    runChecks();

    return () => {
      active = false;
    };
  }, [paginatedChannels, healthStatus]);

  const renderStatusDot = (channelId: string) => {
    const status = healthStatus[channelId];
    if (!status) return null;

    switch (status) {
      case 'checking':
        return (
          <span className="flex items-center gap-1 text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold font-mono">
            <span className="w-1 h-1 rounded-full bg-blue-400 animate-ping" />
            PING
          </span>
        );
      case 'online':
        return (
          <span className="flex items-center gap-1 text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold font-mono">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1 text-[8px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 font-bold font-mono">
            <span className="w-1 h-1 rounded-full bg-red-400" />
            DOWN
          </span>
        );
      default:
        return null;
    }
  };


  return (
    <div id="channel-list-container" className="flex flex-col gap-4">
      {/* Filtering HUD */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-4 backdrop-blur-md shadow-lg">
        {/* Search & Layout toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search across channels, countries, or sports networks..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 transition outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Favorites Toggle */}
            <button
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer select-none ${
                showFavoritesOnly 
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' 
                  : 'border-white/10 bg-black/40 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current text-amber-400' : ''}`} />
              Favorites ({favorites.length})
            </button>

            {/* Verified Live Badge */}
            <div
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-xs select-none"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Verified Live ({filteredChannels.length})
            </div>

            {/* Layout switch */}
            <div className="flex bg-black/40 border border-white/10 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                title="Grid Layout"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                title="List Layout"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10">
          <div className="flex-shrink-0 text-slate-400 flex items-center gap-1.5 mr-2 text-xs font-semibold">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Categories:
          </div>
          {groups.map((group) => {
            const isSelected = selectedGroup === group;
            return (
              <button
                key={group}
                onClick={() => { setSelectedGroup(group); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap select-none border ${
                  isSelected 
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400 font-bold' 
                    : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {group}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Counter */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-mono">
        <div>
          Showing {filteredChannels.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredChannels.length)} of {filteredChannels.length} channels
        </div>
        {selectedGroup !== 'All' && (
          <div className="text-blue-400 font-semibold">Filtered Category: {selectedGroup}</div>
        )}
      </div>

      {/* Grid or List of Channels */}
      {filteredChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/5 backdrop-blur-md text-center">
          <AlertCircle className="w-10 h-10 text-slate-600 mb-3 animate-bounce" />
          <h4 className="text-sm font-semibold text-slate-400">No Channels Found</h4>
          <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
            {showFavoritesOnly 
              ? "You haven't starred any channels in this category yet. Click the star on any channel to save it."
              : "Try adjusting your search queries, clearing your filters, or importing a more expansive playlist."}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {paginatedChannels.map((ch) => {
            const isActive = activeChannelId === ch.id;
            const isFav = favorites.includes(ch.id);

            return (
              <div
                key={ch.id}
                className={`relative rounded-xl border p-3 flex flex-col items-center text-center transition cursor-pointer select-none group/card min-h-[144px] justify-between ${
                  isActive 
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {/* Status Indicator Absolute */}
                <div className="absolute top-2 left-2 z-10">
                  {renderStatusDot(ch.id)}
                </div>

                {/* Favorite Absolute */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(ch);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-md bg-black/60 hover:bg-black/80 border border-white/10 transition-transform hover:scale-110 z-10"
                >
                  <Star className={`w-3 h-3 ${isFav ? 'fill-current text-amber-400 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`} />
                </button>

                {/* Logo or initials */}
                <div 
                  onClick={() => onSelectChannel(ch)}
                  className="w-14 h-14 rounded-xl bg-black border border-white/10 p-2 flex items-center justify-center mb-2.5 transition group-hover/card:scale-105"
                >
                  {ch.logo ? (
                    <img 
                      src={ch.logo} 
                      alt={ch.name} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-800/30 flex items-center justify-center font-bold text-white text-xs">
                      {ch.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div 
                  onClick={() => onSelectChannel(ch)}
                  className="space-y-1 w-full flex-1 flex flex-col justify-end"
                >
                  <h5 className="text-[11px] font-bold text-slate-100 group-hover/card:text-blue-400 transition line-clamp-2 leading-tight px-1">
                    {ch.name}
                  </h5>
                  <span className="inline-block px-1.5 py-0.5 bg-white/5 border border-white/10 text-[9px] text-slate-400 rounded font-medium truncate max-w-full">
                    {ch.group}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT LIST VIEW */
        <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden bg-black/20 divide-y divide-white/10">
          {paginatedChannels.map((ch) => {
            const isActive = activeChannelId === ch.id;
            const isFav = favorites.includes(ch.id);

            return (
              <div
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={`p-3 flex items-center justify-between gap-4 cursor-pointer transition select-none group/row ${
                  isActive 
                    ? 'bg-blue-500/10' 
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Small Logo */}
                  <div className="w-8 h-8 rounded bg-black border border-white/10 p-1 flex-shrink-0 flex items-center justify-center">
                    {ch.logo ? (
                      <img 
                        src={ch.logo} 
                        alt={ch.name} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full rounded bg-gradient-to-br from-blue-600/30 to-indigo-800/30 flex items-center justify-center font-mono text-[9px] font-bold text-slate-400">
                        {ch.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Text details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className={`text-xs font-bold truncate ${isActive ? 'text-blue-400' : 'text-slate-200 group-hover/row:text-white'}`}>
                        {ch.name}
                      </h5>
                      {renderStatusDot(ch.id)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {ch.group}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline px-2 py-0.5 bg-white/5 border border-white/10 text-[10px] text-slate-400 rounded font-mono truncate max-w-[150px]">
                    {ch.url.substring(ch.url.lastIndexOf('/') + 1)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(ch);
                    }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/85 border border-white/10 transition-transform"
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current text-amber-400 text-amber-500' : 'text-slate-500'}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4 py-2 border-t border-white/10">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 transition text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-xs font-semibold text-slate-400">
            Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 transition text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
