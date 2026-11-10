jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

import { supabase } from './supabase';
import { submitApplication } from './applications-api';

describe('submitApplication', () => {
  const getSession = supabase.auth.getSession as jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('submits with the active bearer token and validates the created application', async () => {
    const payload = { parcelRef: 'parcel-1' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'application-1',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    await expect(submitApplication(payload)).resolves.toEqual({
      id: 'application-1',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/applications$/),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
        },
        body: JSON.stringify(payload),
      }),
    );
  });

  it('rejects unauthenticated submissions without making a request', async () => {
    getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(submitApplication({})).rejects.toThrow('must be signed in');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('surfaces server errors and rejects invalid success responses', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Invalid parcel',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'application-1' }),
      });

    await expect(submitApplication({})).rejects.toThrow('Submission failed (422)');
    await expect(submitApplication({})).rejects.toThrow('invalid application response');
  });
});
