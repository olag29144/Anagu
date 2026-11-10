import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RegistrationPipelineService } from '../pipeline/registration-pipeline.service';
import { RequestWithUser } from '../auth/request-with-user.interface';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { ApplicationsController } from './applications.controller';

describe('ApplicationsController.reject', () => {
  const applicationId = 'application-001';
  const registrarRequest = {
    user: { id: 'registrar-001' },
  } as RequestWithUser;
  let controller: ApplicationsController;
  let audit: { record: jest.Mock };
  let updateResult: { data: unknown; error: { message: string } | null };
  let lookupResult: {
    data: { status: string } | null;
    error: { message: string } | null;
  };
  let updateFilters: Array<[string, unknown]>;
  let lookupFilters: Array<[string, unknown]>;

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    updateResult = { data: { id: applicationId }, error: null };
    lookupResult = { data: { status: 'completed' }, error: null };
    updateFilters = [];
    lookupFilters = [];

    const supabase = {
      raw: {
        from: jest.fn((table: string) => {
          if (table !== 'applications') {
            throw new Error(`Unexpected table: ${table}`);
          }

          return {
            update: jest.fn(() => ({
              eq: jest.fn((field: string, value: unknown) => {
                updateFilters.push([field, value]);
                return {
                  eq: jest.fn((nextField: string, nextValue: unknown) => {
                    updateFilters.push([nextField, nextValue]);
                    return {
                      select: jest.fn(() => ({
                        maybeSingle: jest.fn(async () => updateResult),
                      })),
                    };
                  }),
                };
              }),
            })),
            select: jest.fn(() => ({
              eq: jest.fn((field: string, value: unknown) => {
                lookupFilters.push([field, value]);
                return {
                  maybeSingle: jest.fn(async () => lookupResult),
                };
              }),
            })),
          };
        }),
      },
    };

    controller = new ApplicationsController(
      supabase as unknown as SupabaseClientService,
      audit as unknown as AuditService,
      {} as RegistrationPipelineService,
    );
  });

  it('only rejects an in-review application and audits the transition', async () => {
    await expect(
      controller.reject(applicationId, registrarRequest),
    ).resolves.toEqual({ success: true, applicationId });

    expect(updateFilters).toEqual([
      ['id', applicationId],
      ['status', 'in_review'],
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: applicationId,
        actorId: 'registrar-001',
        action: 'REGISTRAR_REJECTION',
        outcome: 'REJECTED',
      }),
    );
  });

  it('returns a conflict if the application is no longer in review', async () => {
    updateResult = { data: null, error: null };

    await expect(
      controller.reject(applicationId, registrarRequest),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('returns not found when no application matches the rejection', async () => {
    updateResult = { data: null, error: null };
    lookupResult = { data: null, error: null };

    await expect(
      controller.reject(applicationId, registrarRequest),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
