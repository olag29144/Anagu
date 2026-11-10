import * as fc from 'fast-check';

jest.mock('react-native-mmkv', () => {
  const state: { value?: string } = {};
  return {
    __esModule: true,
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn(() => state.value),
      set: jest.fn((_key: string, value: string) => {
        state.value = value;
      }),
    })),
    __mockState: state,
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

import {
  dequeue,
  enqueue,
  flushQueue,
  retryFailedSubmission,
  subscribeToQueue,
} from './offline-queue';

const mockStorageState = jest.requireMock('react-native-mmkv').__mockState as {
  value?: string;
};

const payloadArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 12 }),
  fc.jsonValue(),
);

describe('offline submission queue', () => {
  beforeEach(() => {
    mockStorageState.value = undefined;
  });

  it('preserves every generated payload in persistent queue order', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(payloadArbitrary, { maxLength: 12 }), async (payloads) => {
        mockStorageState.value = undefined;
        payloads.forEach((payload) => enqueue(payload));

        const queued = dequeue();
        const persistedPayloads = JSON.parse(
          JSON.stringify(payloads),
        ) as Record<string, unknown>[];
        expect(queued.map((item) => item.payload)).toEqual(persistedPayloads);
        expect(new Set(queued.map((item) => item.id)).size).toBe(queued.length);
        expect(queued.every((item) => item.status === 'pending')).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it('notifies subscribers whenever the persistent queue changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToQueue(listener);

    enqueue({ applicationId: 'app-observed' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    enqueue({ applicationId: 'app-unobserved' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('flushes every generated payload and removes it only after successful submission', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(payloadArbitrary, { maxLength: 10 }), async (payloads) => {
        mockStorageState.value = undefined;
        payloads.forEach((payload) => enqueue(payload));
        const submitted: Record<string, unknown>[] = [];
        const flushedIds: string[] = [];

        await flushQueue(
          {
            submitApplication: async (payload) => {
              submitted.push(payload);
            },
          },
          (id) => flushedIds.push(id),
        );

        const persistedPayloads = JSON.parse(
          JSON.stringify(payloads),
        ) as Record<string, unknown>[];
        expect(submitted).toEqual(persistedPayloads);
        expect(flushedIds).toHaveLength(payloads.length);
        expect(dequeue()).toEqual([]);
      }),
      { numRuns: 25 },
    );
  });

  it('increments retries and retains an item as failed after five failed attempts', async () => {
    enqueue({ applicationId: 'app-retry' });
    const failingClient = {
      submitApplication: jest.fn().mockRejectedValue(new Error('offline')),
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await flushQueue(failingClient, jest.fn());
    }

    const [item] = dequeue();
    expect(item.retryCount).toBe(5);
    expect(item.status).toBe('failed');

    await flushQueue(failingClient, jest.fn());
    expect(failingClient.submitApplication).toHaveBeenCalledTimes(5);
    expect(dequeue()).toEqual([item]);
  });

  it('allows a failed item to be manually retried without losing its payload', async () => {
    enqueue({ applicationId: 'app-manual-retry' });
    const failingClient = {
      submitApplication: jest.fn().mockRejectedValue(new Error('offline')),
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await flushQueue(failingClient, jest.fn());
    }

    const [failedItem] = dequeue();
    expect(retryFailedSubmission(failedItem.id)).toBe(true);
    expect(dequeue()).toEqual([
      { ...failedItem, retryCount: 0, status: 'pending' },
    ]);

    const succeedingClient = {
      submitApplication: jest.fn().mockResolvedValue(undefined),
    };
    await flushQueue(succeedingClient, jest.fn());

    expect(succeedingClient.submitApplication).toHaveBeenCalledWith({
      applicationId: 'app-manual-retry',
    });
    expect(dequeue()).toEqual([]);
  });

  it('does not change missing or non-failed items when retry is requested', () => {
    enqueue({ applicationId: 'app-pending' });
    const [item] = dequeue();

    expect(retryFailedSubmission('missing-item')).toBe(false);
    expect(retryFailedSubmission(item.id)).toBe(false);
    expect(dequeue()).toEqual([item]);
  });

  it('does not requeue a successfully submitted item if the notification callback throws', async () => {
    enqueue({ applicationId: 'app-callback' });

    await expect(
      flushQueue(
        { submitApplication: async () => undefined },
        () => {
          throw new Error('notification failed');
        },
      ),
    ).rejects.toThrow('notification failed');

    expect(dequeue()).toEqual([]);
  });

  it('throws on malformed persisted data instead of silently dropping queued submissions', () => {
    mockStorageState.value = '{invalid';

    expect(() => dequeue()).toThrow();
  });
});
