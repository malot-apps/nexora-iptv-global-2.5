'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Tv, Trophy, List, Play, Check, Settings,
  Trash2, ShieldCheck, Heart, AlertCircle, Info, Radio, Activity, Clock, Send, Facebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IPTVPlaylist, IPTVChannel, parseM3U } from '@/lib/iptv-parser';
import LivePlayer from '@/components/LivePlayer';
import PlaylistManager from '@/components/PlaylistManager';
import ChannelList from '@/components/ChannelList';
import SportsSchedule from '@/components/SportsSchedule';
import PersonalTVManager, { PersonalPlaylistUrl } from '@/components/PersonalTVManager';
import SettingsManager from '@/components/SettingsManager';
import { COMMUNITY_CONFIG } from '@/lib/config';

interface RecentlyWatchedItem extends IPTVChannel {
  watchedAt: number;
}

const EMPTY_CHANNELS: IPTVChannel[] = [];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [playlists, setPlaylists] = useState<IPTVPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<IPTVChannel | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [continueWatching, setContinueWatching] = useState<IPTVChannel[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatchedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'watch' | 'import' | 'sports' | 'personal' | 'settings'>('watch');

  // Personal TV states
  const [personalUrls, setPersonalUrls] = useState<PersonalPlaylistUrl[]>([]);
  const [personalChannels, setPersonalChannels] = useState<IPTVChannel[]>([]);
  const [personalLastSynced, setPersonalLastSynced] = useState<string | null>(null);
  const [personalIsSyncing, setPersonalIsSyncing] = useState(false);
  const [personalSyncProgress, setPersonalSyncProgress] = useState<{ stage: string; checked: number; total: number } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ checked: number; total: number } | null>(null);
  const scanCancelRef = useRef<boolean>(false);

  const isScanningRef = useRef<boolean>(false);
  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  const playlistsRef = useRef<IPTVPlaylist[]>(playlists);
  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  // Load playlists and other states from localStorage after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      try {
        // Initialize Theme Preference
        const storedTheme = localStorage.getItem('nexora_theme');
        const isDark = storedTheme === 'dark' || !storedTheme || (storedTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }

        let loadedPlaylists: IPTVPlaylist[] = [];
        const storedPlaylists = localStorage.getItem('nexora_playlists');
        if (storedPlaylists) {
          try {
            const parsed = JSON.parse(storedPlaylists);
            if (Array.isArray(parsed)) {
              loadedPlaylists = parsed.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.channels));
            }
          } catch (e) {
            console.error('Failed to parse nexora_playlists', e);
          }
        }
        setPlaylists(loadedPlaylists);

        let activeId = null;
        const storedActiveId = localStorage.getItem('nexora_active_playlist_id');
        if (storedActiveId && loadedPlaylists.some(p => p.id === storedActiveId)) {
          activeId = storedActiveId;
        } else if (loadedPlaylists.length > 0) {
          activeId = loadedPlaylists[0].id;
        }
        setActivePlaylistId(activeId);

        const currentPlaylist = loadedPlaylists.find(p => p.id === activeId);
        if (currentPlaylist && Array.isArray(currentPlaylist.channels) && currentPlaylist.channels.length > 0) {
          setActiveChannel(currentPlaylist.channels[0]);
        } else {
          setActiveChannel(null);
        }

        // If absolutely no playlists loaded, auto-focus the import tab to guide the user
        if (loadedPlaylists.length === 0) {
          setActiveTab('import');
        }

        const storedFavorites = localStorage.getItem('nexora_favorites');
        if (storedFavorites) {
          try {
            const parsed = JSON.parse(storedFavorites);
            if (Array.isArray(parsed)) {
              setFavorites(parsed.filter(item => typeof item === 'string'));
            }
          } catch (e) {
            console.error('Failed to parse nexora_favorites', e);
          }
        }

        const storedContinueWatching = localStorage.getItem('nexora_continue_watching');
        if (storedContinueWatching) {
          try {
            const parsed = JSON.parse(storedContinueWatching);
            if (Array.isArray(parsed)) {
              setContinueWatching(parsed.filter(ch => ch && typeof ch === 'object' && typeof ch.id === 'string' && typeof ch.url === 'string'));
            }
          } catch (e) {
            console.error('Failed to parse nexora_continue_watching', e);
          }
        }

        const storedRecentlyWatched = localStorage.getItem('nexora_recently_watched');
        if (storedRecentlyWatched) {
          try {
            const parsed = JSON.parse(storedRecentlyWatched);
            if (Array.isArray(parsed)) {
              setRecentlyWatched(parsed.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.url === 'string'));
            }
          } catch (e) {
            console.error('Failed to parse nexora_recently_watched', e);
          }
        }

        // Load Personal TV states
        const storedPersonalUrls = localStorage.getItem('nexora_personal_tv_urls');
        if (storedPersonalUrls) {
          try {
            const parsed = JSON.parse(storedPersonalUrls);
            if (Array.isArray(parsed)) {
              setPersonalUrls(parsed.filter(u => u && typeof u === 'object' && typeof u.id === 'string' && typeof u.url === 'string'));
            }
          } catch (e) {
            console.error('Failed to parse nexora_personal_tv_urls', e);
          }
        }

        const storedPersonalChannels = localStorage.getItem('nexora_personal_tv_channels');
        if (storedPersonalChannels) {
          try {
            const parsed = JSON.parse(storedPersonalChannels);
            if (Array.isArray(parsed)) {
              setPersonalChannels(parsed.filter(ch => ch && typeof ch === 'object' && typeof ch.id === 'string' && typeof ch.url === 'string'));
            }
          } catch (e) {
            console.error('Failed to parse nexora_personal_tv_channels', e);
          }
        }

        const storedPersonalLastSynced = localStorage.getItem('nexora_personal_tv_last_synced');
        if (storedPersonalLastSynced) {
          setPersonalLastSynced(storedPersonalLastSynced);
        }
      } catch (e) {
        console.error(e);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const [currentMs, setCurrentMs] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      setCurrentMs(Date.now());
    }, 0);
    const interval = setInterval(() => {
      setCurrentMs(Date.now());
    }, 30000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [mounted]);

  // Fetch and sync owner-managed playlists from sources.json
  useEffect(() => {
    if (!mounted) return;

    const syncOwnerPlaylists = async () => {
      try {
        const basePath = '';
        const res = await fetch(`${basePath}/playlists/sources.json`);
        if (!res.ok) {
          console.warn('sources.json was not found or failed to load. Continuing normally.');
          return;
        }

        const data = await res.json();
        if (!data || !Array.isArray(data.playlists)) {
          console.warn('sources.json is malformed. Continuing normally.');
          return;
        }

        const ownerPlaylists = data.playlists.filter((p: any) => p && typeof p === 'object' && p.enabled !== false && p.id && p.name && p.url);
        if (ownerPlaylists.length === 0) return;

        let playlistsUpdated = false;
        let currentPlaylists = [...playlistsRef.current];

        for (const op of ownerPlaylists) {
          const existing = currentPlaylists.find(p => p.id === op.id);
          
          if (!existing || existing.url !== op.url || existing.name !== op.name) {
            try {
              let text = '';
              let fetched = false;

              try {
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(op.url)}`;
                const response = await fetch(proxyUrl);
                if (response.ok) {
                  text = await response.text();
                  fetched = true;
                }
              } catch (e) {
                // Ignore and try fallback
              }

              if (!fetched) {
                try {
                  const publicProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(op.url)}`;
                  const response = await fetch(publicProxyUrl);
                  if (response.ok) {
                    text = await response.text();
                    fetched = true;
                  }
                } catch (e) {
                  // Ignore and try direct
                }
              }

              if (!fetched) {
                const response = await fetch(op.url);
                if (response.ok) {
                  text = await response.text();
                  fetched = true;
                }
              }

              if (fetched && text) {
                const channels = parseM3U(text);
                if (channels.length > 0) {
                  const parsedPlaylist: IPTVPlaylist = {
                    id: op.id,
                    name: op.name,
                    channelsCount: channels.length,
                    url: op.url,
                    channels: channels,
                    isOwnerManaged: true
                  };

                  if (existing) {
                    currentPlaylists = currentPlaylists.map(p => p.id === op.id ? parsedPlaylist : p);
                  } else {
                    currentPlaylists.push(parsedPlaylist);
                  }
                  playlistsUpdated = true;
                }
              }
            } catch (err) {
              console.error(`Failed to fetch owner playlist: ${op.name}`, err);
            }
          }
        }

        if (playlistsUpdated) {
          setPlaylists(currentPlaylists);
          localStorage.setItem('nexora_playlists', JSON.stringify(currentPlaylists));

          const currentActive = currentPlaylists.find(p => p.id === activePlaylistId);
          if (!currentActive && currentPlaylists.length > 0) {
            const firstPlaylist = currentPlaylists[0];
            setActivePlaylistId(firstPlaylist.id);
            if (firstPlaylist.channels.length > 0) {
              setActiveChannel(firstPlaylist.channels[0]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to sync owner playlists:', e);
      }
    };

    syncOwnerPlaylists();
  }, [mounted]);

  const formatWatchedAt = (timestamp: number) => {
    if (!currentMs) return 'Just now';
    const diff = currentMs - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleSelectChannel = useCallback((channel: IPTVChannel | null) => {
    setActiveChannel(channel);
    if (!channel) return;
    
    // Check if Continue Watching log is permitted in settings
    const isHistoryEnabled = localStorage.getItem('nexora_continue_watching_enabled') !== 'false';
    if (!isHistoryEnabled) return;

    setContinueWatching(prev => {
      const filtered = prev.filter(c => c.id !== channel.id);
      const updated = [channel, ...filtered].slice(0, 8); // Keep last 8 recently watched channels
      localStorage.setItem('nexora_continue_watching', JSON.stringify(updated));
      return updated;
    });

    setRecentlyWatched(prev => {
      const filtered = prev.filter(item => item.id !== channel.id);
      const newItem: RecentlyWatchedItem = {
        ...channel,
        watchedAt: Date.now()
      };
      const updated = [newItem, ...filtered].slice(0, 20); // Keep last 20 watched channels
      localStorage.setItem('nexora_recently_watched', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Sync activePlaylistId to localStorage when changed
  useEffect(() => {
    if (mounted && activePlaylistId) {
      localStorage.setItem('nexora_active_playlist_id', activePlaylistId);
    }
  }, [activePlaylistId, mounted]);

  // Save state to localStorage when changed
  const savePlaylistsToStorage = useCallback((updated: IPTVPlaylist[]) => {
    setPlaylists(updated);
    localStorage.setItem('nexora_playlists', JSON.stringify(updated));
  }, []);

  const handlePlaylistLoaded = useCallback((newPlaylist: IPTVPlaylist) => {
    setPlaylists(prevPlaylists => {
      const exists = prevPlaylists.some(p => p.id === newPlaylist.id);
      let updated: IPTVPlaylist[] = [];
      if (exists) {
        updated = prevPlaylists.map(p => p.id === newPlaylist.id ? newPlaylist : p);
      } else {
        updated = [...prevPlaylists, newPlaylist];
      }
      localStorage.setItem('nexora_playlists', JSON.stringify(updated));
      return updated;
    });
    setActivePlaylistId(newPlaylist.id);
    if (newPlaylist.channels.length > 0) {
      setActiveChannel(newPlaylist.channels[0]);
    }
    setActiveTab('watch'); // automatically switch to TV mode when loaded
  }, []);

  const handleDeletePlaylist = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm('Are you sure you want to delete this playlist from your browser cache?')) {
      setPlaylists(prevPlaylists => {
        const updated = prevPlaylists.filter(p => p.id !== id);
        localStorage.setItem('nexora_playlists', JSON.stringify(updated));

        setTimeout(() => {
          setActivePlaylistId(prevActiveId => {
            if (prevActiveId === id) {
              if (updated.length > 0) {
                setActiveChannel(updated[0].channels[0] || null);
                return updated[0].id;
              } else {
                setActiveChannel(null);
                setActiveTab('import');
                return null;
              }
            }
            return prevActiveId;
          });
        }, 0);

        return updated;
      });
    }
  }, []);

  const handleSelectPlaylist = useCallback((id: string) => {
    setActivePlaylistId(id);
    const target = playlistsRef.current.find(p => p.id === id);
    if (target && target.channels.length > 0) {
      setActiveChannel(target.channels[0]);
    } else {
      setActiveChannel(null);
    }
  }, []);

  // Toggle Favorites
  const handleToggleFavorite = useCallback((channel: IPTVChannel) => {
    setFavorites(prev => {
      let updated: string[] = [];
      if (prev.includes(channel.id)) {
        updated = prev.filter(id => id !== channel.id);
      } else {
        updated = [...prev, channel.id];
      }
      localStorage.setItem('nexora_favorites', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Trigger manual full validation/rescan of the active playlist
  const handleReScan = async () => {
    if (isScanning || !activePlaylistId) return;

    const targetPlaylist = playlists.find(p => p.id === activePlaylistId);
    if (!targetPlaylist || targetPlaylist.channels.length === 0) return;

    setIsScanning(true);
    setScanProgress({ checked: 0, total: targetPlaylist.channels.length });
    scanCancelRef.current = false;

    try {
      const channelsToVerify = [...targetPlaylist.channels];
      const batchSize = 10;
      const offlineChannelIds: string[] = [];

      for (let i = 0; i < channelsToVerify.length; i += batchSize) {
        if (scanCancelRef.current) break;

        const batch = channelsToVerify.slice(i, i + batchSize);
        
        // Check this batch in parallel
        const results = await Promise.all(
          batch.map(async (channel) => {
            const isOnline = await checkChannelReachable(channel.url);
            return { id: channel.id, isOnline };
          })
        );

        if (scanCancelRef.current) break;

        const deadInBatch = results.filter(r => !r.isOnline).map(r => r.id);
        if (deadInBatch.length > 0) {
          offlineChannelIds.push(...deadInBatch);
        }

        const currentChecked = Math.min(i + batch.length, channelsToVerify.length);
        setScanProgress({ checked: currentChecked, total: channelsToVerify.length });

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!scanCancelRef.current && offlineChannelIds.length > 0) {
        setPlaylists(prevPlaylists => {
          const updated = prevPlaylists.map(p => {
            if (p.id === activePlaylistId) {
              const remaining = p.channels.filter(ch => !offlineChannelIds.includes(ch.id));
              return {
                ...p,
                channelsCount: remaining.length,
                channels: remaining,
              };
            }
            return p;
          });
          localStorage.setItem('nexora_playlists', JSON.stringify(updated));
          return updated;
        });

        // Reset active channel if we removed the playing one
        setActiveChannel(prev => {
          if (prev && offlineChannelIds.includes(prev.id)) {
            const activePLNow = playlistsRef.current.find(p => p.id === activePlaylistId);
            if (activePLNow) {
              const remaining = activePLNow.channels.filter(ch => !offlineChannelIds.includes(ch.id));
              return remaining[0] || null;
            }
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Manual validation failed:', error);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Personal TV handlers and sync algorithm
  const fetchPersonalPlaylistText = async (url: string): Promise<string> => {
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.warn('Local proxy failed for personal TV source, trying fallback:', e);
    }

    try {
      const publicProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(publicProxyUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.warn('Public proxy failed for personal TV source, trying direct fetch:', e);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    return await response.text();
  };

  const handleSyncPersonalTV = async () => {
    if (personalIsSyncing) return;
    setPersonalIsSyncing(true);
    setPersonalSyncProgress({ stage: 'Starting Personal TV compilation...', checked: 0, total: 0 });

    try {
      const enabledSources = personalUrls.filter(u => u.enabled);
      if (enabledSources.length === 0) {
        alert('Please enable at least one stream source to sync.');
        setPersonalIsSyncing(false);
        setPersonalSyncProgress(null);
        return;
      }

      let allChannels: IPTVChannel[] = [];

      // Step 1: Fetch and parse all enabled playlists
      for (let i = 0; i < enabledSources.length; i++) {
        const source = enabledSources[i];
        setPersonalSyncProgress({
          stage: `Fetching and parsing "${source.name}" (${i + 1}/${enabledSources.length})...`,
          checked: i,
          total: enabledSources.length
        });

        try {
          const text = await fetchPersonalPlaylistText(source.url);
          const parsed = parseM3U(text);
          allChannels.push(...parsed);
        } catch (err) {
          console.error(`Failed to fetch source: ${source.name}`, err);
        }
      }

      if (allChannels.length === 0) {
        alert('No channels could be retrieved from your sources. Please check your URLs.');
        setPersonalIsSyncing(false);
        setPersonalSyncProgress(null);
        return;
      }

      // Step 2: Remove duplicate stream URLs
      const uniqueUrlMap = new Map<string, IPTVChannel>();
      allChannels.forEach(ch => {
        if (!uniqueUrlMap.has(ch.url)) {
          uniqueUrlMap.set(ch.url, ch);
        }
      });

      const uniqueChannels = Array.from(uniqueUrlMap.values());

      // Step 3: Verify all channels in parallel batches
      const liveChannelsList: IPTVChannel[] = [];
      const batchSize = 15;
      
      for (let i = 0; i < uniqueChannels.length; i += batchSize) {
        setPersonalSyncProgress({
          stage: `Verifying streams reachability...`,
          checked: i,
          total: uniqueChannels.length
        });

        const batch = uniqueChannels.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (ch) => {
            const isOnline = await checkChannelReachable(ch.url);
            return { channel: ch, isOnline };
          })
        );

        results.forEach(res => {
          if (res.isOnline) {
            liveChannelsList.push(res.channel);
          }
        });

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Step 4: Save compiled live channels
      setPersonalChannels(liveChannelsList);
      const nowString = new Date().toISOString();
      setPersonalLastSynced(nowString);

      localStorage.setItem('nexora_personal_tv_channels', JSON.stringify(liveChannelsList));
      localStorage.setItem('nexora_personal_tv_last_synced', nowString);

      // Step 5: Update playlists array to inject our Personal TV playlist!
      const personalTvPlaylist: IPTVPlaylist = {
        id: 'personal_tv',
        name: 'Personal TV',
        channelsCount: liveChannelsList.length,
        channels: liveChannelsList,
        url: 'local://personal_tv'
      };

      setPlaylists(prev => {
        const filtered = prev.filter(p => p.id !== 'personal_tv');
        const updated = [personalTvPlaylist, ...filtered];
        localStorage.setItem('nexora_playlists', JSON.stringify(updated));
        return updated;
      });

      setActivePlaylistId('personal_tv');
      if (liveChannelsList.length > 0) {
        setActiveChannel(liveChannelsList[0]);
      }

      alert(`Success! Compiled ${liveChannelsList.length} working live channels in your Personal TV playlist.`);

    } catch (err) {
      console.error('Personal TV sync failed:', err);
    } finally {
      setPersonalIsSyncing(false);
      setPersonalSyncProgress(null);
    }
  };

  const handleAddPersonalUrl = (name: string, url: string) => {
    const newUrl: PersonalPlaylistUrl = {
      id: 'personal_url_' + Date.now(),
      name,
      url,
      enabled: true
    };
    const updated = [...personalUrls, newUrl];
    setPersonalUrls(updated);
    localStorage.setItem('nexora_personal_tv_urls', JSON.stringify(updated));
  };

  const handleEditPersonalUrl = (id: string, name: string, url: string) => {
    const updated = personalUrls.map(p => 
      p.id === id ? { ...p, name, url } : p
    );
    setPersonalUrls(updated);
    localStorage.setItem('nexora_personal_tv_urls', JSON.stringify(updated));
  };

  const handleRemovePersonalUrl = (id: string) => {
    const updated = personalUrls.filter(p => p.id !== id);
    setPersonalUrls(updated);
    localStorage.setItem('nexora_personal_tv_urls', JSON.stringify(updated));
  };

  const handleReorderPersonalUrls = (urls: PersonalPlaylistUrl[]) => {
    setPersonalUrls(urls);
    localStorage.setItem('nexora_personal_tv_urls', JSON.stringify(urls));
  };

  useEffect(() => {
    return () => {
      scanCancelRef.current = true;
    };
  }, [activePlaylistId]);

  const activePlaylist = useMemo(() => {
    return playlists.find(p => p.id === activePlaylistId) || null;
  }, [playlists, activePlaylistId]);

  // Aggregate global stats
  const totalChannelsAvailable = useMemo(() => {
    return playlists.reduce((acc, p) => acc + p.channels.length, 0);
  }, [playlists]);

  // Client-side stream reachability checker
  const checkChannelReachable = async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ping?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        return !!data.reachable;
      }
    } catch (e) {
      // Fallback
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        }
      });
      clearTimeout(timeoutId);
      return true; 
    } catch (err) {
      return false; 
    }
  };

  // Continuous background channel status verification
  useEffect(() => {
    if (!mounted || !activePlaylistId) return;

    let isCancelled = false;

    const runBackgroundVerify = async () => {
      if (isScanningRef.current) return;

      const currentPlaylist = playlistsRef.current.find(p => p.id === activePlaylistId);
      if (!currentPlaylist || currentPlaylist.channels.length === 0) return;

      const channelsToVerify = [...currentPlaylist.channels];
      const batchSize = 5;

      for (let i = 0; i < channelsToVerify.length; i += batchSize) {
        if (isCancelled) break;

        const batch = channelsToVerify.slice(i, i + batchSize);
        
        const results = await Promise.all(
          batch.map(async (channel) => {
            const isOnline = await checkChannelReachable(channel.url);
            return { channel, isOnline };
          })
        );

        if (isCancelled) break;

        const offlineChannels = results.filter(r => !r.isOnline).map(r => r.channel);

        if (offlineChannels.length > 0) {
          setPlaylists(prevPlaylists => {
            const updated = prevPlaylists.map(p => {
              if (p.id === activePlaylistId) {
                const remaining = p.channels.filter(ch => !offlineChannels.some(oc => oc.id === ch.id));
                return {
                  ...p,
                  channelsCount: remaining.length,
                  channels: remaining,
                };
              }
              return p;
            });
            localStorage.setItem('nexora_playlists', JSON.stringify(updated));
            return updated;
          });

          setActiveChannel(prev => {
            if (prev && offlineChannels.some(oc => oc.id === prev.id)) {
              const activePLNow = playlistsRef.current.find(p => p.id === activePlaylistId);
              if (activePLNow) {
                const remaining = activePLNow.channels.filter(ch => !offlineChannels.some(oc => oc.id === ch.id));
                return remaining[0] || null;
              }
            }
            return prev;
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    };

    runBackgroundVerify();
    const cycleInterval = setInterval(runBackgroundVerify, 30000);

    return () => {
      isCancelled = true;
      clearInterval(cycleInterval);
    };
  }, [activePlaylistId, mounted]);

  // Premium Cache & History Handlers
  const handleClearCache = () => {
    setPlaylists([]);
    setActivePlaylistId(null);
    setActiveChannel(null);
    setFavorites([]);
    setContinueWatching([]);
    setRecentlyWatched([]);
    setPersonalUrls([]);
    setPersonalChannels([]);
    setPersonalLastSynced(null);
  };

  const handleClearHistory = () => {
    setContinueWatching([]);
    setRecentlyWatched([]);
  };

  const handleImportPersonalTV = (importedUrls: any[], importedChannels: any[]) => {
    setPersonalUrls(importedUrls);
    setPersonalChannels(importedChannels);

    const personalTvPlaylist: IPTVPlaylist = {
      id: 'personal_tv',
      name: 'Personal TV',
      channelsCount: importedChannels.length,
      channels: importedChannels,
      url: 'local://personal_tv'
    };

    setPlaylists(prev => {
      const filtered = prev.filter(p => p.id !== 'personal_tv');
      const updated = [personalTvPlaylist, ...filtered];
      localStorage.setItem('nexora_playlists', JSON.stringify(updated));
      return updated;
    });

    setActivePlaylistId('personal_tv');
    if (importedChannels.length > 0) {
      setActiveChannel(importedChannels[0]);
    }
    setActiveTab('watch');
  };

  return (
    <main id="app-root-main" className="min-h-screen bg-[#02040a] text-slate-100 selection:bg-blue-500 selection:text-black pb-24 md:pb-6">
      {/* Top Premium Nav Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[1.5px] shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse">
              <div className="w-full h-full rounded-[10px] bg-[#02040a] flex items-center justify-center">
                <Tv className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                  NEXORA
                </span>
                <span className="px-1.5 py-0.2 bg-blue-500/10 border border-blue-500/20 text-[8px] font-bold text-blue-400 tracking-wider rounded uppercase">
                  V2.5 PREMIUM
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">100% Playlist-Driven IPTV Client</p>
            </div>
          </div>

          {/* Quick HUD Counters */}
          <div className="hidden md:flex items-center gap-6 text-[11px] text-slate-400 font-mono">
            <div className="flex items-center gap-2 border-r border-white/10 pr-6">
              <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>Loaded Channels: <strong className="text-white font-bold">{mounted ? totalChannelsAvailable : '--'}</strong></span>
            </div>
            <div className="flex items-center gap-2 border-r border-white/10 pr-6">
              <Trophy className="w-3.5 h-3.5 text-purple-400" />
              <span>Active Playlists: <strong className="text-white font-bold">{mounted ? playlists.length : '--'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pipeline: <strong className="text-blue-400 font-bold">CORS AutoBypass</strong></span>
            </div>
          </div>

          {/* Header Tab Navigation for Desktop */}
          <div className="hidden md:flex bg-white/5 border border-white/10 p-1 rounded-xl backdrop-blur-md">
            {[
              { id: 'watch', label: 'Watch Live', icon: Tv },
              { id: 'import', label: 'Playlists', icon: List },
              { id: 'sports', label: 'Sports Hub', icon: Trophy },
              { id: 'personal', label: 'Personal TV', icon: Radio },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none ${
                    isActive 
                      ? 'bg-blue-500 text-black shadow-lg font-bold shadow-blue-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Playlists Switcher HUD if there are multiple */}
        {playlists.length > 1 && activeTab !== 'settings' && (
          <div className="mb-6 p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 overflow-x-auto backdrop-blur-md">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Playlists:</span>
            {playlists.map((p) => {
              const isActive = p.id === activePlaylistId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlaylist(p.id)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer select-none whitespace-nowrap ${
                    isActive 
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/5' 
                      : 'border-white/10 bg-black/40 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-slate-400 font-mono">
                    {p.channels.length}
                  </span>
                  <button 
                    onClick={(e) => handleDeletePlaylist(p.id, e)}
                    className="text-slate-500 hover:text-red-400 transition ml-1"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic Views Tab Router with Premium Butter-Smooth Transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {activeTab === 'watch' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                 {/* Left Col: Stream player & Info (Takes 8/12 cols) */}
                 <div className="lg:col-span-8 flex flex-col gap-6">
                   {/* Portaled Player Targets */}
                   <div id="live-player-video-target" className="w-full" />
                   <div id="live-player-info-target" className="w-full" />
 
                   {/* Continue Watching Carousel */}
                   {mounted && continueWatching.length > 0 && (
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl animate-fade-in flex flex-col gap-3.5">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                             <Clock className="w-4 h-4" />
                           </div>
                           <div>
                             <h4 className="text-xs font-bold text-white tracking-tight uppercase">Continue Watching</h4>
                             <p className="text-[10px] text-slate-500">Resume playing recently streamed channels</p>
                           </div>
                         </div>
                         <button
                           onClick={() => {
                             setContinueWatching([]);
                             localStorage.removeItem('nexora_continue_watching');
                           }}
                           className="text-[9px] font-bold text-slate-500 hover:text-red-400 transition cursor-pointer select-none border border-white/5 hover:border-red-500/20 bg-black/20 hover:bg-red-500/10 px-2 py-1 rounded-lg"
                         >
                           Clear History
                         </button>
                       </div>
                       
                       <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/5">
                         {continueWatching.map((ch) => {
                           const isActive = activeChannel?.id === ch.id;
                           return (
                             <div
                               key={ch.id}
                               onClick={() => handleSelectChannel(ch)}
                               className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer select-none flex-shrink-0 min-w-[210px] max-w-[250px] group/cw ${
                                 isActive 
                                   ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                   : 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/5'
                               }`}
                             >
                               <div className="w-10 h-10 rounded-lg bg-black border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0">
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
                                   <Tv className="w-4 h-4 text-slate-500" />
                                 )}
                               </div>
                               <div className="min-w-0 flex-1">
                                 <p className="text-xs font-bold text-white truncate group-hover/cw:text-blue-400 transition">{ch.name}</p>
                                 <span className="text-[9px] font-bold text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                                   {ch.group}
                                 </span>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}

                   {/* Recently Watched Carousel */}
                   {mounted && recentlyWatched.length > 0 && (
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl animate-fade-in flex flex-col gap-3.5">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                             <Clock className="w-4 h-4" />
                           </div>
                           <div>
                             <h4 className="text-xs font-bold text-white tracking-tight uppercase">Recently Watched</h4>
                             <p className="text-[10px] text-slate-500">Quick-replay your last 20 active streams</p>
                           </div>
                         </div>
                         <button
                           onClick={() => {
                             setRecentlyWatched([]);
                             localStorage.removeItem('nexora_recently_watched');
                           }}
                           className="text-[9px] font-bold text-slate-500 hover:text-red-400 transition cursor-pointer select-none border border-white/5 hover:border-red-500/20 bg-black/20 hover:bg-red-500/10 px-2 py-1 rounded-lg"
                         >
                           Clear History
                         </button>
                       </div>
                       
                       <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/5">
                         {recentlyWatched.map((ch) => {
                           const isActive = activeChannel?.id === ch.id;
                           return (
                             <div
                               key={ch.id}
                               onClick={() => handleSelectChannel(ch)}
                               className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer select-none flex-shrink-0 min-w-[220px] max-w-[260px] group/rw ${
                                 isActive 
                                   ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                                   : 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/5'
                               }`}
                             >
                               <div className="w-10 h-10 rounded-lg bg-black border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0">
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
                                   <Tv className="w-4 h-4 text-slate-500" />
                                 )}
                               </div>
                               <div className="min-w-0 flex-1">
                                 <p className="text-xs font-bold text-white truncate group-hover/rw:text-indigo-400 transition">{ch.name}</p>
                                 <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                   <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded truncate max-w-[100px]">
                                     {ch.group}
                                   </span>
                                   <span className="text-[8px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.2 rounded whitespace-nowrap">
                                     {formatWatchedAt(ch.watchedAt)}
                                   </span>
                                 </div>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}
                </div>

                {/* Right Col: Channel index side directory (Takes 4/12 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-5 backdrop-blur-lg h-full flex flex-col">
                    <div className="border-b border-white/10 pb-3 mb-4">
                      <h3 className="text-sm font-bold text-white tracking-tight">Channels Directory</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Select and stream digital broadcast networks</p>
                    </div>
                    
                    {activePlaylist && activePlaylist.channels.length > 0 ? (
                      <ChannelList 
                        channels={activePlaylist.channels}
                        activeChannelId={activeChannel?.id}
                        onSelectChannel={handleSelectChannel}
                        favorites={favorites}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertCircle className="w-12 h-12 text-zinc-700 mb-3" />
                        <h4 className="text-sm font-semibold text-zinc-400">No Playlist Active</h4>
                        <p className="text-xs text-zinc-600 max-w-xs mt-1">
                          Load an M3U stream URL or drop a playlist file under Playlists to activate live streams.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'import' && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-3 mb-4">
                  <h2 className="text-lg font-bold text-white tracking-tight">IPTV & M3U Playlist Controller</h2>
                  <p className="text-xs text-slate-500">Add, parse, and coordinate local/remote stream configurations securely.</p>
                </div>
                
                <PlaylistManager 
                  onPlaylistLoaded={handlePlaylistLoaded}
                  activePlaylistId={activePlaylistId}
                  loadedPlaylistsCount={playlists.length}
                  activePlaylist={activePlaylist}
                  isScanning={isScanning}
                  scanProgress={scanProgress}
                  onReScan={handleReScan}
                />
              </div>
            )}

            {activeTab === 'sports' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Col: Stream schedule details */}
                <div className="lg:col-span-6 space-y-6">
                  <div className="border-b border-white/10 pb-3">
                    <h2 className="text-lg font-bold text-white tracking-tight">Sports Streaming Dashboard</h2>
                    <p className="text-xs text-slate-500">Map global sporting schedules directly to live network broadcasts.</p>
                  </div>
                  
                  <SportsSchedule 
                    channels={activePlaylist ? activePlaylist.channels : EMPTY_CHANNELS}
                    onSelectChannel={(ch) => {
                      handleSelectChannel(ch);
                      setActiveTab('watch');
                    }}
                  />
                </div>

                {/* Right Col: Sports category channels index helper */}
                <div className="lg:col-span-6 bg-black/20 border border-white/10 rounded-2xl p-5 backdrop-blur-lg">
                  <h3 className="text-sm font-bold text-white tracking-tight mb-4">Detected Sports Channels</h3>
                  
                  {activePlaylist && activePlaylist.channels.length > 0 ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-300 leading-normal flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <p>
                          Scanning active playlist for Sports channels, live matches, Bein Sports, ESPN, and more. Select a station below to watch instantly.
                        </p>
                      </div>

                      <ChannelList 
                        channels={activePlaylist.channels.filter(c => {
                          const grp = (c.group || '').toLowerCase();
                          const name = (c.name || '').toLowerCase();
                          return grp.includes('sport') || name.includes('sport') || name.includes('bein') || name.includes('espn');
                        })}
                        activeChannelId={activeChannel?.id}
                        onSelectChannel={(ch) => {
                          handleSelectChannel(ch);
                          setActiveTab('watch');
                        }}
                        favorites={favorites}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-xs text-zinc-500">Please load a playlist to view sports directories.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'personal' && (
              <PersonalTVManager
                playlistUrls={personalUrls}
                onAddUrl={handleAddPersonalUrl}
                onEditUrl={handleEditPersonalUrl}
                onRemoveUrl={handleRemovePersonalUrl}
                onReorderUrls={handleReorderPersonalUrls}
                onSync={handleSyncPersonalTV}
                isSyncing={personalIsSyncing}
                syncProgress={personalSyncProgress}
                liveChannels={personalChannels}
                lastSynced={personalLastSynced}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsManager 
                onClearCache={handleClearCache}
                onClearHistory={handleClearHistory}
                onImportPersonalTV={handleImportPersonalTV}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </div>

      {/* Floating Community Links Dock - hidden on small mobile to avoid layout clutter */}
      {mounted && (
        <div id="floating-community-dock" className="fixed bottom-4 left-4 z-50 hidden sm:flex flex-row gap-2.5">
          <a
            href={COMMUNITY_CONFIG.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-[11px] font-bold shadow-lg transition-all duration-300 transform hover:scale-[1.03] select-none"
          >
            <Send className="w-3.5 h-3.5 fill-current" />
            <span>Join our Telegram</span>
          </a>
          <a
            href={COMMUNITY_CONFIG.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold border border-white/10 shadow-lg transition-all duration-300 transform hover:scale-[1.03] select-none"
          >
            <Facebook className="w-3.5 h-3.5" />
            <span>Follow our Facebook Page</span>
          </a>
        </div>
      )}

      {/* Mobile App Bottom Navigation Bar Sticky HUD */}
      {mounted && (
        <div className="fixed bottom-0 inset-x-0 bg-[#02040a]/95 backdrop-blur-xl border-t border-white/10 z-40 md:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          <div className="flex justify-around items-center h-16 px-2">
            {[
              { id: 'watch', label: 'Watch Live', icon: Tv },
              { id: 'import', label: 'Playlists', icon: List },
              { id: 'sports', label: 'Sports', icon: Trophy },
              { id: 'personal', label: 'Personal', icon: Radio },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-200 select-none cursor-pointer ${
                    isActive ? 'text-blue-400 scale-105' : 'text-slate-500 active:scale-95'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'stroke-[1.8px]'}`} />
                  <span className={`text-[9px] font-bold tracking-tight ${isActive ? 'font-extrabold text-white' : 'text-slate-500'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-md py-10 mt-16 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="text-white font-bold tracking-widest text-[11px] bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              NEXORA STREAMING PIPELINE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-slate-500 text-[10px]">ALL PIPELINES OPERATIONAL</span>
          </div>
          <p className="max-w-xl mx-auto leading-relaxed text-[11px] text-slate-400">
            NEXORA is a high-fidelity IPTV and M3U playlist media player. It does not compile, host, or source any video content itself. Users must supply their own legal stream links. Bypasses browser cross-origin limits using local proxy pipelines automatically.
          </p>
          
          {/* Footer Community Buttons */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5 mt-4">
            <a
              href={COMMUNITY_CONFIG.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-400 transition flex items-center gap-1.5 text-[11px] font-bold"
            >
              <Send className="w-3.5 h-3.5" />
              Telegram Channel
            </a>
            <span className="text-zinc-800">•</span>
            <a
              href={COMMUNITY_CONFIG.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-400 transition flex items-center gap-1.5 text-[11px] font-bold"
            >
              <Facebook className="w-3.5 h-3.5" />
              Facebook Page
            </a>
          </div>

          <div className="pt-2 text-[10px] text-slate-600">
            © 2026 NEXORA. Engineered securely with Next.js, Framer, and HLS protocols.
          </div>
        </div>
      </footer>

      {/* Global LivePlayer Instance for continuity & Mini Player */}
      {mounted && (
        <LivePlayer 
          channel={activeChannel} 
          channels={activePlaylist?.channels ?? EMPTY_CHANNELS}
          onSelectChannel={handleSelectChannel}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={activeChannel ? favorites.includes(activeChannel.id) : false}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}
    </main>
  );
}
