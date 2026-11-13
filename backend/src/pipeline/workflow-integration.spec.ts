import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { MqttService } from '../mqtt/mqtt.service';
import { OracleService } from '../oracle/oracle.service';
import { SpatialService } from '../spatial/spatial.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { ROLES_KEY, UserRole } from '../auth/roles';
import { RolesGuard } from '../auth/roles.guard';
import { RegistrationPipelineService } from './registration-pipeline.service';
import { ApplicationRecord } from './pipeline.types';

describe('Integration — Unified Registration Workflow, Cancellation, Audit Trail & 5-Role RBAC', () => {
  it('executes completed, rejected, cancelled, and still-processing workflows end-to-end', async () => {
    const apps = new Map<string, ApplicationRecord>();
    const parcels = new Map<string, { id: string; application_id: string; token_id?: string; status: string }>();
    const titles: Array<Record<string, unknown>> = [];
    const auditLogs: Array<{ entityId: string; actorId?: string; action: string; outcome: string; metadata?: Record<string, unknown> }> = [];
    const mqttMessages: Array<{ topic: string; payload: Record<string, unknown>; qos: number }> = [];

    const seedApp = (
      id: string,
      citizenId: string,
      spatialOutcome: 'approved' | 'rejected_overlap' | 'rejected_invalid_geometry' = 'approved',
      oracleOutcome: 'SuccessfullyVerified' | 'OwnershipConflict' | 'LegalVerificationPending' = 'SuccessfullyVerified',
    ): ApplicationRecord => {
      const app: ApplicationRecord = {
        id,
        citizen_id: citizenId,
        owner_name: `Owner ${id}`,
        owner_wallet_address: '0x0000000000000000000000000000000000000001',
        document_number: `DOC-${id}`,
        document_type: 'Certificate',
        issuing_authority: 'AGIS',
        parcel_ref: `PARCEL-${id}`,
        spatial_hash: null,
        title_metadata_uri: `ipfs://${id}`,
        status: 'pending',
        parcel_ring: { coordinates: [[7.4, 9.0], [7.5, 9.0], [7.5, 9.1], [7.4, 9.1]] },
      };
      apps.set(id, app);
      outcomePlan.set(id, { spatialOutcome, oracleOutcome });
      return app;
    };

    const outcomePlan = new Map<
      string,
      {
        spatialOutcome: 'approved' | 'rejected_overlap' | 'rejected_invalid_geometry';
        oracleOutcome: 'SuccessfullyVerified' | 'OwnershipConflict' | 'LegalVerificationPending';
      }
    >();

    let nextTokenId = 1n;

    const spatialMock = {
      verifySpatial: jest.fn(async ({ applicationId }: { applicationId: string }) => {
        const plan = outcomePlan.get(applicationId)!;
        await auditMock.record({
          entityId: applicationId,
          action: 'SPATIAL_VERIFICATION',
          outcome: plan.spatialOutcome === 'approved' ? 'APPROVED' : 'REJECTED',
        });
        return {
          outcome: plan.spatialOutcome,
          diagnosticCode: plan.spatialOutcome === 'approved' ? undefined : 'PARCEL_OVERLAP',
          bufferMetres: 0.5,
          checkedAt: new Date().toISOString(),
        };
      }),
      persistVerifiedParcel: jest.fn(async (applicationId: string) => {
        const parcelId = `parcel-${applicationId}`;
        parcels.set(applicationId, { id: parcelId, application_id: applicationId, status: 'verified' });
        return parcelId;
      }),
      ringToWKT: jest.fn(() => 'SRID=4326;POLYGON((7.4 9, 7.5 9, 7.5 9.1, 7.4 9.1, 7.4 9))'),
    };

    const oracleMock = {
      verify: jest.fn(async ({ applicationId }: { applicationId: string }) => {
        const plan = outcomePlan.get(applicationId)!;
        await auditMock.record({
          entityId: applicationId,
          action: 'ORACLE_VERIFICATION',
          outcome: plan.oracleOutcome,
        });
        return { outcome: plan.oracleOutcome };
      }),
    };

    const blockchainMock = {
      mintTitle: jest.fn(async () => {
        const tokenId = nextTokenId;
        nextTokenId += 1n;
        return { tokenId, txHash: `0xtx-${tokenId.toString()}` };
      }),
    };

    const mqttMock = {
      publish: jest.fn(async (topic: string, payload: Record<string, unknown>, qos: number) => {
        mqttMessages.push({ topic, payload, qos });
      }),
    };

    const auditMock = {
      record: jest.fn(async (entry) => {
        auditLogs.push(entry);
      }),
    };

    const supabaseMock = {
      raw: {
        from: jest.fn((table: string) => {
          if (table === 'applications') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn((_col: string, id: string) => ({
                  single: jest.fn(async () => ({
                    data: apps.get(id) ?? null,
                    error: apps.has(id) ? null : { message: 'Not found' },
                  })),
                })),
              })),
              update: jest.fn((values: Record<string, unknown>) => ({
                eq: jest.fn(async (_col: string, id: string) => {
                  const row = apps.get(id);
                  if (row) row.status = values.status as ApplicationRecord['status'];
                  return { error: null };
                }),
              })),
            };
          }

          if (table === 'parcels') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn((_col: string, appId: string) => ({
                  single: jest.fn(async () => ({
                    data: parcels.get(appId) ?? null,
                    error: parcels.has(appId) ? null : { message: 'Parcel missing' },
                  })),
                })),
              })),
              update: jest.fn((values: Record<string, unknown>) => ({
                eq: jest.fn(async (_col: string, parcelId: string) => {
                  for (const parcel of parcels.values()) {
                    if (parcel.id === parcelId) {
                      parcel.token_id = values.token_id as string;
                      parcel.status = values.status as string;
                    }
                  }
                  return { error: null };
                }),
              })),
            };
          }

          if (table === 'land_titles') {
            return {
              insert: jest.fn(async (row: Record<string, unknown>) => {
                titles.push(row);
                return { error: null };
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
      },
    };

    const pipeline = new RegistrationPipelineService(
      spatialMock as unknown as SpatialService,
      oracleMock as unknown as OracleService,
      blockchainMock as unknown as BlockchainService,
      mqttMock as unknown as MqttService,
      auditMock as unknown as AuditService,
      supabaseMock as unknown as SupabaseClientService,
    );

    // 1. Completed (4 applications approved end-to-end)
    for (let i = 0; i < 4; i++) {
      const id = `app-completed-${i}`;
      seedApp(id, `citizen-${i}`, 'approved', 'SuccessfullyVerified');
      await pipeline.run(id);
      await pipeline.completeAfterRegistrarApproval(id, 'registrar-001');
    }

    // 2. Rejected (2 spatial/oracle auto-rejections + 1 registrar rejection)
    seedApp('app-rejected-spatial', 'citizen-10', 'rejected_overlap', 'SuccessfullyVerified');
    await pipeline.run('app-rejected-spatial');

    seedApp('app-rejected-oracle', 'citizen-11', 'approved', 'OwnershipConflict');
    await pipeline.run('app-rejected-oracle');

    seedApp('app-rejected-registrar', 'citizen-12', 'approved', 'SuccessfullyVerified');
    await pipeline.run('app-rejected-registrar');
    await pipeline.rejectApplication('app-rejected-registrar', 'registrar-001', 'Insufficient deed');

    // 3. Cancelled by applicant (2 applications)
    seedApp('app-cancelled-1', 'citizen-20', 'approved', 'SuccessfullyVerified');
    await pipeline.run('app-cancelled-1');
    await pipeline.cancelApplication('app-cancelled-1', 'citizen-20');

    seedApp('app-cancelled-2', 'citizen-21', 'approved', 'LegalVerificationPending');
    await pipeline.run('app-cancelled-2');
    await pipeline.cancelApplication('app-cancelled-2', 'citizen-21');

    // Non-owner cancellation must be blocked
    await expect(pipeline.cancelApplication('app-completed-0', 'intruder-99')).rejects.toThrow(
      ForbiddenException,
    );

    // 4. Still processing (1 in_review + 1 legal_pending)
    seedApp('app-processing-review', 'citizen-30', 'approved', 'SuccessfullyVerified');
    await pipeline.run('app-processing-review');

    seedApp('app-processing-legal', 'citizen-31', 'approved', 'LegalVerificationPending');
    await pipeline.run('app-processing-legal');

    // Tally workflow outcomes
    const counts = {
      completed: 0,
      rejected: 0,
      cancelled: 0,
      stillProcessing: 0,
    };

    for (const app of apps.values()) {
      if (app.status === 'completed') counts.completed += 1;
      else if (app.status === 'rejected') counts.rejected += 1;
      else if (app.status === 'cancelled') counts.cancelled += 1;
      else counts.stillProcessing += 1;
    }

    const total = apps.size;
    console.info('\n[Integration — End-to-End Application Processing Outcomes]');
    console.table([
      { Outcome: 'Completed', Frequency: counts.completed, Percentage: `${((counts.completed / total) * 100).toFixed(1)}%` },
      { Outcome: 'Rejected', Frequency: counts.rejected, Percentage: `${((counts.rejected / total) * 100).toFixed(1)}%` },
      { Outcome: 'Cancelled by applicant', Frequency: counts.cancelled, Percentage: `${((counts.cancelled / total) * 100).toFixed(1)}%` },
      { Outcome: 'Still processing', Frequency: counts.stillProcessing, Percentage: `${((counts.stillProcessing / total) * 100).toFixed(1)}%` },
      { Outcome: 'Total', Frequency: total, Percentage: '100.0%' },
    ]);

    expect(total).toBe(11);
    expect(counts).toEqual({
      completed: 4,
      rejected: 3,
      cancelled: 2,
      stillProcessing: 2,
    });
    expect(titles).toHaveLength(4);
    expect(auditLogs.filter((l) => l.entityId === 'app-completed-0').map((l) => l.action)).toEqual([
      'SPATIAL_VERIFICATION',
      'ORACLE_VERIFICATION',
      'APPLICATION_STATUS_TRANSITION',
      'REGISTRAR_APPROVAL',
      'BLOCKCHAIN_REGISTRATION',
      'NFT_ISSUANCE',
      'MQTT_NOTIFICATION',
      'APPLICATION_STATUS_TRANSITION',
    ]);
    expect(mqttMessages.some((m) => m.payload.status === 'cancelled')).toBe(true);
  });

  it('enforces 5-role RBAC permissions across citizen, surveyor, registrar, land_admin, and governor', async () => {
    const reflector = new Reflector();
    const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    const guard = new RolesGuard(reflector, auditMock as unknown as AuditService);

    const checkRole = async (allowedRoles: UserRole[], actorRole: UserRole) => {
      const handler = () => undefined;
      Reflect.defineMetadata(ROLES_KEY, allowedRoles, handler);
      const ctx = {
        getHandler: () => handler,
        getClass: () => class DummyController {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: `${actorRole}-01`, role: actorRole },
            url: '/protected',
            method: 'POST',
          }),
        }),
      } as unknown as ExecutionContext;
      return guard.canActivate(ctx);
    };

    expect(await checkRole([UserRole.CITIZEN], UserRole.CITIZEN)).toBe(true);
    await expect(checkRole([UserRole.CITIZEN], UserRole.SURVEYOR)).rejects.toThrow(ForbiddenException);

    expect(await checkRole([UserRole.SURVEYOR], UserRole.SURVEYOR)).toBe(true);
    await expect(checkRole([UserRole.SURVEYOR], UserRole.CITIZEN)).rejects.toThrow(ForbiddenException);

    expect(await checkRole([UserRole.REGISTRAR], UserRole.REGISTRAR)).toBe(true);
    await expect(checkRole([UserRole.REGISTRAR], UserRole.GOVERNOR)).rejects.toThrow(ForbiddenException);

    expect(await checkRole([UserRole.LAND_ADMIN], UserRole.LAND_ADMIN)).toBe(true);
    await expect(checkRole([UserRole.LAND_ADMIN], UserRole.REGISTRAR)).rejects.toThrow(ForbiddenException);

    expect(await checkRole([UserRole.GOVERNOR], UserRole.GOVERNOR)).toBe(true);
    await expect(checkRole([UserRole.GOVERNOR], UserRole.LAND_ADMIN)).rejects.toThrow(ForbiddenException);
  });
});
