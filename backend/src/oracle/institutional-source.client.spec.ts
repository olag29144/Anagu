import { InstitutionalSourceClient } from './institutional-source.client';

describe('InstitutionalSourceClient', () => {
  const client = new InstitutionalSourceClient();

  it('returns the seeded parcel fixture for known land records', async () => {
    await expect(client.fetchRecord('ABUJA/2024/001')).resolves.toEqual({
      parcelRef: 'ABUJA/2024/001',
      activeOwnerName: 'Emeka Okonkwo',
      documentNumber: 'DOC-12345',
      legalHold: false,
    });
  });

  it('returns null for parcels with no institutional record', async () => {
    await expect(client.fetchRecord('UNKNOWN/PARCEL')).resolves.toBeNull();
  });
});
