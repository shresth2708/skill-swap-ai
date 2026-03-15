import { useState } from 'react';
import { Bell, CheckCheck, CircleAlert } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime, truncateText } from '../utils/formatters';

const NotifBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications({ limit: 8 });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Notifications</p>
              <p className="text-xs text-white/45">Recent activity and reminders</p>
            </div>
            <button
              type="button"
              onClick={() => markAllRead()}
              className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-auto p-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-white/45">
                <CircleAlert className="h-6 w-6 text-cyan-300/80" />
                <p className="text-sm">You’re all caught up.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markRead(notification.id)}
                  className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/5"
                >
                  <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {notification.title || notification.type || 'Notification'}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      {truncateText(notification.message || notification.body || 'New activity on your account.', 84)}
                    </p>
                    <p className="mt-2 text-xs text-white/35">
                      {formatRelativeTime(notification.createdAt || notification.timestamp)}
                    </p>
                  </div>
                  {notification.readAt ? (
                    <CheckCheck className="mt-1 h-4 w-4 text-emerald-300" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotifBell;
