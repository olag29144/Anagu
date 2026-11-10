import * as fc from 'fast-check';
import { AuditService } from '../audit/audit.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { MqttService } from '../mqtt/mqtt.service';
import { OracleService } from '../oracle/oracle.service';
import { SpatialService } from '../spatial/spatial.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { RegistrationPipelineService } from './registration-pipeline.service';
import { ApplicationRecord } from './pipeline.types';

describe('RegistrationPipelineService', () => {
  const applicationId = 'application-001';
  const registrarId = 'registrar-001';
  let pipeline: RegistrationPipelineService;
  let events: string[];
  let application: ApplicationRecord;
  let spatialMock: {
    verifySpatial: jest.Mock;
    persistVerifiedParcel: jest.Mock;
    ringToWKT: jest.Mock;
  };
  let oracleMock: { verify: jest.Mock };
  let blockchainMock: { mintTitle: jest.Mock };
  let mqttMock: { publish: jest.Mock };
  let auditMock: { record: jest.Mock };
  let supabaseMock: { raw: { from: jest.Mock } };
  let insertedTitles: Record<string, unknown>[];
  let applicationUpdates: Record<string, unknown>[];
  let parcelUpdates: Record<string, unknown>[];

  const applicationArbitrary = fc.record({
    id: fc.uuid(),
    citizen_id: fc.uuid(),
    owner_name: fc.string({ minLength: 1, maxLength: 40 }),
    owner_wallet_address: fc.constant('0x0000000000000000000000000000000000000001'),
    document_number: fc.string({ minLength: 1, maxLength: 30 }),
    document_type: fc.string({ minLength: 1, maxLength: 30 }),
    issuing_authority: fc.string({ minLength: 1, maxLength: 30 }),
    parcel_ref: fc.string({ minLength: 1, maxLength: 30 }),
    spatial_hash: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
    title_metadata_uri: fc.option(fc.webUrl(), { nil: null }),
    status: fc.constant<'pending'>('pending'),
    parcel_ring: fc.constant({
      coordinates: [
        [3, 6],
        [4, 6],
        [4, 7],
      ] as [number, number][],
    }),
  });

  beforeEach(() => {
    events = [];
    application = {
      id: 'parcel-record-001',
      citizen_id: 'citizen-001',
      owner_name: 'Test Owner',
      owner_wallet_address: '0x0000000000000000000000000000000000000001',
      document_number: 'DOC-001',
      document_type: 'Certificate',
      issuing_authority: 'Registry',
      parcel_ref: 'PARCEL-001',
      spatial_hash: 'spatial-hash',
      title_metadata_uri: 'ipfs://metadata',
      status: 'pending',
      parcel_ring: { coordinates: [[3, 6], [4, 6], [4, 7]] },
    };
    spatialMock = {
      verifySpatial: jest.fn().mockImplementation(async () => {
        events.push('spatial');
        await auditMock.record({
          entityId: application.id,
          action: 'SPATIAL_VERIFICATION',
          outcome: 'APPROVED',
        });
        return { outcome: 'approved', bufferMetres: 0.5, checkedAt: new Date().toISOString() };
      }),
      persistVerifiedParcel: jest.fn().mockImplementation(async () => {
        events.push('persist-parcel');
        return 'parcel-uuid-001';
      }),
      ringToWKT: jest.fn(() => 'SRID=4326;POLYGON((3 6, 4 6, 4 7, 3 6))'),
    };
    oracleMock = {
      verify: jest.fn().mockImplementation(async () => {
        events.push('oracle');
        await auditMock.record({
          entityId: application.id,
          action: 'ORACLE_VERIFICATION',
          outcome: 'SuccessfullyVerified',
        });
        return { outcome: 'SuccessfullyVerified' };
      }),
    };
    blockchainMock = {
      mintTitle: jest.fn().mockImplementation(async () => {
        events.push('blockchain');
        return { tokenId: 99n, txHash: '0xmint-hash' };
      }),
    };
    mqttMock = {
      publish: jest.fn().mockImplementation(async (topic: string) => {
        events.push(`mqtt:${topic}`);
      }),
    };
    auditMock = {
      record: jest.fn().mockImplementation(async (entry: Record<string, unknown>) => {
        events.push(`audit:${entry.action}`);
      }),
    };
    insertedTitles = [];
    applicationUpdates = [];
    parcelUpdates = [];

    const from = jest.fn((table: string) => {
      if (table === 'applications') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(async () => ({ data: application, error: null })),
            })),
          })),
          update: jest.fn((values: Record<string, unknown>) => ({
            eq: jest.fn(async () => {
              events.push(`application-status:${values.status}`);
              applicationUpdates.push(values);
              application.status = values.status as ApplicationRecord['status'];
              return { error: null };
            }),
          })),
        };
      }

      if (table === 'land_titles') {
        return {
          insert: jest.fn(async (row: Record<string, unknown>) => {
            events.push('land-title');
            insertedTitles.push(row);
            return { error: null };
          }),
        };
      }

      if (table === 'parcels') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(async () => ({
                data: { id: 'parcel-uuid-001' },
                error: null,
              })),
            })),
          })),
          update: jest.fn((values: Record<string, unknown>) => ({
            eq: jest.fn(async () => {
              events.push('parcel-status');
              parcelUpdates.push(values);
              return { error: null };
            }),
          })),
        };
      }

      throw new Error(`Unexpected Supabase table: ${table}`);
    });
    supabaseMock = { raw: { from } };

    pipeline = new RegistrationPipelineService(
      spatialMock as unknown as SpatialService,
      oracleMock as unknown as OracleService,
      blockchainMock as unknown as BlockchainService,
      mqttMock as unknown as MqttService,
      auditMock as unknown as AuditService,
      supabaseMock as unknown as SupabaseClientService,
    );
  });

  it('preserves spatial → oracle → in_review stage order for generated applications', async () => {
    await fc.assert(
      fc.asyncProperty(applicationArbitrary, async (generatedApplication) => {
        application = generatedApplication;
        events.length = 0;
        insertedTitles.length = 0;
        applicationUpdates.length = 0;
        parcelUpdates.length = 0;
        auditMock.record.mockClear();
        mqttMock.publish.mockClear();

        await pipeline.run(application.id);
        await pipeline.completeAfterRegistrarApproval(application.id, registrarId);

        expect(
          events
            .filter((event) => event.startsWith('audit:'))
            .map((event) => event.slice('audit:'.length)),
        ).toEqual([
          'SPATIAL_VERIFICATION',
          'ORACLE_VERIFICATION',
          'APPLICATION_STATUS_TRANSITION',
          'REGISTRAR_APPROVAL',
          'BLOCKCHAIN_REGISTRATION',
          'NFT_ISSUANCE',
          'MQTT_NOTIFICATION',
          'APPLICATION_STATUS_TRANSITION',
        ]);
        expect(events.indexOf('spatial')).toBeLessThan(events.indexOf('oracle'));
        expect(events.indexOf('oracle')).toBeLessThan(
          events.indexOf('audit:APPLICATION_STATUS_TRANSITION'),
        );
        expect(spatialMock.persistVerifiedParcel).toHaveBeenCalledWith(
          generatedApplication.id,
          generatedApplication.parcel_ring,
        );
        expect(events.indexOf('audit:REGISTRAR_APPROVAL')).toBeLessThan(
          events.indexOf('audit:BLOCKCHAIN_REGISTRATION'),
        );
        expect(events.indexOf('audit:BLOCKCHAIN_REGISTRATION')).toBeLessThan(
          events.indexOf('audit:NFT_ISSUANCE'),
        );
        expect(events.indexOf('audit:NFT_ISSUANCE')).toBeLessThan(
          events.indexOf('audit:MQTT_NOTIFICATION'),
        );
        expect(auditMock.record).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: generatedApplication.id,
            action: 'APPLICATION_STATUS_TRANSITION',
            outcome: 'COMPLETED',
            metadata: { from: 'in_review', to: 'completed' },
          }),
        );
      }),
      { numRuns: 20 },
    );
  });

  it.each([
    [
      'spatial',
      { outcome: 'rejected_invalid_geometry', diagnosticCode: 'GEOM_INVALID' },
      'SPATIAL_VERIFICATION',
    ],
    [
      'oracle',
      { outcome: 'OwnershipConflict', reason: 'Different owner' },
      'ORACLE_VERIFICATION',
    ],
  ] as const)(
    'audits, rejects, and publishes status when the %s stage fails',
    async (stage, failure, auditAction) => {
      await fc.assert(
        fc.asyncProperty(applicationArbitrary, async (generatedApplication) => {
          application = generatedApplication;
          events.length = 0;
          applicationUpdates.length = 0;
          auditMock.record.mockClear();
          mqttMock.publish.mockClear();
          spatialMock.verifySpatial.mockClear();
          oracleMock.verify.mockClear();

          if (stage === 'spatial') {
            spatialMock.verifySpatial.mockResolvedValue(failure);
          } else {
            oracleMock.verify.mockResolvedValue(failure);
          }

          await pipeline.run(generatedApplication.id);

          const rejectionAudit = auditMock.record.mock.calls.find(
            ([entry]) => entry.action === auditAction,
          );
          expect(rejectionAudit?.[0]).toEqual(
            expect.objectContaining({
              entityId: generatedApplication.id,
              action: auditAction,
              outcome: 'REJECTED',
              metadata: { reason: expect.any(String) },
            }),
          );
          expect(applicationUpdates).toEqual([
            expect.objectContaining({ status: 'rejected' }),
          ]);
          expect(mqttMock.publish).toHaveBeenCalledWith(
            'land/registration/status',
            expect.objectContaining({
              applicationId: generatedApplication.id,
              status: 'rejected',
            }),
            1,
          );
          expect(spatialMock.persistVerifiedParcel).not.toHaveBeenCalled();
          if (stage === 'spatial') {
            expect(oracleMock.verify).not.toHaveBeenCalled();
          }
          expect(blockchainMock.mintTitle).not.toHaveBeenCalled();
        }),
        { numRuns: 20 },
      );
    },
  );

  it('rejects an in-review application through the pipeline service and publishes status', async () => {
    application.status = 'in_review';
    events.length = 0;
    applicationUpdates.length = 0;
    auditMock.record.mockClear();
    mqttMock.publish.mockClear();

    await pipeline.rejectApplication(application.id, registrarId, 'Incomplete documentation');

    expect(applicationUpdates).toEqual([
      expect.objectContaining({ status: 'rejected' }),
    ]);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: application.id,
        actorId: registrarId,
        action: 'REGISTRAR_REJECTION',
        outcome: 'REJECTED',
        metadata: { reason: 'Incomplete documentation' },
      }),
    );
    expect(mqttMock.publish).toHaveBeenCalledWith(
      'land/registration/status',
      expect.objectContaining({
        applicationId: application.id,
        status: 'rejected',
      }),
      1,
    );
  });

  it('parks legal-hold applications without rejecting or minting a title', async () => {
    oracleMock.verify.mockResolvedValue({
      outcome: 'LegalVerificationPending',
      reason: 'Legal hold is active on this parcel',
    });

    await pipeline.run(application.id);

    expect(applicationUpdates).toEqual([
      expect.objectContaining({ status: 'legal_pending' }),
    ]);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: application.id,
        action: 'LEGAL_VERIFICATION',
        outcome: 'PENDING',
        metadata: { reason: 'Legal hold is active on this parcel' },
      }),
    );
    expect(blockchainMock.mintTitle).not.toHaveBeenCalled();
    expect(mqttMock.publish).toHaveBeenCalledWith(
      'land/registration/status',
      expect.objectContaining({
        applicationId: application.id,
        status: 'legal_pending',
      }),
      1,
    );
  });

  it('creates all post-completion records for generated applications', async () => {
    await fc.assert(
      fc.asyncProperty(applicationArbitrary, async (generatedApplication) => {
        application = generatedApplication;
        events.length = 0;
        insertedTitles.length = 0;
        applicationUpdates.length = 0;
        parcelUpdates.length = 0;
        auditMock.record.mockClear();
        mqttMock.publish.mockClear();

        await pipeline.run(generatedApplication.id);
        await pipeline.completeAfterRegistrarApproval(generatedApplication.id, registrarId);

        expect(insertedTitles).toEqual([
          expect.objectContaining({
            application_id: generatedApplication.id,
            token_id: '99',
            owner_id: generatedApplication.citizen_id,
            parcel_id: 'parcel-uuid-001',
            tx_hash: '0xmint-hash',
          }),
        ]);
        expect(blockchainMock.mintTitle).toHaveBeenCalledWith(
          generatedApplication.owner_wallet_address,
          generatedApplication.parcel_ref,
          'SRID=4326;POLYGON((3 6, 4 6, 4 7, 3 6))',
          generatedApplication.title_metadata_uri ?? 'ipfs://pending',
        );
        expect(parcelUpdates).toEqual([
          { token_id: '99', status: 'registered' },
        ]);
        expect(mqttMock.publish).toHaveBeenCalledWith(
          'land/title/issued',
          expect.objectContaining({
            tokenId: '99',
            owner: generatedApplication.owner_wallet_address,
            parcelId: 'parcel-uuid-001',
            timestamp: expect.any(String),
          }),
          1,
        );
        expect(applicationUpdates.map(({ status }) => status)).toEqual([
          'in_review',
          'completed',
        ]);
      }),
      { numRuns: 20 },
    );
  });

  it('does not publish completion if title persistence fails', async () => {
    application.status = 'in_review';
    const originalFrom = supabaseMock.raw.from;
    supabaseMock.raw.from = jest.fn((table: string) => {
      const builder = originalFrom(table);
      if (table === 'land_titles') {
        return {
          insert: jest.fn(async () => ({
            error: { message: 'database unavailable' },
          })),
        };
      }
      return builder;
    });

    await expect(
      pipeline.completeAfterRegistrarApproval(applicationId, registrarId),
    ).rejects.toThrow('Failed to insert land title');

    expect(mqttMock.publish).not.toHaveBeenCalledWith(
      'land/title/issued',
      expect.anything(),
      expect.anything(),
    );
    expect(applicationUpdates).toEqual([]);
  });

  it.each(['pending', 'legal_pending', 'approved', 'rejected', 'completed'] as const)(
    'does not approve an application in %s status',
    async (status) => {
      application.status = status;

      await expect(
        pipeline.completeAfterRegistrarApproval(applicationId, registrarId),
      ).rejects.toThrow(`expected in_review`);

      expect(blockchainMock.mintTitle).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REGISTRAR_APPROVAL' }),
      );
    },
  );
});
