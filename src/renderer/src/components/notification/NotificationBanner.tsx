import React from 'react';
import {
  Bell,
  MessageCircle,
  Mail,
  GitPullRequest,
  Disc as Discord,
  Compass,
  Globe,
  Folder,
  Terminal,
  Settings,
  MessageSquare,
  Calendar,
  Music,
  X,
} from 'lucide-react';
import { NotificationPayload } from '../../../../types';

interface NotificationBannerProps {
  notification: NotificationPayload;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const lowerApp = (notification.appName || '').toLowerCase();
  const isChatApp =
    lowerApp.includes('whatsapp') ||
    lowerApp.includes('telegram') ||
    lowerApp.includes('discord') ||
    lowerApp.includes('message');

  const getAppIcon = (appName: string, size = 16) => {
    const lower = appName.toLowerCase();
    if (lower.includes('wa') || lower.includes('whatsapp')) {
      return <MessageCircle size={size} className="text-emerald-400" />;
    }
    if (lower.includes('discord')) {
      return <Discord size={size} className="text-indigo-400" />;
    }
    if (lower.includes('telegram')) {
      return <MessageCircle size={size} className="text-sky-400" />;
    }
    if (lower.includes('safari')) {
      return <Compass size={size} className="text-blue-400" />;
    }
    if (lower.includes('chrome')) {
      return <Globe size={size} className="text-amber-400" />;
    }
    if (lower.includes('finder')) {
      return <Folder size={size} className="text-sky-400" />;
    }
    if (lower.includes('terminal') || lower.includes('iterm')) {
      return <Terminal size={size} className="text-emerald-400" />;
    }
    if (lower.includes('setting') || lower.includes('system') || lower.includes('preference')) {
      return <Settings size={size} className="text-zinc-300" />;
    }
    if (lower.includes('message')) {
      return <MessageSquare size={size} className="text-emerald-400" />;
    }
    if (lower.includes('calendar')) {
      return <Calendar size={size} className="text-rose-400" />;
    }
    if (lower.includes('music')) {
      return <Music size={size} className="text-pink-400" />;
    }
    if (lower.includes('outlook') || lower.includes('mail')) {
      return <Mail size={size} className="text-blue-400" />;
    }
    if (lower.includes('github')) {
      return <GitPullRequest size={size} className="text-zinc-300" />;
    }
    return <Bell size={size} className="text-amber-400" />;
  };

  // Generate consistent attractive gradient based on contact name
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-emerald-500 to-teal-700',
      'from-blue-500 to-indigo-700',
      'from-purple-500 to-indigo-800',
      'from-rose-500 to-pink-700',
      'from-amber-500 to-orange-700',
      'from-cyan-500 to-blue-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Get Initials from contact name
  const getInitials = (name: string) => {
    if (!name) return 'WA';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center justify-between w-full h-full px-4 py-2 gap-3.5 select-none">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Profile Photo / Avatar with Mini App Badge */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center border border-white/15 shadow-md">
            {notification.avatarUrl ? (
              <img
                src={notification.avatarUrl}
                alt={notification.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : isChatApp ? (
              /* Contact Profile Avatar with Vibrant Gradient & Initials */
              <div
                className={`w-full h-full bg-gradient-to-br ${getAvatarGradient(notification.title)} flex items-center justify-center text-white font-semibold text-xs tracking-wider shadow-inner`}
              >
                {getInitials(notification.title)}
              </div>
            ) : (
              /* System App Icon */
              <div className="w-full h-full bg-zinc-800/90 flex items-center justify-center">
                {getAppIcon(notification.appName, 18)}
              </div>
            )}
          </div>

          {/* Mini App Badge in bottom-right corner for chat apps */}
          {isChatApp && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-950 flex items-center justify-center border border-white/20 shadow-sm">
              {getAppIcon(notification.appName, 9)}
            </div>
          )}
        </div>

        {/* Text Content: Title, App Badge, and Message Body */}
        <div className="truncate min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-white truncate font-display">
              {notification.title}
            </span>
            <span className="text-[9px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded-full font-medium font-display">
              {notification.appName}
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 truncate mt-0.5 font-normal font-display">
            {notification.body}
          </p>
        </div>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        title="Tutup Notifikasi"
        className="text-zinc-500 hover:text-white p-1 rounded-full transition-colors shrink-0 cursor-pointer"
      >
        <X size={15} />
      </button>
    </div>
  );
};
