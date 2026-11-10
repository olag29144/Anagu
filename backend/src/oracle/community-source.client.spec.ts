import { SupabaseClientService } from '../supabase/supabase-client.service';
import { CommunitySourceClient } from './community-source.client';

describe('CommunitySourceClient', () => {
  const parcelRef = 'ABUJA/2024/001';
  let client: CommunitySourceClient;
  let queryResult: {
    data: Array<{ attestation: unknown }> | null;
    error: { message: string } | null;
  };
  let query: {
    select: jest.Mock;
    eq: jest.Mock;
  };

  beforeEach(() => {
    queryResult = { data: [], error: null };
    query = {
      select: jest.fn(),
      eq: jest.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockImplementation(async () => queryResult);
    const supabase = {
      raw: {
        from: jest.fn(() => query),
      },
    };
    client = new CommunitySourceClient(
      supabase as unknown as SupabaseClientService,
    );
  });

  it('returns all string attestations for the requested parcel', async () => {
    queryResult.data = [
      { attestation: 'Claim confirmed by community elder' },
      { attestation: 'Boundary acknowledged at meeting' },
      { attestation: null },
    ];

    await expect(client.fetchRecord(parcelRef)).resolves.toEqual({
      parcelRef,
      communityAttestations: [
        'Claim confirmed by community elder',
        'Boundary acknowledged at meeting',
      ],
    });
    expect(query.select).toHaveBeenCalledWith('attestation');
    expect(query.eq).toHaveBeenCalledWith('parcel_ref', parcelRef);
  });

  it('returns null when the parcel has no attestations', async () => {
    await expect(client.fetchRecord(parcelRef)).resolves.toBeNull();
  });

  it('surfaces database errors', async () => {
    queryResult = { data: null, error: { message: 'database unavailable' } };

    await expect(client.fetchRecord(parcelRef)).rejects.toThrow(
      'Failed to fetch community attestations',
    );
  });
});
