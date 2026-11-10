import { readFileSync } from 'fs';
import { join } from 'path';
import * as fc from 'fast-check';
import { AuditService } from './audit.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';

describe('AuditService', () => {
  const migration = readFileSync(
    join(__dirname, '../database/migrations/002_audit_trail.sql'),
    'utf8',
  );
  const insert = jest.fn();
  let service: AuditService;

  const actionArbitrary = fc.constantFrom(
    'SPATIAL_VERIFICATION',
    'ORACLE_VERIFICATION',
    'REGISTRAR_APPROVAL',
    'BLOCKCHAIN_REGISTRATION',
    'NFT_ISSUANCE',
    'MQTT_NOTIFICATION',
    'STATUTORY_REVOCATION',
    'PIPELINE_ERROR',
  );

  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null });
    const supabase = {
      raw: {
        from: jest.fn(() => ({ insert })),
      },
    };
    service = new AuditService(supabase as unknown as SupabaseClientService);
  });

  it('records all required audit fields in valid formats for generated transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          entityId: fc.uuid(),
          actorId: fc.uuid(),
          action: actionArbitrary,
          outcome: fc.string({ minLength: 1 }),
          metadata: fc.dictionary(fc.string(), fc.jsonValue()),
        }),
        async (entry) => {
          await service.record(entry);

          expect(insert).toHaveBeenCalledTimes(1);
          const row = insert.mock.calls[0][0];
          expect(row.entity_id).toBe(entry.entityId);
          expect(row.actor_id).toBe(entry.actorId);
          expect(row.action).toBe(entry.action);
          expect(row.outcome).toBe(entry.outcome);
          expect(row.created_at).toEqual(expect.any(String));
          expect(Number.isNaN(Date.parse(row.created_at))).toBe(false);
          expect(new Date(row.created_at).toISOString()).toBe(row.created_at);
          expect(row.metadata).toEqual(entry.metadata);
          insert.mockClear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('stores a null actor for system-initiated entries', async () => {
    await service.record({
      entityId: 'application-1',
      action: 'BLOCKCHAIN_REGISTRATION',
      outcome: 'SUCCESS',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'application-1',
        actor_id: null,
        action: 'BLOCKCHAIN_REGISTRATION',
        outcome: 'SUCCESS',
        metadata: {},
      }),
    );
  });

  it('rejects UPDATE and DELETE at the database layer, including service_role writes', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.reject_audit_trail_mutation\(\)/);
    expect(migration).toMatch(
      /BEFORE UPDATE OR DELETE ON public\.audit_trail[\s\S]*?EXECUTE FUNCTION public\.reject_audit_trail_mutation\(\)/,
    );
    expect(migration).toMatch(/RAISE EXCEPTION 'audit_trail is append-only/);
  });
});
