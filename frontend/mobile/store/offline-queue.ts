import { MMKV } from 'react-native-mmkv';
import NetInfo from '@react-native-community/netinfo';

// ---------------------------------------------------------------------------
// Storage initialisation
// ---------------------------------------------------------------------------

const storage = new MMKV({ id: 'anagu-offline-queue' });
const QUEUE_KEY = 'offline_submissions';
let idSequence = 0;
let flushInProgress = false;
const queueListeners = new Set<() => void>();

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
 * Minimal API client contract required by the offline queue. Keeping this
 * interface here avoids coupling queue storage to the HTTP implementation.
 */
export interface SubmissionApiClient {
  submitApplication(
    payload: Record<string, unknown>,
  ): Promise<void | { id: string }>;
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
    id: createId(),
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

export function subscribeToQueue(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

/**
 * Remove a single item by id.
 */
export function remove(id: string): void {
  const updated = readQueue().filter((item) => item.id !== id);
  writeQueue(updated);
}

/**
 * Re-enable a failed submission for a user-requested retry.
 * Returns false when the item no longer exists or is not failed.
 */
export function retryFailedSubmission(id: string): boolean {
  const queue = readQueue();
  const item = queue.find((entry) => entry.id === id);
  if (!item || item.status !== 'failed') {
    return false;
  }

  item.retryCount = 0;
  item.status = 'pending';
  writeQueue(queue);
  return true;
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
  if (flushInProgress) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  flushInProgress = true;
  try {
    for (const item of queue) {
      if (item.status === 'failed') {
        continue;
      }

      try {
        await apiClient.submitApplication(item.payload);
      } catch {
        const newRetryCount = item.retryCount + 1;
        const newStatus: QueuedSubmission['status'] =
          newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
        updateItem({ ...item, retryCount: newRetryCount, status: newStatus });
        continue;
      }

      remove(item.id);
      onItemFlushed(item.id);
    }
  } finally {
    flushInProgress = false;
  }
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
      // Fire-and-forget; report storage/callback failures that are not retries.
      flushQueue(apiClient, () => {}).catch(() => {
        console.error('Failed to flush offline submissions');
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
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.payload === 'object' &&
        item.payload !== null &&
        typeof item.queuedAt === 'string' &&
        Number.isInteger(item.retryCount) &&
        item.retryCount >= 0 &&
        (item.status === undefined ||
          item.status === 'pending' ||
          item.status === 'failed'),
    )
  ) {
    throw new Error('Offline submission queue contains invalid stored data');
  }
  return parsed as QueuedSubmission[];
}

function writeQueue(items: QueuedSubmission[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(items));
  queueListeners.forEach((listener) => listener());
}

function updateItem(updatedItem: QueuedSubmission): void {
  const queue = readQueue();
  const index = queue.findIndex((item) => item.id === updatedItem.id);
  if (index === -1) return;
  queue[index] = updatedItem;
  writeQueue(queue);
}

function createId(): string {
  idSequence += 1;
  return `submission-${Date.now()}-${idSequence}-${Math.random().toString(36).slice(2)}`;
}
