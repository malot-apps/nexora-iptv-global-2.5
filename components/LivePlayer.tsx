'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { motion } from 'motion/react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv, AlertCircle, 
  Loader2, Info, RefreshCw, Settings, ShieldAlert, Sliders, Check,
  RotateCcw, RotateCw, Camera, Lock, Unlock, Sun, ChevronDown, X
} from 'lucide-react';
import { IPTVChannel } from '@/lib/iptv-parser';
import { 
  PROXY_PROVIDERS, 
  getPreferredProxyId, 
  setPreferredProxyId, 
  isAutoProxyEnabled, 
  setAutoProxyEnabled, 
  detectCorsIssue, 
  formatProxiedUrl 
} from '@/lib/streamProxy';

interface LivePlayerProps {
  channel: IPTVChannel | null;
  channels?: IPTVChannel[];
  onSelectChannel?: (channel: IPTVChannel) => void;
  onToggleFavorite?: (channel: IPTVChannel) => void;
  isFavorite?: boolean;
  activeTab?: string;
  setActiveTab?: (tab: 'watch' | 'import' | 'sports' | 'personal' | 'settings') => void;
}

// Pure helper outside component to satisfy strict react purity rules
function getTimestamp(): number {
  return new Date().getTime();
}

export default function LivePlayer({ 
  channel, 
  channels, 
  onSelectChannel, 
  onToggleFavorite, 
  isFavorite,
  activeTab,
  setActiveTab
}: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const failureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const splashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs to avoid over-broad dependencies in stream playback
  const channelsRef = useRef(channels);
  const onSelectChannelRef = useRef(onSelectChannel);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    onSelectChannelRef.current = onSelectChannel;
  }, [onSelectChannel]);

  // General unmount cleanup to avoid any stray timeouts
  useEffect(() => {
    return () => {
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
      if (failureTimeoutRef.current) clearTimeout(failureTimeoutRef.current);
      if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
    };
  }, []);

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Duration & Seek Track
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Premium Features State
  const [brightness, setBrightness] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLocked, setIsLocked] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [splash, setSplash] = useState<'forward' | 'rewind' | 'volume' | 'brightness' | null>(null);
  const [splashValue, setSplashValue] = useState('');

  // Premium Mini Player State
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [miniShellTarget, setMiniShellTarget] = useState<HTMLDivElement | null>(null);

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Dedicated channel-change effect
  useEffect(() => {
    setRetryCount(0);
    setErrorMsg(null);
    setIsMiniDismissed(false);
    if (failureTimeoutRef.current) {
      clearTimeout(failureTimeoutRef.current);
      failureTimeoutRef.current = null;
    }
  }, [channel?.id]);

  // Proxy State
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [currentProxyId, setCurrentProxyId] = useState<string>('direct');
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<{
    format: string;
    resolution: string;
    latency: string;
    buffer: string;
  } | null>(null);

  const [preferredProxyId, setPreferredProxyIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'local';
    return getPreferredProxyId();
  });
  const [autoProxy, setAutoProxy] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return isAutoProxyEnabled();
  });

  // HUD Auto-hide and Activity
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHudActivity = () => {
    setIsHudVisible(true);
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
    }
    hudTimeoutRef.current = setTimeout(() => {
      setIsHudVisible(false);
    }, 4000);
  };

  const isMini = activeTab !== 'watch';
  const shouldShowHud = (isHudVisible || isHovered || showSettings) && !isLocked && !isMini;

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    // If clicking a button or control, don't drag
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    
    draggingRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const nextX = clientX - dragStartRef.current.x;
    const nextY = clientY - dragStartRef.current.y;
    
    setPosition({ x: nextX, y: nextY });
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
  }, []);

  useEffect(() => {
    if (isMini) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isMini, handleDragMove, handleDragEnd]);

  // Reappear smoothly when stream state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerHudActivity();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (hudTimeoutRef.current) {
        clearTimeout(hudTimeoutRef.current);
      }
    };
  }, [channel?.id, resolvedUrl, currentProxyId]);

  // Fullscreen controller (hoisted to prevent "accessed before declaration" issues)
  const handleToggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error(err));
    }
  }, []);

  const handleProxyChange = (id: string) => {
    setPreferredProxyId(id);
    setPreferredProxyIdState(id);
  };

  const handleToggleAutoProxy = () => {
    const nextVal = !autoProxy;
    setAutoProxyEnabled(nextVal);
    setAutoProxy(nextVal);
  };

  const channelUrl = channel?.url;
  const channelId = channel?.id;

  // Resolve stream URL based on auto CORS detection
  useEffect(() => {
    let isCancelled = false;

    const resolveUrl = async () => {
      await Promise.resolve();
      if (isCancelled) return;

      if (!channelUrl) {
        setResolvedUrl('');
        return;
      }

      setIsResolving(true);
      setErrorMsg(null);

      if (autoProxy) {
        const hasCorsIssue = await detectCorsIssue(channelUrl);
        if (isCancelled) return;

        if (hasCorsIssue) {
          setCurrentProxyId(preferredProxyId);
          setResolvedUrl(formatProxiedUrl(channelUrl, preferredProxyId));
        } else {
          setCurrentProxyId('direct');
          setResolvedUrl(channelUrl);
        }
      } else {
        setCurrentProxyId(preferredProxyId);
        setResolvedUrl(formatProxiedUrl(channelUrl, preferredProxyId));
      }
      setIsResolving(false);
    };

    resolveUrl();

    return () => {
      isCancelled = true;
    };
  }, [channelUrl, preferredProxyId, autoProxy]);

  // Sync playbackSpeed preference to video player elements
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Initialize and load stream
  useEffect(() => {
    if (!channelId || !resolvedUrl) return;

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setIsPlaying(false);
    setIsBuffering(false);
    setStats(null);
    setCurrentTime(0);
    setDuration(0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = resolvedUrl;

    const handleStreamFailure = () => {
      if (failureTimeoutRef.current) {
        clearTimeout(failureTimeoutRef.current);
      }

      if (retryCount < 2) {
        const proxiesToTry = PROXY_PROVIDERS.filter(p => p.id !== currentProxyId && p.id !== 'direct');
        const fallbackProxy = proxiesToTry[retryCount % proxiesToTry.length] || PROXY_PROVIDERS[0];

        setErrorMsg(`Connecting failed. Auto rotating proxy... (Attempt ${retryCount + 1}/3)`);
        setIsLoading(true);

        failureTimeoutRef.current = setTimeout(() => {
          setCurrentProxyId(fallbackProxy.id);
          if (channelUrl) {
            setResolvedUrl(formatProxiedUrl(channelUrl, fallbackProxy.id));
          }
          setRetryCount(prev => prev + 1);
        }, 2000);
      } else {
        const currentChannels = channelsRef.current;
        const currentOnSelectChannel = onSelectChannelRef.current;
        if (currentChannels && currentChannels.length > 1 && currentOnSelectChannel) {
          const currentIndex = currentChannels.findIndex(ch => ch.id === channelId);
          const nextIndex = (currentIndex + 1) % currentChannels.length;
          const nextChannel = currentChannels[nextIndex];
          
          setErrorMsg(`Live track offline. Automatically trying alternative station...`);
          setIsLoading(true);
          failureTimeoutRef.current = setTimeout(() => {
            setRetryCount(0);
            currentOnSelectChannel(nextChannel);
          }, 3000);
        } else {
          setErrorMsg('Stream unavailable. Checked all connection routing options.');
          setIsLoading(false);
        }
      }
    };

    const watchdogTimer = setTimeout(() => {
      setIsLoading(false);
      handleStreamFailure();
    }, 8500);

    // Buffering & Timing event handlers
    const handleWaiting = () => setIsBuffering(true);
    const handlePlayingEvent = () => {
      setIsBuffering(false);
      setIsLoading(false);
    };
    const handleStalled = () => setIsBuffering(true);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    };

    let handleLoadedMetadata = () => {
      clearTimeout(watchdogTimer);
      setIsLoading(false);
      setErrorMsg(null);
      
      const shouldAutoplay = localStorage.getItem('nexora_autoplay') !== 'false';
      if (shouldAutoplay) {
        video.play()
          .then(() => {
            setIsPlaying(true);
            const shouldAutoFS = localStorage.getItem('nexora_auto_fullscreen') === 'true';
            if (shouldAutoFS) handleToggleFullscreen();
          })
          .catch(() => setIsPlaying(false));
      }

      setStats({
        format: 'Native HLS',
        resolution: `${video.videoWidth}x${video.videoHeight}` || 'Safari Auto',
        latency: 'Dynamic Stream',
        buffer: 'Optimized',
      });
    };

    let handleNativeError = () => {
      clearTimeout(watchdogTimer);
      handleStreamFailure();
    };

    let handleLoadedData = () => {
      clearTimeout(watchdogTimer);
      setIsLoading(false);
      setErrorMsg(null);
      const shouldAutoplay = localStorage.getItem('nexora_autoplay') !== 'false';
      if (shouldAutoplay) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    };

    let handleDirectError = () => {
      clearTimeout(watchdogTimer);
      handleStreamFailure();
    };

    // Attach buffering handlers
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlayingEvent);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('timeupdate', handleTimeUpdate);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferSize: 30 * 1000 * 1000,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        clearTimeout(watchdogTimer);
        setIsLoading(false);
        setErrorMsg(null);
        
        const shouldAutoplay = localStorage.getItem('nexora_autoplay') !== 'false';
        if (shouldAutoplay) {
          video.play()
            .then(() => {
              setIsPlaying(true);
              const shouldAutoFS = localStorage.getItem('nexora_auto_fullscreen') === 'true';
              if (shouldAutoFS) handleToggleFullscreen();
            })
            .catch(() => setIsPlaying(false));
        }

        const levels = hls.levels;
        const currentLevel = levels[hls.currentLevel] || levels[0];
        setStats({
          format: 'HLS / .M3U8',
          resolution: currentLevel ? `${currentLevel.width}x${currentLevel.height}` : 'HD Auto',
          latency: 'Low Latency Mode',
          buffer: 'Stable Cache',
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              clearTimeout(watchdogTimer);
              if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
              }
              handleStreamFailure();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleNativeError);
    } else {
      video.src = streamUrl;
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleDirectError);
    }

    return () => {
      clearTimeout(watchdogTimer);
      if (failureTimeoutRef.current) {
        clearTimeout(failureTimeoutRef.current);
      }
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlayingEvent);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleNativeError);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleDirectError);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelId, channelUrl, resolvedUrl, retryCount, currentProxyId, handleToggleFullscreen]);

  // Sync volume state
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = isMuted ? 0 : volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  // ------------------ GESTURE INDICATORS ------------------
  const showSplashIndicator = useCallback((type: 'forward' | 'rewind' | 'volume' | 'brightness', value: string) => {
    setSplash(type);
    setSplashValue(value);
    if (splashTimeoutRef.current) {
      clearTimeout(splashTimeoutRef.current);
    }
    splashTimeoutRef.current = setTimeout(() => {
      setSplash(null);
    }, 800);
  }, []);

  // Play / Pause
  const handlePlayPause = useCallback(() => {
    if (isLocked) return;
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
    triggerHudActivity();
  }, [isLocked, isPlaying]);

  const handleToggleMute = useCallback(() => {
    if (isLocked) return;
    setIsMuted(prev => {
      const nextMuted = !prev;
      showSplashIndicator('volume', nextMuted ? 'Muted' : 'Unmuted');
      return nextMuted;
    });
  }, [isLocked, showSplashIndicator]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0) setIsMuted(false);
  };

  // Forward / Rewind 10s
  const handleRewind = () => {
    if (isLocked) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(video.currentTime - 10, 0);
    showSplashIndicator('rewind', '-10s');
    triggerHudActivity();
  };

  const handleForward = () => {
    if (isLocked) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.currentTime + 10, video.duration || video.currentTime + 10);
    showSplashIndicator('forward', '+10s');
    triggerHudActivity();
  };

  // Picture in Picture
  const handleTogglePiP = useCallback(async () => {
    if (isLocked) return;
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.error(e);
    }
  }, [isLocked]);

  // Playback speed
  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
      showSplashIndicator('forward', `${speed}x Speed`);
    }
    setShowSpeedMenu(false);
  };

  // Screenshot generator
  const handleScreenshot = useCallback(() => {
    if (isLocked) return;
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = dataUrl;
        downloadAnchor.download = `nexora_premium_screenshot_${getTimestamp()}.png`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showSplashIndicator('brightness', 'Screenshot Taken');
      }
    } catch (err) {
      console.warn('Screenshot failed due to CORS security restriction:', err);
      alert('Secure Stream Protection: This broadcast feed is encrypted or CORS-protected. Screenshots are restricted by your browser.');
    }
  }, [isLocked, showSplashIndicator]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      const video = videoRef.current;
      if (!video) return;

      if (isLocked) {
        if (e.key === 'l' || e.key === 'L') {
          setIsLocked(false);
          showSplashIndicator('brightness', 'Unlocked');
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => {
            const nv = Math.min(prev + 0.05, 1);
            showSplashIndicator('volume', `${Math.round(nv * 100)}%`);
            return nv;
          });
          setIsMuted(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => {
            const nv = Math.max(prev - 0.05, 0);
            showSplashIndicator('volume', `${Math.round(nv * 100)}%`);
            return nv;
          });
          setIsMuted(false);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(video.currentTime - 10, 0);
          showSplashIndicator('rewind', '-10s');
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.currentTime + 10, video.duration || video.currentTime + 10);
          showSplashIndicator('forward', '+10s');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          handleToggleMute();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          handleTogglePiP();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          handleScreenshot();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          setIsLocked(true);
          showSplashIndicator('brightness', 'Locked');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted, isLocked, brightness, handlePlayPause, handleToggleFullscreen, handleToggleMute, handleTogglePiP, handleScreenshot, showSplashIndicator]);

  // ------------------ MOBILE SWIPE & TAP DETECTION ------------------
  const touchStartRef = useRef<{ x: number; y: number; vol: number; bri: number } | null>(null);
  const touchActiveRef = useRef<'volume' | 'brightness' | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const handleVideoTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const now = Date.now();
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container || !touch) return;
    
    const rect = container.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    touchStartRef.current = { x: touchX, y: touchY, vol: volume, bri: brightness };
    touchActiveRef.current = touchX < rect.width / 2 ? 'brightness' : 'volume';

    // Double tap check
    if (lastTapRef.current) {
      const timeDiff = now - lastTapRef.current.time;
      const distDiff = Math.hypot(touchX - lastTapRef.current.x, touchY - lastTapRef.current.y);
      if (timeDiff < 300 && distDiff < 40) {
        const isRightSide = touchX > rect.width / 2;
        const video = videoRef.current;
        if (video) {
          if (isRightSide) {
            video.currentTime = Math.min(video.currentTime + 10, video.duration || video.currentTime + 10);
            showSplashIndicator('forward', '+10s');
          } else {
            video.currentTime = Math.max(video.currentTime - 10, 0);
            showSplashIndicator('rewind', '-10s');
          }
        }
        lastTapRef.current = null;
        return;
      }
    }
    lastTapRef.current = { time: now, x: touchX, y: touchY };
  };

  const handleVideoTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isLocked || !touchStartRef.current) return;
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container || !touch) return;
    
    const rect = container.getBoundingClientRect();
    const currentY = touch.clientY - rect.top;
    const deltaY = touchStartRef.current.y - currentY;
    const percentDelta = deltaY / rect.height; // -1 to 1

    if (touchActiveRef.current === 'volume') {
      const nextVol = Math.max(0, Math.min(1, touchStartRef.current.vol + percentDelta));
      setVolume(nextVol);
      setIsMuted(false);
      showSplashIndicator('volume', `${Math.round(nextVol * 100)}%`);
    } else if (touchActiveRef.current === 'brightness') {
      const nextBri = Math.max(0.2, Math.min(1.8, touchStartRef.current.bri + percentDelta));
      setBrightness(nextBri);
      showSplashIndicator('brightness', `${Math.round(nextBri * 100)}%`);
    }
    triggerHudActivity();
  };

  const handleVideoTouchEnd = () => {
    touchStartRef.current = null;
    touchActiveRef.current = null;
  };

  // Helper formats
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLive = duration === Infinity || duration === 0;

  const showMiniPlayer = isMini && channel && (isPlaying || isLoading || isBuffering) && !isMiniDismissed;

  if (isMini) {
    if (!showMiniPlayer) return null;
  } else {
    if (!channel) {
      return (
        <div className="flex flex-col items-center justify-center h-[500px] border border-dashed border-white/10 rounded-2xl bg-white/5 text-center px-4 backdrop-blur-lg">
          <Tv className="w-16 h-16 text-blue-500/60 mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-white">No Stream Selected</h3>
          <p className="text-sm text-slate-400 max-w-sm mt-2">
            Select a channel from the sidebar or import your custom M3U playlist to begin live streaming.
          </p>
        </div>
      );
    }
  }

  const containerClasses = isMini
    ? "relative w-full h-full bg-black overflow-hidden group select-none"
    : "relative aspect-video w-full rounded-2xl bg-black border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] group select-none";

  const videoContainerJSX = (
    <div 
      ref={containerRef}
      id="live-player-container"
      onMouseMove={isMini ? undefined : triggerHudActivity}
      onTouchStart={isMini ? undefined : handleVideoTouchStart}
      onTouchMove={isMini ? undefined : handleVideoTouchMove}
      onTouchEnd={isMini ? undefined : handleVideoTouchEnd}
      className={containerClasses}
    >
        <video
          ref={videoRef}
          id="live-player-video"
          className="w-full h-full object-contain cursor-pointer transition-all duration-200"
          onClick={handlePlayPause}
          playsInline
          style={{ filter: `brightness(${brightness})` }}
        />

        {/* Splash Gesture Indicators */}
        {splash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-fade-in">
            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-black/80 rounded-2xl border border-white/10 text-white backdrop-blur-md shadow-2xl">
              {splash === 'volume' && (volume === 0 || isMuted ? <VolumeX className="w-8 h-8 text-red-400" /> : <Volume2 className="w-8 h-8 text-blue-400" />)}
              {splash === 'brightness' && <Sun className="w-8 h-8 text-amber-400" />}
              {splash === 'forward' && <RotateCw className="w-8 h-8 text-blue-400" />}
              {splash === 'rewind' && <RotateCcw className="w-8 h-8 text-blue-400" />}
              <span className="text-xs font-bold font-mono">{splashValue}</span>
            </div>
          </div>
        )}

        {/* Lock Mode Padlock Button */}
        {isLocked && (
          <div className="absolute top-4 right-4 z-40 animate-fade-in">
            <button 
              onClick={() => {
                setIsLocked(false);
                showSplashIndicator('brightness', 'Unlocked');
              }}
              className="p-2.5 rounded-full bg-red-600 hover:bg-red-500 border border-red-500 text-white shadow-2xl transition scale-110 active:scale-95 cursor-pointer"
              title="Click to Unlock Controls"
            >
              <Lock className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        )}

        {/* Buffer Indicator & Loading Overlay */}
        {(isLoading || isResolving || isBuffering) && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 z-20 backdrop-blur-[2px]">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <span className="text-slate-300 text-xs font-semibold animate-pulse">
              {isResolving ? 'Authenticating Route CORS...' : isBuffering ? 'Re-buffering segments...' : 'Loading Premium stream feed...'}
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {errorMsg && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-20 backdrop-blur-lg">
            <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
            <h4 className="text-base font-bold text-red-400">Low Latency Playback Failed</h4>
            <p className="text-xs text-slate-300 max-w-md mt-1">{errorMsg}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <button 
                onClick={() => setRetryCount(prev => prev + 1)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Feed
              </button>
              <button 
                onClick={() => {
                  setShowSettings(true);
                  setErrorMsg(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                Proxy Settings
              </button>
            </div>
            <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg max-w-lg text-left text-[10px] leading-relaxed text-slate-400">
              <span className="text-slate-200 font-bold block mb-1">🛠️ IPTV Connection Guidance:</span>
              1. Many live stream providers employ rigid Cross-Origin Restrictions (CORS). Open proxy tools above to pipe streams.
              <br />
              2. Try another working broadcast category or update personal playlists.
            </div>
          </div>
        )}

        {/* Top Channel Overlay HUD (Fades smoothly on inactivity) */}
        <div className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/95 via-black/70 to-transparent flex items-center justify-between transition-opacity duration-300 z-10 ${
          shouldShowHud ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center gap-3">
            {channel.logo ? (
              <img 
                src={channel.logo} 
                alt={channel.name} 
                className="w-10 h-10 object-contain rounded-lg bg-black border border-white/10 p-1"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-black text-white text-sm">
                {channel.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <span className="inline-block px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[9px] font-extrabold text-blue-400 uppercase tracking-widest mb-0.5">
                {channel.group}
              </span>
              <h2 className="text-white font-bold text-xs sm:text-sm line-clamp-1">{channel.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pulsing LIVE badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600/20 border border-red-500/30 rounded-lg mr-1 text-[9px] font-black tracking-widest text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>LIVE</span>
            </div>

            {onToggleFavorite && (
              <button 
                onClick={() => onToggleFavorite(channel)}
                className={`p-2 rounded-lg border backdrop-blur-md transition-all cursor-pointer ${
                  isFavorite 
                    ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400' 
                    : 'bg-black/40 border-white/10 text-white hover:bg-white/10'
                }`}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                ★
              </button>
            )}
            <button 
              onClick={() => {
                setShowSettings(!showSettings);
                setShowStats(false);
              }}
              className={`p-2 rounded-lg border backdrop-blur-md text-white transition-all cursor-pointer ${
                showSettings ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg' : 'bg-black/40 border-white/10 hover:bg-white/10'
              }`}
              title="CORS Proxy Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                setShowStats(!showStats);
                setShowSettings(false);
              }}
              className={`p-2 rounded-lg border backdrop-blur-md text-white transition-all cursor-pointer ${
                showStats ? 'bg-blue-500 text-black border-blue-600' : 'bg-black/40 border-white/10 hover:bg-white/10'
              }`}
              title="Stream Diagnostics"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Technical Stats Diagnostics */}
        {showStats && stats && (
          <div className="absolute top-16 right-4 p-3 bg-black/90 border border-white/10 rounded-xl text-[10px] font-mono text-slate-300 space-y-1 z-25 w-52 backdrop-blur-md shadow-2xl animate-fade-in">
            <div className="font-bold text-white border-b border-white/10 pb-1 mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Stream Diagnostics
            </div>
            <div>Format: <span className="text-white font-semibold">{stats.format}</span></div>
            <div>Resolution: <span className="text-white font-semibold">{stats.resolution}</span></div>
            <div>CORS Rule: <span className="text-indigo-400 font-bold uppercase">{currentProxyId === 'direct' ? 'Bypassed' : currentProxyId}</span></div>
            <div>Latency: <span className="text-blue-400 font-bold">{stats.latency}</span></div>
            <div>Buffers: <span className="text-emerald-400 font-bold">{stats.buffer}</span></div>
          </div>
        )}

        {/* CORS Settings Overlay */}
        {showSettings && (
          <div className="absolute top-16 right-4 p-4 bg-black/95 border border-white/10 rounded-xl text-xs text-slate-300 space-y-3 z-30 w-72 backdrop-blur-md shadow-2xl animate-fade-in">
            <div className="font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                Proxy Security
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                {currentProxyId.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
              <div>
                <p className="font-bold text-white text-[10px]">CORS Proxy Bypass</p>
                <p className="text-[8px] text-slate-400">Route restricted source URLs</p>
              </div>
              <button
                onClick={handleToggleAutoProxy}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  autoProxy ? 'bg-indigo-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    autoProxy ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Active Proxy Pipeline
              </span>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {PROXY_PROVIDERS.map((provider) => {
                  const isSelected = preferredProxyId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => handleProxyChange(provider.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-[9px] flex items-center gap-1">
                          {provider.name}
                        </div>
                        <p className="text-[8px] text-slate-400 mt-0.5">{provider.description}</p>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Swipe HUD Overlay (Fades on inactivity) */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9, y: 5 }}
          animate={{ 
            opacity: shouldShowHud ? 1 : 0, 
            scale: shouldShowHud ? 1 : 0.9, 
            y: shouldShowHud ? 0 : 5
          }}
          transition={{ duration: 0.3 }}
          onClick={() => {
            setShowSettings(!showSettings);
            setShowStats(false);
          }}
          className={`absolute bottom-20 right-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/75 hover:bg-black/90 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md transition-all text-[10px] font-mono cursor-pointer ${
            shouldShowHud ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-400"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="text-slate-400 font-medium">PIPELINE:</span>
          <span className="font-bold uppercase text-blue-400">
            {currentProxyId === 'direct' ? 'Direct Bypass' : (PROXY_PROVIDERS.find(p => p.id === currentProxyId)?.name || currentProxyId.toUpperCase())}
          </span>
        </motion.button>

        {/* Premium Bottom HUD Controller Bar (Fades smoothly on inactivity) */}
        <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col gap-2.5 px-4 pb-4 pt-10 transition-opacity duration-300 z-10 ${
          shouldShowHud ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
          
          {/* Seek Track Timeline Slider */}
          <div className="flex items-center gap-3 w-full">
            <span className="text-[10px] font-mono font-semibold text-slate-300">
              {formatTime(currentTime)}
            </span>
            <input 
              type="range"
              min="0"
              max={duration && isFinite(duration) ? duration : 100}
              value={currentTime}
              onChange={(e) => {
                const video = videoRef.current;
                if (video) video.currentTime = parseFloat(e.target.value);
              }}
              className="flex-1 h-1 bg-white/20 hover:bg-white/35 rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all"
            />
            <span className="text-[10px] font-mono font-semibold text-slate-300">
              {isLive ? 'LIVE' : formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center justify-between w-full">
            {/* Left Hand Controls */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button 
                onClick={handlePlayPause}
                className="p-2 rounded-full bg-blue-500 hover:bg-blue-400 text-black shadow-lg shadow-blue-500/20 transition transform active:scale-95 cursor-pointer"
                title="Play/Pause"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button 
                onClick={handleRewind}
                className="text-white hover:text-blue-400 transition cursor-pointer"
                title="Rewind 10s"
              >
                <RotateCcw className="w-4.5 h-4.5" />
              </button>

              <button 
                onClick={handleForward}
                className="text-white hover:text-blue-400 transition cursor-pointer"
                title="Fast Forward 10s"
              >
                <RotateCw className="w-4.5 h-4.5" />
              </button>

              {/* Volume Slider Section */}
              <div className="flex items-center gap-2 group/vol">
                <button onClick={handleToggleMute} className="text-white hover:text-blue-400 transition cursor-pointer">
                  {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5 text-red-400" /> : <Volume2 className="w-4.5 h-4.5" />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={isMuted ? 0 : volume} 
                  onChange={handleVolumeChange}
                  className="w-12 sm:w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500 group-hover/vol:w-20 transition-all duration-300"
                />
              </div>

              {/* Custom Resolution badge in controllers */}
              {stats && (
                <span className="hidden md:inline-block px-2 py-0.5 border border-white/10 bg-white/5 rounded font-mono text-[9px] text-slate-300">
                  {stats.resolution}
                </span>
              )}
            </div>

            {/* Right Hand Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              {/* Playback speed rate menu */}
              <div className="relative">
                <button 
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-1 text-[10px] font-mono font-bold text-white hover:text-blue-400 border border-white/10 hover:border-blue-400 bg-black/40 px-2 py-1 rounded-lg transition cursor-pointer"
                >
                  <span>{playbackSpeed}x</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-8 right-0 bg-black border border-white/10 rounded-xl p-1 shadow-2xl w-24 flex flex-col z-35 animate-fade-in">
                    {[0.5, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSpeedChange(spd)}
                        className={`text-left text-[10px] font-mono px-2.5 py-1.5 rounded-lg font-bold transition hover:bg-white/10 ${
                          playbackSpeed === spd ? 'text-blue-400' : 'text-slate-400'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Screenshot capture button */}
              <button 
                onClick={handleScreenshot}
                className="text-white hover:text-blue-400 transition cursor-pointer p-1"
                title="Capture screenshot frame"
              >
                <Camera className="w-4.5 h-4.5" />
              </button>

              {/* Lock controls button */}
              <button 
                onClick={() => {
                  setIsLocked(true);
                  showSplashIndicator('brightness', 'Locked');
                }}
                className="text-white hover:text-red-400 transition cursor-pointer p-1"
                title="Lock video interface"
              >
                <Unlock className="w-4.5 h-4.5" />
              </button>

              {/* Picture-in-Picture Trigger */}
              <button 
                onClick={handleTogglePiP}
                className="text-white hover:text-blue-400 transition cursor-pointer p-1"
                title="Toggle Picture-in-Picture"
              >
                <Tv className="w-4.5 h-4.5" />
              </button>

              {/* Theater Mode Trigger */}
              <button 
                onClick={() => setTheaterMode(!theaterMode)}
                className={`text-white hover:text-blue-400 transition text-xs font-semibold px-2 py-1 rounded-lg border border-white/10 ${
                  theaterMode ? 'bg-blue-500/20 border-blue-500 text-blue-400 font-bold' : 'bg-black/40'
                }`}
                title="Theater Mode"
              >
                <Tv className="w-4 h-4" />
              </button>

              <button onClick={handleToggleFullscreen} className="text-white hover:text-blue-400 transition cursor-pointer p-1">
                {isFullscreen ? <Minimize className="w-4.5 h-4.5" /> : <Maximize className="w-4.5 h-4.5" />}
              </button>
            </div>

          </div>

        </div>
      </div>
    );

  const infoPanelJSX = (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-white">{channel.name}</h1>
            <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
              {channel.group}
            </span>
            <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[9px] font-mono font-extrabold text-blue-400 tracking-wider">
              NEXORA SECURE STREAM FEED
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            You are streaming the digital high-definition feed for <strong>{channel.name}</strong>. Supported by NEXORA&apos;s low-latency streaming pipeline, this source parses group protocols, live transport tracks, and buffers segments locally for optimized sports and entertainment replay.
          </p>
        </div>

        <button 
          onClick={() => setRetryCount(prev => prev + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-xs font-semibold text-white transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload Feed
        </button>
      </div>
    );

  const miniPlayerShell = showMiniPlayer ? (
    <div 
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        touchAction: 'none'
      }}
      className="fixed bottom-20 right-4 w-72 sm:w-80 aspect-video rounded-xl bg-black border border-white/20 shadow-2xl overflow-hidden group select-none z-50 cursor-move transition-shadow duration-300 hover:shadow-blue-500/10 hover:border-blue-500/30 animate-fade-in"
    >
      <div ref={setMiniShellTarget} className="w-full h-full" />
      
      {/* Mini Buffer / Loading overlay */}
      {(isLoading || isResolving || isBuffering) && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5 z-30">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="text-[9px] text-slate-400 font-medium animate-pulse">
            Buffering...
          </span>
        </div>
      )}

      {/* Hover Control Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 z-40 animate-fade-in">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-white line-clamp-1 pr-4">
            {channel?.name || 'Live Stream'}
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const video = videoRef.current;
              if (video) video.pause();
              setIsPlaying(false);
              setIsMiniDismissed(true);
            }}
            className="no-drag p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition cursor-pointer"
            title="Close Player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Play/Pause */}
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause();
            }}
            className="no-drag p-2 rounded-full bg-blue-500 hover:bg-blue-400 text-black shadow-lg shadow-blue-500/20 transition transform active:scale-95 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded uppercase">
            Mini Player
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (setActiveTab) setActiveTab('watch');
            }}
            className="no-drag flex items-center gap-1 text-[9px] font-bold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition cursor-pointer"
          >
            <Maximize className="w-3 h-3" />
            <span>Maximize</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const activeVideoTarget = typeof window !== 'undefined'
    ? (activeTab === 'watch' ? document.getElementById('live-player-video-target') : miniShellTarget)
    : null;

  const activeInfoTarget = typeof window !== 'undefined'
    ? (activeTab === 'watch' ? document.getElementById('live-player-info-target') : null)
    : null;

  return (
    <>
      {/* 1. Mini Player Shell (floating on body) */}
      {typeof window !== 'undefined' && showMiniPlayer && createPortal(miniPlayerShell, document.body)}

      {/* 2. Video Container (portaled to active video target) */}
      {typeof window !== 'undefined' && activeVideoTarget && createPortal(videoContainerJSX, activeVideoTarget)}

      {/* 3. Info Panel (portaled to watch page info target) */}
      {typeof window !== 'undefined' && activeInfoTarget && createPortal(infoPanelJSX, activeInfoTarget)}
    </>
  );
}
