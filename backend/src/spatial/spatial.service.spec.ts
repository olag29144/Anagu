import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { SpatialService } from './spatial.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { AuditService } from '../audit/audit.service';

describe('SpatialService', () => {
  let service: SpatialService;
  let supabaseMock: { rpc: jest.Mock };
  let auditMock: { record: jest.Mock };

  const validDto = {
    applicationId: 'app-001',
    parcelRing: {
      coordinates: [
        [3.0, 6.0],
        [4.0, 6.0],
        [4.0, 7.0],
        [3.0, 7.0],
      ] as [number, number][],
    },
  };
  const parcelRingArbitrary = fc.array(
    fc.tuple(
      fc.integer({ min: -180, max: 180 }),
      fc.integer({ min: -90, max: 90 }),
    ),
    { minLength: 3, maxLength: 8 },
  );

  beforeEach(async () => {
    supabaseMock = { rpc: jest.fn() };
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialService,
        { provide: SupabaseClientService, useValue: supabaseMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<SpatialService>(SpatialService);
  });

  // --------------------------------------------------------------------------
  // Constant
  // --------------------------------------------------------------------------

  describe('bufferMetres', () => {
    it('is exactly 0.5', () => {
      expect(service.OVERLAP_BUFFER_METRES).toBe(0.5);
    });
  });

  // --------------------------------------------------------------------------
  // Stage 1 — invalid geometry
  // --------------------------------------------------------------------------

  describe('verifySpatial — invalid geometry', () => {
    beforeEach(() => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: { is_valid: false },
        error: null,
      });
    });

    it('returns rejected_invalid_geometry outcome', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.outcome).toBe('rejected_invalid_geometry');
    });

    it('returns GEOM_INVALID diagnostic code', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.diagnosticCode).toBe('GEOM_INVALID');
    });

    it('records audit entry with REJECTED_INVALID_GEOMETRY outcome', async () => {
      await service.verifySpatial(validDto);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'REJECTED_INVALID_GEOMETRY' }),
      );
    });

    it('bufferMetres is always 0.5', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.bufferMetres).toBe(0.5);
    });

    it('only calls supabase.rpc once (stage 2 is skipped)', async () => {
      await service.verifySpatial(validDto);
      expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    });

    it('rejects a ring with fewer than three coordinates without calling RPC', async () => {
      const result = await service.verifySpatial({
        ...validDto,
        parcelRing: { coordinates: [[3, 6], [4, 6]] },
      });

      expect(result.outcome).toBe('rejected_invalid_geometry');
      expect(result.diagnosticCode).toBe('GEOM_INVALID');
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('audits a ring with fewer than three coordinates', async () => {
      await service.verifySpatial({
        ...validDto,
        parcelRing: { coordinates: [] },
      });

      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'REJECTED_INVALID_GEOMETRY' }),
      );
    });

    it.each([
      {
        name: 'non-finite coordinates',
        coordinates: [[3, 6], [4, Number.NaN], [4, 7]] as [number, number][],
      },
      {
        name: 'coordinates outside WGS 84 ranges',
        coordinates: [[181, 6], [4, 6], [4, 7]] as [number, number][],
      },
      {
        name: 'fewer than three distinct vertices',
        coordinates: [[3, 6], [3, 6], [3, 6]] as [number, number][],
      },
    ])('rejects $name before calling PostGIS', async ({ coordinates }) => {
      const result = await service.verifySpatial({
        ...validDto,
        parcelRing: { coordinates },
      });

      expect(result.outcome).toBe('rejected_invalid_geometry');
      expect(result.diagnosticCode).toBe('GEOM_INVALID');
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'REJECTED_INVALID_GEOMETRY' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // Stage 2 — overlapping parcel
  // --------------------------------------------------------------------------

  describe('verifySpatial — overlapping parcel', () => {
    beforeEach(() => {
      supabaseMock.rpc
        .mockResolvedValueOnce({ data: { is_valid: true }, error: null })
        .mockResolvedValueOnce({
          data: { overlaps: true, conflicting_parcel_id: 'parcel-xyz' },
          error: null,
        });
    });

    it('returns rejected_overlap outcome', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.outcome).toBe('rejected_overlap');
    });

    it('returns PARCEL_OVERLAP diagnostic code', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.diagnosticCode).toBe('PARCEL_OVERLAP');
    });

    it('returns conflicting parcel ID', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.conflictingParcelId).toBe('parcel-xyz');
    });

    it('records audit entry with REJECTED_OVERLAP outcome', async () => {
      await service.verifySpatial(validDto);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'REJECTED_OVERLAP' }),
      );
    });

    it('calls supabase.rpc twice (both stages run)', async () => {
      await service.verifySpatial(validDto);
      expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Approved
  // --------------------------------------------------------------------------

  describe('verifySpatial — approved', () => {
    beforeEach(() => {
      supabaseMock.rpc
        .mockResolvedValueOnce({ data: { is_valid: true }, error: null })
        .mockResolvedValueOnce({
          data: { overlaps: false, conflicting_parcel_id: null },
          error: null,
        });
    });

    it('returns approved outcome', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.outcome).toBe('approved');
    });

    it('does not include a diagnosticCode on approval', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.diagnosticCode).toBeUndefined();
    });

    it('does not include a conflictingParcelId on approval', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.conflictingParcelId).toBeUndefined();
    });

    it('records audit entry with APPROVED outcome', async () => {
      await service.verifySpatial(validDto);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'APPROVED' }),
      );
    });

    it('checkedAt is a valid ISO string', async () => {
      const result = await service.verifySpatial(validDto);
      expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
    });

    it('bufferMetres is 0.5 on approval', async () => {
      const result = await service.verifySpatial(validDto);
      expect(result.bufferMetres).toBe(0.5);
    });
  });

  // --------------------------------------------------------------------------
  // ringToWKT — auto-close an open ring
  // --------------------------------------------------------------------------

  describe('ringToWKT — auto-closes open ring', () => {
    it('returns approved when open ring coordinates are supplied', async () => {
      // validDto coordinates do NOT repeat the first point — service must close them
      supabaseMock.rpc
        .mockResolvedValueOnce({ data: { is_valid: true }, error: null })
        .mockResolvedValueOnce({
          data: { overlaps: false, conflicting_parcel_id: null },
          error: null,
        });
      const result = await service.verifySpatial(validDto);
      expect(result.outcome).toBe('approved');
    });

    it('passes an EWKT string that starts with SRID=4326;POLYGON(( to the RPC', async () => {
      supabaseMock.rpc
        .mockResolvedValueOnce({ data: { is_valid: true }, error: null })
        .mockResolvedValueOnce({
          data: { overlaps: false, conflicting_parcel_id: null },
          error: null,
        });
      await service.verifySpatial(validDto);
      const firstCall = supabaseMock.rpc.mock.calls[0];
      expect(firstCall[0]).toBe('check_geometry_valid');
      expect((firstCall[1] as { wkt: string }).wkt).toMatch(
        /^SRID=4326;POLYGON\(\(/,
      );
    });
  });

  // --------------------------------------------------------------------------
  // RPC error propagation
  // --------------------------------------------------------------------------

  describe('RPC error propagation', () => {
    it('throws when stage-1 RPC returns an error', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'db connection lost' },
      });
      await expect(service.verifySpatial(validDto)).rejects.toThrow(
        'Spatial geometry check failed',
      );
    });

    it('throws when stage-2 RPC returns an error', async () => {
      supabaseMock.rpc
        .mockResolvedValueOnce({ data: { is_valid: true }, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'overlap check timeout' },
        });
      await expect(service.verifySpatial(validDto)).rejects.toThrow(
        'Spatial overlap check failed',
      );
    });
  });

  describe('property invariants', () => {
    it('audits all generated invalid geometries with GEOM_INVALID', async () => {
      await fc.assert(
        fc.asyncProperty(parcelRingArbitrary, async (coordinates) => {
          supabaseMock.rpc
            .mockReset()
            .mockResolvedValueOnce({ data: { is_valid: false }, error: null });
          auditMock.record.mockClear();

          const result = await service.verifySpatial({
            ...validDto,
            parcelRing: { coordinates },
          });

          expect(result.outcome).toBe('rejected_invalid_geometry');
          expect(result.diagnosticCode).toBe('GEOM_INVALID');
          expect(auditMock.record).toHaveBeenCalledTimes(1);
          expect(auditMock.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'REJECTED_INVALID_GEOMETRY' }),
          );
        }),
      );
    });

    it('audits all generated overlaps with PARCEL_OVERLAP and a conflicting parcel ID', async () => {
      await fc.assert(
        fc.asyncProperty(parcelRingArbitrary, async (coordinates) => {
          supabaseMock.rpc
            .mockReset()
            .mockResolvedValueOnce({ data: { is_valid: true }, error: null })
            .mockResolvedValueOnce({
              data: { overlaps: true, conflicting_parcel_id: 'parcel-property-test' },
              error: null,
            });
          auditMock.record.mockClear();

          const result = await service.verifySpatial({
            ...validDto,
            parcelRing: { coordinates },
          });

          expect(result.outcome).toBe('rejected_overlap');
          expect(result.diagnosticCode).toBe('PARCEL_OVERLAP');
          expect(result.conflictingParcelId).toBe('parcel-property-test');
          expect(auditMock.record).toHaveBeenCalledTimes(1);
          expect(auditMock.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'REJECTED_OVERLAP' }),
          );
        }),
      );
    });
  });
});
