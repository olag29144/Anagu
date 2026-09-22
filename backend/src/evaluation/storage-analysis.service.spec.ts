import { StorageAnalysisService } from './storage-analysis.service';

describe('StorageAnalysisService', () => {
  let service: StorageAnalysisService;

  beforeEach(() => {
    service = new StorageAnalysisService();
  });

  // --------------------------------------------------------------------------
  // measureOnChainFields
  // --------------------------------------------------------------------------

  describe('measureOnChainFields', () => {
    it('returns exactly 7 fields', () => {
      const fields = service.measureOnChainFields();
      expect(Object.keys(fields).length).toBe(7);
    });

    it('S_owner is 160 bits (Ethereum address)', () => {
      expect(service.measureOnChainFields().S_owner).toBe(160);
    });

    it('S_id is 256 bits (uint256)', () => {
      expect(service.measureOnChainFields().S_id).toBe(256);
    });

    it('S_geom is 256 bits (bytes32 keccak256)', () => {
      expect(service.measureOnChainFields().S_geom).toBe(256);
    });

    it('S_oracle is 256 bits (IPFS CID)', () => {
      expect(service.measureOnChainFields().S_oracle).toBe(256);
    });

    it('S_time is 256 bits (uint256 timestamp)', () => {
      expect(service.measureOnChainFields().S_time).toBe(256);
    });

    it('S_rev is 8 bits (bool)', () => {
      expect(service.measureOnChainFields().S_rev).toBe(8);
    });

    it('S_sig is 256 bits (bytes32 mintTxHash)', () => {
      expect(service.measureOnChainFields().S_sig).toBe(256);
    });

    it('total bit sum is 1448', () => {
      const fields = service.measureOnChainFields();
      const total = Object.values(fields).reduce((a, b) => a + b, 0);
      expect(total).toBe(1448);
    });
  });

  // --------------------------------------------------------------------------
  // computePerRecordBytes
  // --------------------------------------------------------------------------

  describe('computePerRecordBytes', () => {
    it('returns a positive integer', () => {
      const bytes = service.computePerRecordBytes();
      expect(bytes).toBeGreaterThan(0);
      expect(Number.isInteger(bytes)).toBe(true);
    });

    it('equals 181 bytes (1448 bits / 8, ceiling)', () => {
      // 1448 / 8 = 181 exactly
      expect(service.computePerRecordBytes()).toBe(181);
    });
  });

  // --------------------------------------------------------------------------
  // computeBaselineStoragePerRecord
  // --------------------------------------------------------------------------

  describe('computeBaselineStoragePerRecord', () => {
    it('returns a positive integer', () => {
      const bytes = service.computeBaselineStoragePerRecord();
      expect(bytes).toBeGreaterThan(0);
      expect(Number.isInteger(bytes)).toBe(true);
    });

    it('equals 284 bytes (200 WKT + 20 owner + 32 timestamp + 32 ID)', () => {
      expect(service.computeBaselineStoragePerRecord()).toBe(284);
    });
  });

  // --------------------------------------------------------------------------
  // computeReductionPercentage
  // --------------------------------------------------------------------------

  describe('computeReductionPercentage', () => {
    it('is between 0 and 100 for proposed vs baseline', () => {
      const proposed = service.computePerRecordBytes();
      const baseline = service.computeBaselineStoragePerRecord();
      const reduction = service.computeReductionPercentage(proposed, baseline);
      expect(reduction).toBeGreaterThanOrEqual(0);
      expect(reduction).toBeLessThanOrEqual(100);
    });

    it('returns 0 when baseline is 0 (avoids division-by-zero)', () => {
      expect(service.computeReductionPercentage(100, 0)).toBe(0);
    });

    it('returns 0 when proposed equals baseline (no reduction)', () => {
      expect(service.computeReductionPercentage(100, 100)).toBe(0);
    });

    it('returns 50 when proposed is half of baseline', () => {
      expect(service.computeReductionPercentage(50, 100)).toBe(50);
    });

    it('returns 100 when proposed is 0', () => {
      expect(service.computeReductionPercentage(0, 200)).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // computeNetworkStorage
  // --------------------------------------------------------------------------

  describe('computeNetworkStorage', () => {
    it('multiplies perRecordBytes by parcel count correctly', () => {
      expect(service.computeNetworkStorage(200, 500)).toBe(100_000);
    });

    it('returns 0 when parcel count is 0', () => {
      expect(service.computeNetworkStorage(200, 0)).toBe(0);
    });

    it('returns perRecordBytes when parcel count is 1', () => {
      expect(service.computeNetworkStorage(181, 1)).toBe(181);
    });
  });

  // --------------------------------------------------------------------------
  // Cross-checks
  // --------------------------------------------------------------------------

  describe('proposed vs baseline size comparison', () => {
    it('proposed per-record size is less than baseline', () => {
      expect(service.computePerRecordBytes()).toBeLessThan(
        service.computeBaselineStoragePerRecord(),
      );
    });

    it('reduction percentage is positive (proposed < baseline)', () => {
      const proposed = service.computePerRecordBytes();
      const baseline = service.computeBaselineStoragePerRecord();
      expect(service.computeReductionPercentage(proposed, baseline)).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // getFullReport smoke-test
  // --------------------------------------------------------------------------

  describe('getFullReport', () => {
    it('uses 1000 parcels by default', () => {
      const report = service.getFullReport();
      expect(report.parcels).toBe(1000);
    });

    it('networkStorageProposed equals computePerRecordBytes × 1000', () => {
      const report = service.getFullReport();
      expect(report.networkStorageProposed).toBe(
        service.computePerRecordBytes() * 1000,
      );
    });

    it('networkStorageBaseline equals computeBaselineStoragePerRecord × 1000', () => {
      const report = service.getFullReport();
      expect(report.networkStorageBaseline).toBe(
        service.computeBaselineStoragePerRecord() * 1000,
      );
    });

    it('reductionPercentage matches manual computation', () => {
      const proposed = service.computePerRecordBytes();
      const baseline = service.computeBaselineStoragePerRecord();
      const expected = service.computeReductionPercentage(proposed, baseline);
      expect(service.getFullReport().reductionPercentage).toBe(expected);
    });

    it('accepts a custom parcel count', () => {
      const report = service.getFullReport(5000);
      expect(report.parcels).toBe(5000);
      expect(report.networkStorageProposed).toBe(
        service.computePerRecordBytes() * 5000,
      );
    });
  });
});
