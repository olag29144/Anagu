'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Trash2,
  Search,
  MapPin,
  ShoppingBag,
  FileText,
  KeyRound,
  ShieldCheck,
  ArrowRight,
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

interface NotificationsPanelProps {
  audience?: NotificationAudience;
  userId?: string | null;
  userEmail?: string | null;
}

type CategoryFilter = 'all' | 'land' | 'orders' | 'governance';

function matchesCategoryFilter(
  category: NotificationCategory,
  filter: CategoryFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'land') return category === 'land_status' || category === 'application';
  if (filter === 'orders') return category === 'purchase';
  if (filter === 'governance') {
    return category === 'revocation' || category === 'access_code' || category === 'account';
  }
  return true;
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

export function NotificationsPanel({
  audience = 'user',
  userId,
  userEmail,
}: NotificationsPanelProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    toastEnabled: true,
    browserPushEnabled: false,
    landUpdates: true,
    orderUpdates: true,
    governanceAlerts: true,
  });
  const [browserPermission, setBrowserPermission] = useState<string>('default');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((n) => {
      if (onlyUnread && n.read) return false;
      if (!matchesCategoryFilter(n.category, categoryFilter)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.entityRef ?? '').toLowerCase().includes(q)
      );
    });
  }, [notifications, onlyUnread, categoryFilter, searchQuery]);

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
      saveNotificationPreferences({ browserPushEnabled: permission === 'granted' });
      return;
    }

    saveNotificationPreferences({ browserPushEnabled: false });
  };

  return (
    <section className="space-y-6">
      {/* Header & Bulk Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#F4F7FB] flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#38BDF8]" />
            <span>Notification Center</span>
          </h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Real-time alerts for land approvals, buyer purchase orders, escrow settlements, and role notices.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllNotificationsRead(notifications.map((n) => n.id))}
              className="h-9 px-3 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/35 text-[#67E8F9] hover:bg-[#38BDF8]/25 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read ({unreadCount})</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => clearNotifications(notifications.map((n) => n.id))}
              className="h-9 px-3 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] hover:border-rose-500/40 text-xs text-[#94A3B8] hover:text-rose-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear all</span>
            </button>
          )}
        </div>
      </div>

      {/* Delivery Preferences Strip */}
      <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#E2E8F0]">
            <input
              type="checkbox"
              checked={prefs.toastEnabled}
              onChange={(e) =>
                saveNotificationPreferences({ toastEnabled: e.target.checked })
              }
              className="h-4 w-4 accent-[#38BDF8] rounded"
            />
            <span>Live popup toasts</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#E2E8F0]">
            <input
              type="checkbox"
              checked={prefs.landUpdates}
              onChange={(e) =>
                saveNotificationPreferences({ landUpdates: e.target.checked })
              }
              className="h-4 w-4 accent-[#38BDF8] rounded"
            />
            <span>Land updates</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#E2E8F0]">
            <input
              type="checkbox"
              checked={prefs.orderUpdates}
              onChange={(e) =>
                saveNotificationPreferences({ orderUpdates: e.target.checked })
              }
              className="h-4 w-4 accent-[#38BDF8] rounded"
            />
            <span>Orders &amp; escrow</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#E2E8F0]">
            <input
              type="checkbox"
              checked={prefs.governanceAlerts}
              onChange={(e) =>
                saveNotificationPreferences({ governanceAlerts: e.target.checked })
              }
              className="h-4 w-4 accent-[#38BDF8] rounded"
            />
            <span>Governance alerts</span>
          </label>
        </div>

        <button
          type="button"
          disabled={browserPermission === 'denied' || browserPermission === 'unsupported'}
          onClick={() => void handleToggleBrowserPush()}
          className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
            prefs.browserPushEnabled && browserPermission === 'granted'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-[#05080D] border-[rgba(91,133,167,0.28)] text-[#CBD5E1] hover:border-[#38BDF8]/50'
          }`}
        >
          {browserPermission === 'denied'
            ? 'Browser Alerts Blocked'
            : browserPermission === 'unsupported'
              ? 'Browser Alerts Unsupported'
              : prefs.browserPushEnabled && browserPermission === 'granted'
                ? 'Desktop Alerts: On'
                : 'Enable Desktop Alerts'}
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.20)]">
            {(
              [
                ['all', 'All'],
                ['land', 'Land'],
                ['orders', 'Orders'],
                ['governance', 'Governance'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === key
                    ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyUnread((prev) => !prev)}
            className={`h-8 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
              onlyUnread
                ? 'bg-[#38BDF8]/15 border-[#38BDF8]/40 text-[#67E8F9]'
                : 'bg-[#0A0F16] border-[rgba(91,133,167,0.20)] text-[#94A3B8] hover:text-[#F4F7FB]'
            }`}
          >
            Unread only
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications…"
            className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-xs text-[#F4F7FB] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none"
          />
        </div>
      </div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-10 text-center space-y-2">
          <Bell className="h-8 w-8 text-[#475569] mx-auto" />
          <p className="text-sm font-medium text-[#CBD5E1]">No matching notifications</p>
          <p className="text-xs text-[#64748B]">
            {onlyUnread
              ? 'You have read all notifications in this category.'
              : 'Events from land registrations, approvals, and purchase orders will show up here.'}
          </p>
        </div>
      ) : (
        <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] divide-y divide-[rgba(91,133,167,0.14)] overflow-hidden">
          {filtered.map((item) => {
            const CategoryIcon = getCategoryIcon(item.category);
            const SeverityIcon =
              item.severity === 'success'
                ? CheckCircle2
                : item.severity === 'warning'
                  ? AlertTriangle
                  : item.severity === 'error'
                    ? XCircle
                    : Info;
            const severityColor =
              item.severity === 'success'
                ? 'text-emerald-400'
                : item.severity === 'warning'
                  ? 'text-amber-400'
                  : item.severity === 'error'
                    ? 'text-rose-400'
                    : 'text-[#38BDF8]';

            return (
              <div
                key={item.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  item.read ? 'hover:bg-[#05080D]/60' : 'bg-[#38BDF8]/[0.04] hover:bg-[#38BDF8]/[0.08]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.24)] flex items-center justify-center shrink-0">
                    <CategoryIcon className={`h-4 w-4 ${severityColor}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-[#F4F7FB]">
                        {item.title}
                      </p>
                      {!item.read && (
                        <span
                          className="h-2 w-2 rounded-full bg-[#38BDF8] shrink-0"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#94A3B8]">{item.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-[#64748B]">
                      <span className={`inline-flex items-center gap-1 ${severityColor}`}>
                        <SeverityIcon className="h-3 w-3" />
                        <span>{item.severity.toUpperCase()}</span>
                      </span>
                      {item.entityRef && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.entityRef}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {item.href && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.read) markNotificationRead(item.id, true);
                        router.push(item.href!);
                      }}
                      className="h-8 px-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.24)] hover:border-[#38BDF8]/50 text-xs text-[#38BDF8] inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <span>Open</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => markNotificationRead(item.id, !item.read)}
                    className="h-8 px-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] hover:border-[#38BDF8]/40 text-xs text-[#94A3B8] hover:text-[#F4F7FB] inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    title={item.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    <Check className="h-3 w-3" />
                    <span>{item.read ? 'Unread' : 'Read'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNotification(item.id)}
                    className="h-8 w-8 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] hover:border-rose-500/40 text-[#64748B] hover:text-rose-400 inline-flex items-center justify-center transition-colors"
                    aria-label="Delete notification"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
