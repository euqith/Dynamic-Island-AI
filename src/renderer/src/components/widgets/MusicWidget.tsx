import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, MessageSquare } from 'lucide-react';
import { MediaState } from '../../../../types';

interface MusicWidgetProps {
  media: MediaState;
  showLyrics: boolean;
  onToggleLyrics: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const MusicWidget: React.FC<MusicWidgetProps> = ({
  media,
  showLyrics,
  onToggleLyrics,
  onPlayPause,
  onNext,
  onPrev,
}) => {
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = media.duration > 0 ? (media.position / media.duration) * 100 : 0;
  const remainingTime = media.duration > media.position ? media.duration - media.position : 0;

  if (!media.hasMedia) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-2">
        <div className="flex items-center gap-3 text-zinc-400 mb-2">
          <Music size={22} className="text-zinc-500 animate-pulse" />
          <span className="text-sm font-medium tracking-wide">Tidak ada media</span>
        </div>
        <div className="flex items-center gap-5 text-zinc-600">
          <SkipBack size={16} />
          <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center">
            <Play size={14} className="ml-0.5 text-zinc-600" />
          </div>
          <SkipForward size={16} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-full px-4 py-2 min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 min-w-0">
        {/* Album Artwork */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800/80 shrink-0 shadow-md border border-white/5">
          {media.coverUrl ? (
            <img src={media.coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 to-zinc-900 text-indigo-400">
              <Music size={20} />
            </div>
          )}
          {media.isPlaying && (
            <div className="absolute bottom-1 right-1 flex items-end gap-0.5 h-3">
              <span className="w-0.5 bg-green-400 animate-[bounce_0.8s_infinite] h-full" />
              <span className="w-0.5 bg-green-400 animate-[bounce_0.6s_infinite_0.2s] h-2/3" />
              <span className="w-0.5 bg-green-400 animate-[bounce_0.9s_infinite_0.4s] h-4/5" />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-xs font-medium font-display text-white truncate leading-snug">
            {media.title}
          </h4>
          <p className="text-[11px] text-zinc-400 font-display truncate mt-0.5">
            {media.artist || 'Unknown Artist'}
          </p>
        </div>
      </div>

      {/* Seekbar and Timeline */}
      <div className="my-1">
        <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
          <div
            className="bg-white/90 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-1 font-clock font-medium">
          <span>{formatTime(media.position)}</span>
          <span>-{formatTime(remainingTime)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between px-2 pt-0.5 pb-1">
        {/* Toggle Lyrics Button */}
        <button
          onClick={onToggleLyrics}
          title="Toggle Lyrics"
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            showLyrics ? 'text-indigo-400 bg-indigo-500/20' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <MessageSquare size={14} />
        </button>

        {/* Prev, Play/Pause, Next */}
        <div className="flex items-center gap-4">
          <button
            onClick={onPrev}
            className="text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={onPlayPause}
            className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-sm"
          >
            {media.isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <button
            onClick={onNext}
            className="text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="w-6" />
      </div>
    </div>
  );
};
