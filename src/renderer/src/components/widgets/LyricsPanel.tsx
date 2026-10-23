import React, { useEffect, useRef } from 'react';
import { LyricLine } from '../../../../types';

interface LyricsPanelProps {
  lyrics: LyricLine[];
  currentTime: number;
  isLoading: boolean;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({ lyrics, currentTime, isLoading }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active lyric index
  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Scroll active lyric to center
  useEffect(() => {
    if (containerRef.current && activeIndex !== -1) {
      const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs animate-pulse">
        Memuat lirik otomatis...
      </div>
    );
  }

  if (lyrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs px-4 text-center">
        <span>Lirik tidak tersedia</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 py-3 flex flex-col gap-2 scroll-smooth"
    >
      {lyrics.map((line, idx) => {
        const isActive = idx === activeIndex;
        return (
          <p
            key={idx}
            className={`transition-all duration-300 text-xs leading-relaxed ${
              isActive
                ? 'text-white font-bold scale-[1.02] origin-left opacity-100'
                : 'text-zinc-500 font-medium opacity-60 hover:opacity-80'
            }`}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
};
