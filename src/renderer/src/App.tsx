import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MusicWidget } from './components/widgets/MusicWidget';
import { LyricsPanel } from './components/widgets/LyricsPanel';
import { WaterWidget } from './components/widgets/WaterWidget';
import { PomodoroWidget } from './components/widgets/PomodoroWidget';
import { TodoWidget } from './components/widgets/TodoWidget';
import { NotificationBanner } from './components/notification/NotificationBanner';
import { MediaState, LyricLine, NotificationPayload, WaterState, TaskItem, PomodoroState } from '../../types';

export const App: React.FC = () => {
  // Island State: 'collapsed' | 'expanded'
  const [islandState, setIslandState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [activeTab, setActiveTab] = useState<number>(0); // 0: Music, 1: Water, 2: Pomodoro, 3: Todo
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Media State
  const [media, setMedia] = useState<MediaState>({
    title: 'Tidak ada media',
    artist: '',
    album: '',
    coverUrl: '',
    duration: 0,
    position: 0,
    isPlaying: false,
    hasMedia: false,
  });

  // Lyrics State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState<boolean>(false);

  // Active Notification
  const [activeNotification, setActiveNotification] = useState<NotificationPayload | null>(null);

  // Water State
  const [water, setWater] = useState<WaterState>({
    currentLiters: 1.6,
    targetLiters: 2.0,
    remindersEnabled: false,
    logs: [
      { time: '00', amountMl: 50 },
      { time: '01', amountMl: 143 },
      { time: '02', amountMl: 80 },
      { time: '03', amountMl: 120 },
    ],
  });

  // Pomodoro State
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    mode: 'focus',
    timeLeft: 25 * 60,
    isRunning: false,
    completedSessions: 0,
  });

  // TodoList State
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: '1', text: 'Ngonten 20:00-21:00', timeRange: '20:00-21:00', completed: false },
    { id: '2', text: 'ngerjain tugas', completed: false },
    { id: '3', text: 'Ngedit 12:00-13:00', timeRange: '12:00-13:00', completed: false },
  ]);

  // Real-time Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTimeStr(`${hours}:${minutes}`);

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setCurrentDateStr(`${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for Native Media & Notifications via Electron Bridge
  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribeMedia = window.electronAPI.onMediaUpdate((state) => {
        setMedia(state);
      });

      const unsubscribeNotification = window.electronAPI.onNotification((payload) => {
        setActiveNotification(payload);
        setIslandState('expanded');
        // Auto-dismiss after 6 seconds
        setTimeout(() => {
          setActiveNotification(null);
        }, 6000);
      });

      // Initial check
      window.electronAPI.getMediaState().then((state) => {
        if (state) {
          setMedia(state);
        }
      });

      return () => {
        unsubscribeMedia?.();
        unsubscribeNotification?.();
      };
    }
  }, []);

  // Sync lyrics when song changes
  useEffect(() => {
    if (media.hasMedia && window.electronAPI) {
      setIsLoadingLyrics(true);
      window.electronAPI.getLyrics(media.title, media.artist).then((lrc) => {
        setIsLoadingLyrics(false);
        if (lrc && lrc.length > 0) {
          setLyrics(lrc);
        } else {
          setLyrics([]);
        }
      }).catch(() => setIsLoadingLyrics(false));
    } else {
      setLyrics([]);
    }
  }, [media.title, media.artist, media.hasMedia]);

  // Handle Pomodoro timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (pomodoro.isRunning && pomodoro.timeLeft > 0) {
      interval = setInterval(() => {
        setPomodoro((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (pomodoro.timeLeft === 0 && pomodoro.isRunning) {
      setPomodoro((prev) => ({
        ...prev,
        isRunning: false,
        completedSessions: prev.mode === 'focus' ? prev.completedSessions + 1 : prev.completedSessions,
      }));
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomodoro.isRunning, pomodoro.timeLeft]);

  // Handle Mouse Hitbox for click-through passthrough
  const handleMouseEnter = () => {
    if (window.electronAPI) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
    setIslandState('expanded');
  };

  const handleMouseLeave = () => {
    setIslandState('collapsed');
    setShowLyrics(false);
    if (window.electronAPI) {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  // Nav actions
  const prevTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab((prev) => (prev > 0 ? prev - 1 : 3));
  };

  const nextTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab((prev) => (prev < 3 ? prev + 1 : 0));
  };

  const tabNames = ['Music', 'Water', 'Pomodoro', 'Todo'];
  const isExpanded = islandState === 'expanded';

  return (
    <div className="w-full flex justify-center items-start pt-0 m-0">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative bg-black text-white shadow-[0_12px_45px_rgba(0,0,0,0.9)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col overflow-hidden cursor-default ${
          isExpanded
            ? showLyrics
              ? 'w-[740px] h-[164px] rounded-b-[24px] border-b border-x border-white/10'
              : 'w-[480px] h-[156px] rounded-b-[24px] border-b border-x border-white/10'
            : 'w-[185px] h-[34px] rounded-b-[18px] border-b border-x border-white/15'
        }`}
        style={{
          borderTopLeftRadius: '0px',
          borderTopRightRadius: '0px',
          marginTop: '0px',
        }}
      >
        {/* COLLAPSED STATE (MacBook M2 Physical Notch Style) */}
        {!isExpanded && (
          <div className="flex items-center justify-between w-full h-full px-3.5 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
              </span>
              {media.isPlaying && (
                <div className="flex items-end gap-0.5 h-2.5 ml-0.5">
                  <span className="w-0.5 bg-green-400 h-full animate-[bounce_0.8s_infinite]" />
                  <span className="w-0.5 bg-green-400 h-2/3 animate-[bounce_0.6s_infinite_0.2s]" />
                  <span className="w-0.5 bg-green-400 h-4/5 animate-[bounce_0.9s_infinite_0.4s]" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100 tracking-wider font-mono">
              <span>{currentTimeStr || '20:51'}</span>
            </div>
          </div>
        )}

        {/* EXPANDED STATE */}
        {isExpanded && (
          <div className="flex flex-col h-full w-full">
            {/* Top Bar inside Notch */}
            <div className="flex items-center justify-between px-5 pt-2 text-[10px] text-zinc-400 font-mono border-b border-white/5 pb-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{tabNames[activeTab]}</span>
                {media.hasMedia && activeTab === 0 && (
                  <span className="text-[9px] text-zinc-500 font-sans ml-1">({media.appSource || 'Now Playing'})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>{currentDateStr} {currentTimeStr}</span>
              </div>
            </div>

            {/* Notification Priority Banner Overlay */}
            {activeNotification ? (
              <NotificationBanner
                notification={activeNotification}
                onDismiss={() => setActiveNotification(null)}
              />
            ) : (
              /* Main Widget Carousel */
              <div className="flex-1 flex min-h-0 relative">
                {/* Left Arrow */}
                <button
                  onClick={prevTab}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 text-zinc-500 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Widget Content Body */}
                <div className="flex-1 px-5 h-full flex">
                  {/* Left Column: Active Widget */}
                  <div className={`h-full ${showLyrics ? 'w-[360px] border-r border-white/5 pr-2' : 'w-full'}`}>
                    {activeTab === 0 && (
                      <MusicWidget
                        media={media}
                        showLyrics={showLyrics}
                        onToggleLyrics={() => setShowLyrics(!showLyrics)}
                        onPlayPause={() => {
                          window.electronAPI?.playPause();
                        }}
                        onNext={() => window.electronAPI?.nextTrack()}
                        onPrev={() => window.electronAPI?.prevTrack()}
                      />
                    )}

                    {activeTab === 1 && (
                      <WaterWidget
                        water={water}
                        onDrink={() =>
                          setWater((w) => ({
                            ...w,
                            currentLiters: parseFloat((w.currentLiters + 0.2).toFixed(1)),
                          }))
                        }
                        onToggleReminder={() =>
                          setWater((w) => ({ ...w, remindersEnabled: !w.remindersEnabled }))
                        }
                      />
                    )}

                    {activeTab === 2 && (
                      <PomodoroWidget
                        pomodoro={pomodoro}
                        onTogglePlay={() =>
                          setPomodoro((p) => ({ ...p, isRunning: !p.isRunning }))
                        }
                        onReset={() =>
                          setPomodoro((p) => ({ ...p, timeLeft: 25 * 60, isRunning: false }))
                        }
                        onSelectMode={(mode) =>
                          setPomodoro((p) => ({
                            ...p,
                            mode,
                            timeLeft: mode === 'focus' ? 25 * 60 : mode === 'shortBreak' ? 5 * 60 : 15 * 60,
                            isRunning: false,
                          }))
                        }
                      />
                    )}

                    {activeTab === 3 && (
                      <TodoWidget
                        tasks={tasks}
                        onToggleTask={(id) =>
                          setTasks((ts) =>
                            ts.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
                          )
                        }
                        onAddTask={() => {
                          const title = prompt('Masukkan nama task:');
                          if (title) {
                            setTasks((ts) => [
                              ...ts,
                              { id: Date.now().toString(), text: title, completed: false },
                            ]);
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Right Column: Synced Lyrics (when toggled) */}
                  {showLyrics && (
                    <div className="flex-1 h-full pl-2 min-w-0">
                      <LyricsPanel
                        lyrics={lyrics}
                        currentTime={media.position}
                        isLoading={isLoadingLyrics}
                      />
                    </div>
                  )}
                </div>

                {/* Right Arrow */}
                <button
                  onClick={nextTab}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 text-zinc-500 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Bottom Pagination Dots */}
            <div className="flex items-center justify-center gap-1.5 pb-2">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                    activeTab === idx ? 'w-4 bg-white' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
