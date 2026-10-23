import React from 'react';
import { Timer, RotateCcw, Play, Pause, Coffee, Target } from 'lucide-react';
import { PomodoroState } from '../../../../types';

interface PomodoroWidgetProps {
  pomodoro: PomodoroState;
  onTogglePlay: () => void;
  onReset: () => void;
  onSelectMode: (mode: 'focus' | 'shortBreak' | 'longBreak') => void;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  pomodoro,
  onTogglePlay,
  onReset,
  onSelectMode,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getModeTitle = () => {
    switch (pomodoro.mode) {
      case 'focus':
        return 'Focus time';
      case 'shortBreak':
        return 'Short break';
      case 'longBreak':
        return 'Long break';
    }
  };

  return (
    <div className="flex items-center justify-between h-full px-5 py-2">
      {/* Left: Timer Badge */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-full border-2 border-red-500/80 bg-red-500/10 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <Timer size={24} className={pomodoro.isRunning ? 'animate-pulse' : ''} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-zinc-300 block">
            Pomodoro
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">
            Session #{pomodoro.completedSessions + 1}
          </span>
        </div>
      </div>

      {/* Center: Countdown Display & Controls */}
      <div className="flex flex-col items-center">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-white tracking-wider">
            {formatTime(pomodoro.timeLeft)}
          </span>
          <button
            onClick={onReset}
            title="Reset"
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
          </button>
        </div>
        <span className="text-[10px] text-zinc-400 mt-0.5">{getModeTitle()}</span>

        {/* Buttons */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => onSelectMode('shortBreak')}
            className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              pomodoro.mode === 'shortBreak'
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'text-zinc-400 border-white/5 hover:text-white'
            }`}
          >
            <Coffee size={10} />
            <span>Short Break</span>
          </button>

          <button
            onClick={onTogglePlay}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 cursor-pointer shadow-sm ${
              pomodoro.isRunning
                ? 'bg-amber-500 hover:bg-amber-400'
                : 'bg-red-500 hover:bg-red-400'
            }`}
          >
            {pomodoro.isRunning ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>

          <button
            onClick={() => onSelectMode('focus')}
            className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              pomodoro.mode === 'focus'
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'text-zinc-400 border-white/5 hover:text-white'
            }`}
          >
            <Target size={10} />
            <span>Focus Time</span>
          </button>
        </div>
      </div>
    </div>
  );
};
