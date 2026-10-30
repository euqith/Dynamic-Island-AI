import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { MusicWidget } from './components/widgets/MusicWidget';
import { LyricsPanel } from './components/widgets/LyricsPanel';
import { WaterWidget } from './components/widgets/WaterWidget';
import { PomodoroWidget } from './components/widgets/PomodoroWidget';
import { TodoWidget } from './components/widgets/TodoWidget';
import { NotificationBanner } from './components/notification/NotificationBanner';
import { IslandEyes } from './components/widgets/IslandEyes';
import { SystemHUD } from './components/hud/SystemHUD';
import { MediaState, LyricLine, NotificationPayload, WaterState, TaskItem, PomodoroState, SystemHUDEvent } from '../../types';

export const App: React.FC = () => {
  // Island State: 'collapsed' | 'expanded'
  const [islandState, setIslandState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [activeTab, setActiveTab] = useState<number>(0); // 0: Music, 1: Water, 2: Pomodoro, 3: Todo
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // System HUD Event (Volume, Charging, Bluetooth)
  const [activeHUD, setActiveHUD] = useState<SystemHUDEvent | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        window.electronAPI?.setIgnoreMouseEvents(false);

        if (notificationTimerRef.current) {
          clearTimeout(notificationTimerRef.current);
        }

        // Auto-dismiss after 6 seconds
        notificationTimerRef.current = setTimeout(() => {
          setActiveNotification(null);
          setIslandState('collapsed');
          window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
        }, 6000);
      });

      // Initial check
      window.electronAPI.getMediaState().then((state) => {
        if (state) {
          setMedia(state);
        }
      });

      const unsubscribeHUD = window.electronAPI.onSystemHUD((event) => {
        setActiveHUD(event);
        if (hudTimerRef.current) {
          clearTimeout(hudTimerRef.current);
        }
        const duration = event.type === 'volume' ? 1800 : 2500;
        hudTimerRef.current = setTimeout(() => {
          setActiveHUD(null);
        }, duration);
      });

      const unsubscribeHover = window.electronAPI.onNotchHoverState?.((hovered) => {
        if (hovered) {
          setIslandState('expanded');
        } else {
          setIslandState('collapsed');
          setShowLyrics(false);
        }
      });

      return () => {
        unsubscribeMedia?.();
        unsubscribeNotification?.();
        unsubscribeHUD?.();
        unsubscribeHover?.();
      };
    }
  }, []);

  // Smooth local timeline progression when playing (continuous, never frozen)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (media.hasMedia && media.isPlaying && media.duration > 0) {
      timer = setInterval(() => {
        setMedia((prev) => {
          if (!prev.hasMedia || !prev.isPlaying || prev.duration <= 0) return prev;
          if (prev.position >= prev.duration) return prev;
          return {
            ...prev,
            position: Math.min(prev.position + 1, prev.duration),
          };
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [media.hasMedia, media.isPlaying, media.duration]);

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

  // Keep Main Process updated with current hitbox for precise mouse pass-through
  useEffect(() => {
    if (!window.electronAPI?.updateHitbox) return;
    const isMusicPlaying = media.hasMedia && media.isPlaying;
    let width = 185;
    let height = 34;

    if (islandState === 'expanded') {
      width = showLyrics ? 740 : 500;
      height = showLyrics ? 184 : 176;
    } else if (activeHUD) {
      width = activeHUD.type === 'volume' ? 230 : activeHUD.type === 'charging' ? 215 : 260;
      height = 34;
    } else if (isMusicPlaying) {
      width = 250;
      height = 34;
    }

    window.electronAPI.updateHitbox({
      width,
      height,
      expanded: islandState === 'expanded',
    });
  }, [islandState, showLyrics, activeHUD, media.hasMedia, media.isPlaying]);

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

  const triggerTestNotif = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.electronAPI) {
      window.electronAPI.triggerNotification({
        id: Date.now().toString(),
        appName: 'WhatsApp',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
        title: 'Budi Santoso',
        body: 'Halo bro, pesan ini berhasil masuk ke Dynamic Island! 🔥',
        timestamp: Date.now(),
      });
    }
  };

  return (
    <div className="w-full flex justify-center items-start pt-0 m-0">
      {/* Outer Wrapper for Notch & Outward Corner Fillets */}
      <div className="relative">
        {/* Inverted Outward Curved Fillet: Top-Left (Subtle 4px radius) */}
        <svg
          className="absolute -left-[4px] top-0 w-[4px] h-[4px] pointer-events-none z-20"
          viewBox="0 0 4 4"
        >
          {/* Solid Black Cutout Body */}
          <path d="M 0,0 H 4 V 4 C 4,1.791 2.209,0 0,0 Z" fill="#000" />
          {/* Subtle Outer Border Line */}
          <path
            d="M 0,0 C 2.209,0 4,1.791 4,4"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.6"
          />
        </svg>

        {/* Inverted Outward Curved Fillet: Top-Right (Subtle 4px radius) */}
        <svg
          className="absolute -right-[4px] top-0 w-[4px] h-[4px] pointer-events-none z-20"
          viewBox="0 0 4 4"
        >
          {/* Solid Black Cutout Body */}
          <path d="M 4,0 H 0 V 4 C 0,1.791 1.791,0 4,0 Z" fill="#000" />
          {/* Subtle Outer Border Line */}
          <path
            d="M 4,0 C 1.791,0 0,1.791 0,4"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.6"
          />
        </svg>

        {/* Main Notch Body Container */}
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`relative bg-black text-white shadow-[0_12px_45px_rgba(0,0,0,0.9)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col overflow-hidden cursor-default ${
            isExpanded
              ? showLyrics
                ? 'w-[740px] max-w-[740px] h-[184px] rounded-b-[24px] border-b border-x border-white/10'
                : 'w-[500px] max-w-[500px] h-[176px] rounded-b-[24px] border-b border-x border-white/10'
              : activeHUD
                ? activeHUD.type === 'volume'
                  ? 'w-[230px] max-w-[230px] h-[34px] rounded-b-[18px] border-b border-x border-white/15'
                  : activeHUD.type === 'charging'
                    ? 'w-[215px] max-w-[215px] h-[34px] rounded-b-[18px] border-b border-x border-white/15'
                    : 'w-[260px] max-w-[260px] h-[34px] rounded-b-[18px] border-b border-x border-white/15'
                : (media.hasMedia && media.isPlaying)
                  ? 'w-[250px] max-w-[250px] h-[34px] rounded-b-[18px] border-b border-x border-white/15'
                  : 'w-[185px] max-w-[185px] h-[34px] rounded-b-[18px] border-b border-x border-white/15'
          }`}
          style={{
            borderTopLeftRadius: '0px',
            borderTopRightRadius: '0px',
            marginTop: '0px',
          }}
        >
          {/* COLLAPSED STATE (MacBook M2 Physical Notch Style) */}
          {!isExpanded && (() => {
            // Priority 1: System HUD (Volume, Charging, Bluetooth)
            if (activeHUD) {
              return <SystemHUD event={activeHUD} />;
            }

            const isMusicPlaying = media.hasMedia && media.isPlaying;
            const isIdle = !activeNotification && !isMusicPlaying;

            return (
              <div className="relative flex items-center justify-between w-full h-full px-3.5 pt-0.5 select-none">
                {/* Bottom Ambient Cyan/Blue Light Strip (Only shown when Idle) */}
                {isIdle && (
                  <>
                    <div className="absolute bottom-0 inset-x-4 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-[0.5px] pointer-events-none" />
                    <div className="absolute -bottom-1 inset-x-8 h-[5px] bg-cyan-400/15 blur-[4px] pointer-events-none" />
                  </>
                )}

                {/* Left Side: Media / Dot Status */}
                <div className="flex items-center gap-1.5 min-w-0 pr-1 z-10">
                  <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center shrink-0 ${isMusicPlaying ? 'bg-emerald-500' : 'bg-emerald-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isMusicPlaying ? 'bg-emerald-300' : 'bg-emerald-300'}`} />
                  </span>
                  {isMusicPlaying && (
                    <div className="flex items-end gap-0.5 h-2.5 ml-0.5 shrink-0">
                      <span className="w-0.5 bg-green-400 h-full animate-[bounce_0.8s_infinite]" />
                      <span className="w-0.5 bg-green-400 h-2/3 animate-[bounce_0.6s_infinite_0.2s]" />
                      <span className="w-0.5 bg-green-400 h-4/5 animate-[bounce_0.9s_infinite_0.4s]" />
                    </div>
                  )}

                  {isMusicPlaying && (
                    <span className="text-[11px] font-medium font-display text-zinc-200 truncate ml-1 max-w-[125px]">
                      {media.title}
                    </span>
                  )}
                </div>

                {/* Center: Interactive Animated Companion Eyes (HANYA MUNCUL SAAT IDLE) */}
                {isIdle && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10 transition-opacity duration-300">
                    <IslandEyes isMusicPlaying={false} />
                  </div>
                )}

                {/* Right Side: Clock */}
                <div className="flex items-center gap-1.5 font-clock text-[12px] font-medium text-zinc-200 tracking-wide shrink-0 z-10">
                  <span>{currentTimeStr || '09:48'}</span>
                </div>
              </div>
            );
          })()}

          {/* EXPANDED STATE */}
          {isExpanded && (
            <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
              {/* Top Bar inside Notch */}
              <div className="flex items-center justify-between px-5 pt-2 text-[10px] text-zinc-400 border-b border-white/5 pb-1 shrink-0 min-w-0">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium font-display truncate min-w-0 mr-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="shrink-0">{tabNames[activeTab]}</span>
                  {media.hasMedia && activeTab === 0 && (
                    <span className="text-[9px] text-zinc-500 font-display ml-1 truncate">({media.appSource || 'Now Playing'})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 font-clock text-[11px] text-zinc-300 font-medium">
                  <span>{currentDateStr} {currentTimeStr}</span>
                  <button
                    type="button"
                    onClick={triggerTestNotif}
                    title="Test Notifikasi (WhatsApp Demo)"
                    className="hover:text-emerald-400 transition-colors cursor-pointer p-0.5 ml-0.5"
                  >
                    <Bell size={11} />
                  </button>
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
                <div className="flex-1 flex min-w-0 min-h-0 relative">
                  {/* Left Arrow */}
                  <button
                    onClick={prevTab}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 text-zinc-500 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Widget Content Body */}
                  <div className="flex-1 px-5 h-full flex min-w-0 overflow-hidden">
                    {/* Left Column: Active Widget */}
                    <div className={`h-full min-w-0 overflow-hidden ${showLyrics ? 'w-[360px] border-r border-white/5 pr-2 shrink-0' : 'w-full'}`}>
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
            <div className="flex items-center justify-center gap-1.5 pb-2.5 pt-0.5 shrink-0">
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
  </div>
);
};
