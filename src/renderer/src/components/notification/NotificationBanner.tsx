import React from 'react';
import { Bell, MessageCircle, Mail, GitPullRequest, Disc as Discord, X } from 'lucide-react';
import { NotificationPayload } from '../../../../types';

interface NotificationBannerProps {
  notification: NotificationPayload;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const getAppIcon = (appName: string) => {
    const lower = appName.toLowerCase();
    if (lower.includes('wa') || lower.includes('whatsapp')) {
      return <MessageCircle size={16} className="text-emerald-400" />;
    }
    if (lower.includes('discord')) {
      return <Discord size={16} className="text-indigo-400" />;
    }
    if (lower.includes('telegram')) {
      return <MessageCircle size={16} className="text-sky-400" />;
    }
    if (lower.includes('outlook') || lower.includes('mail')) {
      return <Mail size={16} className="text-blue-400" />;
    }
    if (lower.includes('github')) {
      return <GitPullRequest size={16} className="text-zinc-300" />;
    }
    return <Bell size={16} className="text-amber-400" />;
  };

  return (
    <div className="flex items-center justify-between w-full h-full px-4 py-2 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
          {getAppIcon(notification.appName)}
        </div>
        <div className="truncate min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-white truncate">
              {notification.title}
            </span>
            <span className="text-[9px] bg-white/10 text-zinc-300 px-1.5 py-0.2 rounded-full">
              {notification.appName}
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 truncate mt-0.5 font-normal">
            {notification.body}
          </p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="text-zinc-500 hover:text-white p-1 rounded-full transition-colors shrink-0 cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
};
