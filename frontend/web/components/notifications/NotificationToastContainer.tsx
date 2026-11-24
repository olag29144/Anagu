'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  NOTIFICATION_TOAST_EVENT,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notifications-store';

interface ActiveToast {
  notification: AppNotification;
  expiresAt: number;
}

const TOAST_DURATION_MS = 5000;
const MAX_TOASTS = 3;

export function NotificationToastContainer() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotification>;
      const notification = customEvent.detail;
      if (!notification) return;

      setToasts((prev) => {
        const filtered = prev.filter((t) => t.notification.id !== notification.id);
        return [
          { notification, expiresAt: Date.now() + TOAST_DURATION_MS },
          ...filtered,
        ].slice(0, MAX_TOASTS);
      });
    };

    window.addEventListener(NOTIFICATION_TOAST_EVENT, handleToastEvent);
    return () => {
      window.removeEventListener(NOTIFICATION_TOAST_EVENT, handleToastEvent);
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => t.expiresAt > now));
    }, 500);

    return () => window.clearInterval(timer);
  }, [toasts.length]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.notification.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Live notifications"
      className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map(({ notification }) => {
        const Icon =
          notification.severity === 'success'
            ? CheckCircle2
            : notification.severity === 'warning'
              ? AlertTriangle
              : notification.severity === 'error'
                ? XCircle
                : Info;

        const iconColorClass =
          notification.severity === 'success'
            ? 'text-emerald-400'
            : notification.severity === 'warning'
              ? 'text-amber-400'
              : notification.severity === 'error'
                ? 'text-rose-400'
                : 'text-[#38BDF8]';

        return (
          <div
            key={notification.id}
            role="status"
            className="pointer-events-auto rounded-xl bg-[#0A0F16]/95 backdrop-blur-md border border-[rgba(91,133,167,0.35)] shadow-2xl p-3.5 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <Icon className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${iconColorClass}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-[#F4F7FB] leading-snug">
                    {notification.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismissToast(notification.id)}
                    className="p-0.5 rounded text-[#64748B] hover:text-[#F4F7FB] shrink-0"
                    aria-label="Dismiss notification toast"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#94A3B8] leading-relaxed">
                  {notification.message}
                </p>
                {notification.href && (
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationRead(notification.id, true);
                      dismissToast(notification.id);
                      router.push(notification.href!);
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#38BDF8] hover:text-[#67E8F9] transition-colors"
                  >
                    <span>Open details</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
