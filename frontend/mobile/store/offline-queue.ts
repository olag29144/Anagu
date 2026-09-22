import { MMKV } from 'react-native-mmkv';
import NetInfo from '@react-native-community/netinfo';

// ---------------------------------------------------------------------------
// Storage initialisation
// ---------------------------------------------------------------------------

const storage = new MMKV({ id: 'anagu-offline-queue' });
const QUEUE_KEY = 'offline_submissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedSubmission {
  id: string;
  payload: Record<string, unknown>;
  queuedAt: string;  // ISO 8601
  retryCount: number;
  status?: 'pending' | 'failed';
}

/**
 * Minimal API client contract required by the offline queue.
 * The full `AnaguApiClient` is implemented in the networking layer;
 * this interface keeps the queue free of circular dependencies.
 */
export interface SubmissionApiClient {
  submitApplication(payload: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Core queue operations
// ---------------------------------------------------------------------------

/**
 * Add a new item to the persistent offline queue.
 */
export function enqueue(payload: Record<string, unknown>): void {
  const current = readQueue();
  const entry: QueuedSubmission = {
    id: crypto.randomUUID(),
    payload,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };
  writeQueue([...current, entry]);
}

/**
 * Return all items currently in the queue (including failed ones).
 */
export function dequeue(): QueuedSubmission[] {
  return readQueue();
}

/**
 * Remove a single item by id.
 */
export function remove(id: string): void {
  const updated = readQueue().filter((item) => item.id !== id);
  writeQueue(updated);
}

// ---------------------------------------------------------------------------
// Flush — submit all pending items when connectivity is available
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;

/**
 * Attempt to flush all pending queue items to the backend.
 *
 * For each item:
 * - On success: removed from the queue; `onItemFlushed` is called with the id.
 * - On failure: `retryCount` is incremented. After `MAX_RETRIES` (5) the item
 *   is marked `status: 'failed'` and the user must take manual action.
 *   Items are NEVER silently dropped.
 *
 * @param apiClient  Object that exposes `submitApplication(payload)`.
 * @param onItemFlushed  Callback invoked after each successful submission.
 */
export async function flushQueue(
  apiClient: SubmissionApiClient,
  onItemFlushed: (id: string) => void,
): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const updated: QueuedSubmission[] = [];

  for (const item of queue) {
    if (item.status === 'failed') {
      // Already exhausted retries — keep in queue so user can inspect / retry
      updated.push(item);
      continue;
    }

    try {
      await apiClient.submitApplication(item.payload);
      // Success — do not add back to the updated list (effectively removes it)
      onItemFlushed(item.id);
    } catch {
      const newRetryCount = item.retryCount + 1;
      const newStatus: QueuedSubmission['status'] =
        newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
      updated.push({ ...item, retryCount: newRetryCount, status: newStatus });
    }
  }

  writeQueue(updated);
}

// ---------------------------------------------------------------------------
// Connectivity listener — auto-flush on reconnect
// ---------------------------------------------------------------------------

/**
 * Register a NetInfo listener that calls `flushQueue` whenever network
 * connectivity is restored and the queue is non-empty.
 *
 * @returns An unsubscribe function. Call it (e.g. in a `useEffect` cleanup)
 *          to prevent memory leaks.
 */
export function registerConnectivityListener(
  apiClient: SubmissionApiClient,
): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isConnected = state.isConnected === true;
    const hasPending = readQueue().some((item) => item.status !== 'failed');

    if (isConnected && hasPending) {
      // Fire-and-forget — errors are handled inside flushQueue
      flushQueue(apiClient, () => {}).catch(() => {
        // Network was reported connected but the flush still failed; the items
        // will remain in the queue and retry on the next connectivity event.
      });
    }
  });

  return unsubscribe;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readQueue(): QueuedSubmission[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedSubmission[];
  } catch {
    // Corrupted storage — return empty and let a fresh write fix it
    return [];
  }
}

function writeQueue(items: QueuedSubmission[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(items));
}
