import React from 'react';
import { Volume2, Volume1, VolumeX, Zap, Battery, Bluetooth, Headphones } from 'lucide-react';
import { SystemHUDEvent } from '../../../../types';

interface SystemHUDProps {
  event: SystemHUDEvent;
}

export const SystemHUD: React.FC<SystemHUDProps> = ({ event }) => {
  if (event.type === 'volume') {
    const vol = event.volume ?? 0;
    const isMuted = event.isMuted || vol === 0;

    return (
      <div className="flex items-center justify-between w-full h-full px-3 select-none animate-in fade-in zoom-in-95 duration-200">
        {/* Left: Speaker Icon */}
        <div className="flex items-center shrink-0 text-white">
          {isMuted ? (
            <VolumeX size={15} className="text-rose-400" />
          ) : vol < 40 ? (
            <Volume1 size={15} className="text-zinc-200" />
          ) : (
            <Volume2 size={15} className="text-white" />
          )}
        </div>

        {/* Center: Dynamic Volume Level Bar */}
        <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden mx-3 p-[1px] relative shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-150 ease-out ${
              isMuted
                ? 'w-0 bg-transparent'
                : 'bg-gradient-to-r from-zinc-200 to-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
            }`}
            style={{ width: isMuted ? '0%' : `${Math.min(100, Math.max(0, vol))}%` }}
          />
        </div>

        {/* Right: Percentage */}
        <div className="font-clock text-[12px] font-semibold text-zinc-200 tracking-wider shrink-0 min-w-[32px] text-right">
          {isMuted ? (
            <span className="text-[10px] text-rose-400 uppercase tracking-wider">Mute</span>
          ) : (
            <span>{vol}%</span>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'charging') {
    const isCharging = event.isCharging ?? false;
    const percent = event.batteryPercent ?? 100;

    return (
      <div className="flex items-center justify-between w-full h-full px-3 select-none animate-in fade-in zoom-in-95 duration-200">
        {/* Left: Charging Zap / Battery Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCharging ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Zap size={13} className="text-emerald-400 fill-emerald-400 animate-pulse" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
              <Battery size={13} className="text-zinc-300" />
            </div>
          )}
        </div>

        {/* Center: Status Title */}
        <div className="flex items-center gap-1.5 min-w-0 px-2">
          <span className="text-[12px] font-medium font-display text-zinc-100 truncate">
            {isCharging ? 'Charging' : 'On Battery'}
          </span>
        </div>

        {/* Right: Battery Level */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`font-clock text-[12px] font-semibold tracking-wider ${
              isCharging
                ? 'text-emerald-400'
                : percent <= 20
                ? 'text-rose-400'
                : 'text-zinc-200'
            }`}
          >
            {percent}%
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'bluetooth') {
    const isConnected = event.connected ?? false;
    const name = event.deviceName || 'Bluetooth Device';
    const isAudioDevice = /airpod|headset|earphone|headphone|speaker|buds|wh-|wh1000/i.test(name);

    return (
      <div className="flex items-center justify-between w-full h-full px-3 select-none animate-in fade-in zoom-in-95 duration-200">
        {/* Left: Bluetooth / Headphone Icon */}
        <div className="flex items-center shrink-0">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              isConnected ? 'bg-sky-500/20 text-sky-400' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isAudioDevice ? <Headphones size={13} /> : <Bluetooth size={13} />}
          </div>
        </div>

        {/* Center: Device Name */}
        <div className="flex-1 min-w-0 px-2.5">
          <p className="text-[11px] font-medium font-display text-zinc-100 truncate">
            {name}
          </p>
        </div>

        {/* Right: Connection State */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-zinc-500'
            }`}
          />
          <span
            className={`text-[10px] font-medium font-display tracking-wide ${
              isConnected ? 'text-emerald-400' : 'text-zinc-400'
            }`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

