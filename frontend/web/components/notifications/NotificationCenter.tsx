'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  X,
  Trash2,
  SlidersHorizontal,
  ArrowRight,
  MapPin,
  ShoppingBag,
  ShieldCheck,
  KeyRound,
  FileText,
} from 'lucide-react';
import {
  getNotificationsForAudience,
  getNotificationPreferences,
  saveNotificationPreferences,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
  formatRelativeTime,
  NOTIFICATIONS_CHANGED_EVENT,
  type AppNotification,
  type NotificationAudience,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/notifications-store';

interface NotificationCenterProps {
  audience?: NotificationAudience;
  userId?: string | null;
  userEmail?: string | null;
  variant?: 'cyber' | 'admin' | 'portal';
  onOpenFullHistory?: () => void;
}

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'land_status':
      return MapPin;
    case 'purchase':
      return ShoppingBag;
    case 'application':
      return FileText;
    case 'revocation':
      return AlertTriangle;
    case 'access_code':
      return KeyRound;
    case 'account':
      return ShieldCheck;
    default:
      return Bell;
  }
}

function getSeverityAccent(severity: AppNotification['severity']) {
  switch (severity) {
    case 'success':
      return { icon: CheckCircle2, textClass: 'text-emerald-400', label: 'Confirmed' };
    case 'warning':
      return { icon: AlertTriangle, textClass: 'text-amber-400', label: 'Attention' };
    case 'error':
      return { icon: XCircle, textClass: 'text-rose-400', label: 'Alert' };
    default:
      return { icon: Info, textClass: 'text-[#38BDF8]', label: 'Update' };
  }
}

export function NotificationCenter({
  audience = 'all',
  userId,
  userEmail,
  variant = 'cyber',
  onOpenFullHistory,
}: NotificationCenterProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    toastEnabled: true,
    browserPushEnabled: false,
    landUpdates: true,
    orderUpdates: true,
    governanceAlerts: true,
  });
  const [browserPermission, setBrowserPermission] = useState<string>('default');

  useEffect(() => {
    const refresh = () => {
      setNotifications(
        getNotificationsForAudience({
          audience,
          userId,
          userEmail,
        }),
      );
      setPrefs(getNotificationPreferences());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserPermission(window.Notification.permission);
      } else {
        setBrowserPermission('unsupported');
      }
    };

    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [audience, userId, userEmail]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const handleToggleBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return;
    }

    if (!prefs.browserPushEnabled) {
      let permission = window.Notification.permission;
      if (permission === 'default') {
        permission = await window.Notification.requestPermission();
      }
      setBrowserPermission(permission);
      if (permission === 'granted') {
        saveNotificationPreferences({ browserPushEnabled: true });
      } else {
        saveNotificationPreferences({ browserPushEnabled: false });
      }
      return;
    }

    saveNotificationPreferences({ browserPushEnabled: false });
  };

  const handleNavigate = (item: AppNotification) => {
    if (!item.read) {
      markNotificationRead(item.id, true);
    }
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    }
  };

  const isAdminTheme = variant === 'admin';
  const buttonSurfaceClass = isAdminTheme
    ? 'bg-[#0F172A] border-slate-800 hover:border-indigo-400/50 text-slate-300 hover:text-white'
    : 'bg-[#0A0F16] border-[rgba(91,133,167,0.25)] hover:border-[#38BDF8]/50 text-[#94A3B8] hover:text-[#F4F7FB]';

  const panelSurfaceClass = isAdminTheme
    ? 'bg-[#0B1120] border-slate-800'
    : 'bg-[#0A0F16] border-[rgba(91,133,167,0.28)]';

  const accentBadgeClass = isAdminTheme
    ? 'bg-indigo-500 text-white'
    : 'bg-[#38BDF8] text-[#020305]';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[8px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${buttonSurfaceClass}`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold tabular-nums flex items-center justify-center shadow-sm ${accentBadgeClass}`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-[68px] sm:top-full sm:mt-2 sm:w-[396px] rounded-xl border shadow-2xl z-50 overflow-hidden ${panelSurfaceClass}`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-[#05080D]/80">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold text-[#F4F7FB]">Notifications</h2>
              <span className="text-xs font-mono tabular-nums text-[#64748B]">
                · {unreadCount} unread
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead(notifications.map((n) => n.id))}
                  className="px-2 py-1 rounded-md text-[11px] font-medium text-[#38BDF8] hover:bg-[#38BDF8]/10 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrefs((prev) => !prev)}
                className={`p-1.5 rounded-md transition-colors ${
                  showPrefs
                    ? 'bg-[#38BDF8]/15 text-[#38BDF8]'
                    : 'text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-slate-800/60'
                }`}
                aria-label="Notification preferences"
                title="Notification preferences"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-slate-800/60 transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs & Clear */}
          {!showPrefs && (
            <div className="px-4 py-2 border-b border-slate-800/70 flex items-center justify-between gap-2 bg-[#05080D]/40">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#020305] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === 'all'
                      ? 'bg-[#0F172A] text-[#F4F7FB]'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === 'unread'
                      ? 'bg-[#0F172A] text-[#F4F7FB]'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearNotifications(notifications.map((n) => n.id))}
                  className="text-[11px] text-[#64748B] hover:text-rose-400 transition-colors whitespace-nowrap"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Preferences Panel */}
          {showPrefs ? (
            <div className="p-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#F4F7FB]">Alert Preferences</span>
                <button
                  type="button"
                  onClick={() => setShowPrefs(false)}
                  className="text-[#38BDF8] hover:underline"
                >
                  Back to list
                </button>
              </div>

              <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                <div>
                  <p className="font-medium text-[#E2E8F0]">In-app popup toasts</p>
                  <p className="text-[11px] text-[#64748B]">
                    Show brief real-time banners when actions complete
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.toastEnabled}
                  onChange={(e) =>
                    saveNotificationPreferences({ toastEnabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#38BDF8] rounded"
                />
              </label>

              <div className="flex items-center justify-between gap-3 py-1.5 border-t border-slate-800/70">
                <div>
                  <p className="font-medium text-[#E2E8F0]">Browser desktop alerts</p>
                  <p className="text-[11px] text-[#64748B]">
                    {browserPermission === 'denied'
                      ? 'Blocked in browser site settings'
                      : browserPermission === 'unsupported'
                        ? 'Not supported in this browser'
                        : 'Receive OS alerts for title & order updates'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={browserPermission === 'denied' || browserPermission === 'unsupported'}
                  onClick={() => void handleToggleBrowserPush()}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap disabled:opacity-45 ${
                    prefs.browserPushEnabled && browserPermission === 'granted'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#05080D] border-slate-700 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {prefs.browserPushEnabled && browserPermission === 'granted'
                    ? 'Enabled'
                    : 'Enable'}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/70 space-y-2">
                <p className="text-[11px] font-medium text-[#64748B]">Categories</p>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#CBD5E1]">Land &amp; Title Approvals</span>
                  <input
                    type="checkbox"
                    checked={prefs.landUpdates}
                    onChange={(e) =>
                      saveNotificationPreferences({ landUpdates: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#38BDF8] rounded"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#CBD5E1]">Purchase Orders &amp; Escrow</span>
                  <input
                    type="checkbox"
                    checked={prefs.orderUpdates}
                    onChange={(e) =>
                      saveNotificationPreferences({ orderUpdates: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#38BDF8] rounded"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#CBD5E1]">Governance, Revocations &amp; Access Codes</span>
                  <input
                    type="checkbox"
                    checked={prefs.governanceAlerts}
                    onChange={(e) =>
                      saveNotificationPreferences({ governanceAlerts: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#38BDF8] rounded"
                  />
                </label>
              </div>
            </div>
          ) : (
            /* Notification List */
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
              {filteredNotifications.length === 0 ? (
                <div className="px-6 py-10 text-center space-y-2">
                  <Bell className="h-7 w-7 text-[#475569] mx-auto" />
                  <p className="text-xs font-medium text-[#94A3B8]">
                    {filter === 'unread'
                      ? 'All notifications have been read.'
                      : 'No notifications yet.'}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    Updates on land registrations, approvals, and purchase orders appear here.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((item) => {
                  const CategoryIcon = getCategoryIcon(item.category);
                  const severity = getSeverityAccent(item.severity);

                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 transition-colors ${
                        item.read
                          ? 'bg-transparent hover:bg-[#05080D]/60'
                          : 'bg-[#38BDF8]/[0.04] hover:bg-[#38BDF8]/[0.08]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-8 w-8 rounded-lg bg-[#05080D] border border-slate-800 flex items-center justify-center shrink-0">
                          <CategoryIcon className={`h-4 w-4 ${severity.textClass}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleNavigate(item)}
                              className="text-left group min-w-0"
                            >
                              <p
                                className={`text-xs font-semibold leading-snug group-hover:text-[#67E8F9] transition-colors ${
                                  item.read ? 'text-[#CBD5E1]' : 'text-[#F4F7FB]'
                                }`}
                              >
                                {item.title}
                              </p>
                            </button>
                            {!item.read && (
                              <span
                                className="mt-1.5 h-2 w-2 rounded-full bg-[#38BDF8] shrink-0"
                                aria-label="Unread"
                              />
                            )}
                          </div>

                          <p className="mt-0.5 text-[11px] text-[#94A3B8] leading-relaxed">
                            {item.message}
                          </p>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[#64748B] truncate">
                              <span className={severity.textClass}>{severity.label}</span>
                              {item.entityRef && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{item.entityRef}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span>{formatRelativeTime(item.createdAt)}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!item.read && (
                                <button
                                  type="button"
                                  onClick={() => markNotificationRead(item.id, true)}
                                  className="p-1 rounded text-[#64748B] hover:text-[#38BDF8] hover:bg-slate-800/60 transition-colors"
                                  title="Mark as read"
                                  aria-label="Mark as read"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteNotification(item.id)}
                                className="p-1 rounded text-[#64748B] hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
                                title="Dismiss"
                                aria-label="Dismiss notification"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Footer */}
          {onOpenFullHistory && !showPrefs && (
            <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#05080D]/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenFullHistory();
                }}
                className="w-full text-center text-xs font-medium text-[#38BDF8] hover:text-[#67E8F9] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>View all notifications</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
