export type NotificationCategory =
  | 'land_status'
  | 'purchase'
  | 'application'
  | 'revocation'
  | 'access_code'
  | 'account'
  | 'system';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationAudience = 'all' | 'user' | 'registrar' | 'governor' | 'admin';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  recipientRole?: NotificationAudience;
  recipientUserId?: string;
  recipientEmail?: string;
  href?: string;
  entityRef?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  toastEnabled: boolean;
  browserPushEnabled: boolean;
  landUpdates: boolean;
  orderUpdates: boolean;
  governanceAlerts: boolean;
}

const NOTIFICATIONS_STORAGE_KEY = 'anagu_notifications_v1';
const NOTIFICATION_PREFS_KEY = 'anagu_notification_prefs_v1';
const MAX_STORED_NOTIFICATIONS = 100;

export const NOTIFICATIONS_CHANGED_EVENT = 'anagu-notifications-changed';
export const NOTIFICATION_TOAST_EVENT = 'anagu-notification-toast';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  toastEnabled: true,
  browserPushEnabled: false,
  landUpdates: true,
  orderUpdates: true,
  governanceAlerts: true,
};

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NTF-2026-001',
    title: 'Land Title Verified & Listed',
    message:
      'Lekki Peninsula Waterfront Plot 14 passed cadastral verification and is live on Explore Land.',
    category: 'land_status',
    severity: 'success',
    recipientRole: 'all',
    recipientUserId: 'USR-ADELEKE',
    recipientEmail: 'estates@adelekeholdings.ng',
    entityRef: 'NG-LAG-LEK-2026-0089',
    href: '/explore',
    read: false,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'NTF-2026-002',
    title: 'Escrow Order Pending Settlement',
    message:
      'Purchase order ORD-2026-302 for Sagamu Greenbelt Agricultural Acreage is awaiting final settlement.',
    category: 'purchase',
    severity: 'warning',
    recipientRole: 'admin',
    recipientUserId: 'USR-ADELEKE',
    recipientEmail: 'estates@adelekeholdings.ng',
    entityRef: 'ORD-2026-302',
    href: '/dashboard',
    read: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'NTF-2026-003',
    title: 'Application Ready for Registrar Review',
    message:
      'Docket APP-2026-0891 (LAG-ETI-2026-00412) passed PostGIS spatial check and awaits adjudication.',
    category: 'application',
    severity: 'info',
    recipientRole: 'registrar',
    entityRef: 'APP-2026-0891',
    href: '/registrar',
    read: false,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'NTF-2026-004',
    title: 'Statutory Revocation Logged (LUA §28)',
    message:
      'Land Title Token #1039 (KAN-KMC-2025-00109) statutory revocation recorded on audit ledger.',
    category: 'revocation',
    severity: 'warning',
    recipientRole: 'governor',
    entityRef: 'TOKEN-1039',
    href: '/governor',
    read: true,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

function emitNotificationsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...parsed,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function saveNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): NotificationPreferences {
  const next: NotificationPreferences = {
    ...getNotificationPreferences(),
    ...updates,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
      emitNotificationsChanged();
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function getNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return INITIAL_NOTIFICATIONS;
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(INITIAL_NOTIFICATIONS),
      );
      return INITIAL_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppNotification[]) : INITIAL_NOTIFICATIONS;
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveNotifications(notifications: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS)),
    );
    emitNotificationsChanged();
  } catch {
    // Ignore storage quota errors
  }
}

function isCategoryEnabled(
  category: NotificationCategory,
  prefs: NotificationPreferences,
): boolean {
  if (category === 'land_status' || category === 'application') {
    return prefs.landUpdates;
  }
  if (category === 'purchase') {
    return prefs.orderUpdates;
  }
  if (category === 'revocation' || category === 'access_code' || category === 'account') {
    return prefs.governanceAlerts;
  }
  return true;
}

export function addNotification(
  input: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & {
    showToast?: boolean;
  },
): AppNotification {
  const { showToast = true, ...payload } = input;
  const created: AppNotification = {
    ...payload,
    id: `NTF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (typeof window === 'undefined') {
    return created;
  }

  const prefs = getNotificationPreferences();
  const existing = getNotifications();
  saveNotifications([created, ...existing]);

  const allowedByPrefs = isCategoryEnabled(created.category, prefs);

  if (showToast && prefs.toastEnabled && allowedByPrefs) {
    window.dispatchEvent(
      new CustomEvent<AppNotification>(NOTIFICATION_TOAST_EVENT, {
        detail: created,
      }),
    );
  }

  if (
    prefs.browserPushEnabled &&
    allowedByPrefs &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    try {
      const browserNotice = new Notification(`Anagu · ${created.title}`, {
        body: created.message,
      });
      browserNotice.onclick = () => {
        window.focus();
        if (created.href) {
          window.location.href = created.href;
        }
        browserNotice.close();
      };
    } catch {
      // Ignore browser notification errors in restricted contexts
    }
  }

  return created;
}

export function markNotificationRead(notificationId: string, read = true): AppNotification[] {
  const next = getNotifications().map((n) =>
    n.id === notificationId ? { ...n, read } : n,
  );
  saveNotifications(next);
  return next;
}

export function markAllNotificationsRead(ids?: string[]): AppNotification[] {
  const idSet = ids ? new Set(ids) : null;
  const next = getNotifications().map((n) =>
    !idSet || idSet.has(n.id) ? { ...n, read: true } : n,
  );
  saveNotifications(next);
  return next;
}

export function deleteNotification(notificationId: string): AppNotification[] {
  const next = getNotifications().filter((n) => n.id !== notificationId);
  saveNotifications(next);
  return next;
}

export function clearNotifications(ids?: string[]): AppNotification[] {
  if (!ids) {
    saveNotifications([]);
    return [];
  }
  const idSet = new Set(ids);
  const next = getNotifications().filter((n) => !idSet.has(n.id));
  saveNotifications(next);
  return next;
}

export function getNotificationsForAudience(options: {
  audience?: NotificationAudience;
  userId?: string | null;
  userEmail?: string | null;
}): AppNotification[] {
  const all = getNotifications();
  const cleanEmail = options.userEmail?.trim().toLowerCase() || '';
  const audience = options.audience || 'all';

  return all
    .filter((n) => {
      if (audience === 'admin') {
        return true;
      }

      if (options.userId && n.recipientUserId && n.recipientUserId === options.userId) {
        return true;
      }

      if (
        cleanEmail &&
        cleanEmail !== 'not provided' &&
        n.recipientEmail &&
        n.recipientEmail.trim().toLowerCase() === cleanEmail
      ) {
        return true;
      }

      if (!n.recipientRole || n.recipientRole === 'all') {
        return true;
      }

      if (n.recipientRole === audience) {
        return true;
      }

      if (audience === 'user' && n.recipientRole === 'user' && !n.recipientUserId && !n.recipientEmail) {
        return true;
      }

      return false;
    })
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function formatRelativeTime(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
  });
}
