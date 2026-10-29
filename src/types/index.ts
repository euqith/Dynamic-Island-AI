export interface MediaState {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number; // in seconds
  position: number; // in seconds
  isPlaying: boolean;
  hasMedia: boolean;
  appSource?: string;
}

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface NotificationPayload {
  id: string;
  appName: string;
  appIcon?: string;
  avatarUrl?: string;
  title: string;
  body: string;
  timestamp: number;
}

export interface WaterState {
  currentLiters: number;
  targetLiters: number;
  logs: { time: string; amountMl: number }[];
  remindersEnabled: boolean;
}

export interface TaskItem {
  id: string;
  text: string;
  timeRange?: string;
  completed: boolean;
}

export interface PomodoroState {
  mode: 'focus' | 'shortBreak' | 'longBreak';
  timeLeft: number;
  isRunning: boolean;
  completedSessions: number;
}

export type SystemHUDType = 'volume' | 'charging' | 'bluetooth';

export interface SystemHUDEvent {
  type: SystemHUDType;
  volume?: number; // 0 - 100
  isMuted?: boolean;
  isCharging?: boolean; // true: AC Power, false: Battery Power
  batteryPercent?: number; // 0 - 100
  deviceName?: string;
  connected?: boolean;
  timestamp: number;
}

