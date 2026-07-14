'use client';

import React, { useMemo } from 'react';
import { 
  Trophy, Tv, Play, ChevronRight, Zap, Target, Flame, Globe, Languages 
} from 'lucide-react';
import { IPTVChannel } from '@/lib/iptv-parser';

interface SportsScheduleProps {
  channels: IPTVChannel[];
  onSelectChannel: (channel: IPTVChannel) => void;
}

export default function SportsSchedule({ channels, onSelectChannel }: SportsScheduleProps) {
  
  // Dynamically filter all active sports channels from the loaded playlist
  const sportsChannels = useMemo(() => {
    if (!channels || channels.length === 0) return [];
    return channels.filter(ch => {
      const grp = (ch.group || '').toLowerCase();
      const name = (ch.name || '').toLowerCase();
      return grp.includes('sport') || 
             name.includes('sport') || 
             name.includes('bein') || 
             name.includes('espn') || 
             name.includes('arena') || 
             name.includes('eurosport') || 
             name.includes('sky s') ||
             name.includes('f1') ||
             name.includes('golf') ||
             name.includes('football') ||
             name.includes('soccer');
    });
  }, [channels]);

  return (
    <div id="sports-schedule-container" className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Active Live Sports Networks</h3>
            <p className="text-[10px] text-slate-500">
              {sportsChannels.length > 0 
                ? `Detected ${sportsChannels.length} active live sports broadcasters in your playlist`
                : 'Import a playlist with Sports networks to stream'
              }
            </p>
          </div>
        </div>

        {sportsChannels.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
            <Flame className="w-3 h-3 fill-current" />
            Live Hub
          </span>
        )}
      </div>

      <div className="divide-y divide-white/10 max-h-[380px] overflow-y-auto pr-1 space-y-2.5">
        {sportsChannels.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <Trophy className="w-10 h-10 text-slate-600 mb-2" />
            <span className="text-xs font-bold text-slate-400">No Sports Channels Found</span>
            <p className="text-[10px] text-slate-500 max-w-xs mt-1">
              Add a playlist URL containing sports groups or sport keywords to populate this hub automatically.
            </p>
          </div>
        ) : (
          sportsChannels.map((channel, idx) => (
            <div 
              key={channel.id || `sports-${idx}`}
              className="pt-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group/event"
            >
              <div className="space-y-1">
                {/* Group Tag / Auto Status */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-300 font-bold uppercase tracking-wider">
                    {channel.group || 'Sports'}
                  </span>
                  
                  <span className="flex items-center gap-1 text-[9px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.5 rounded border border-blue-500/20">
                    <span className="w-1 h-1 rounded-full bg-blue-400 animate-ping" />
                    LIVE
                  </span>

                  {channel.country && channel.country !== 'International' && (
                    <span className="flex items-center gap-1 text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded border border-white/10">
                      <Globe className="w-2.5 h-2.5" />
                      {channel.country}
                    </span>
                  )}

                  {channel.language && channel.language !== 'English' && (
                    <span className="flex items-center gap-1 text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded border border-white/10">
                      <Languages className="w-2.5 h-2.5" />
                      {channel.language}
                    </span>
                  )}
                </div>

                {/* Channel logo & Name */}
                <div className="flex items-center gap-2">
                  {channel.logo ? (
                    <img 
                      src={channel.logo} 
                      alt={channel.name} 
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                      className="w-5 h-5 rounded object-contain bg-black/40 p-0.5"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Tv className="w-3 h-3 text-blue-400" />
                    </div>
                  )}
                  <h4 className="text-xs font-bold text-white group-hover/event:text-blue-400 transition">
                    {channel.name}
                  </h4>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectChannel(channel)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-blue-500 text-black hover:bg-blue-400 shadow-lg shadow-blue-500/15 cursor-pointer transition select-none active:scale-95"
              >
                <Play className="w-3 h-3 fill-current" />
                Tune In
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
