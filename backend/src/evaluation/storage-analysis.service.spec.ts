import { BadRequestException } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { StorageAnalysisService } from './storage-analysis.service';

describe('StorageAnalysisService', () => {
  const metadata = {
    parcelRef: 'ABUJA/2026/001',
    mintTxHash: `0x${'a'.repeat(64)}`,
    spatialHash: `0x${'b'.repeat(64)}`,
    titleMetadata: 'ipfs://QmExampleMetadata',
  };
  let blockchain: {
    getTitleMetadata: jest.Mock;
    ownerOf: jest.Mock;
    isRevoked: jest.Mock;
  };
  let service: StorageAnalysisService;

  beforeEach(() => {
    blockchain = {
      getTitleMetadata: jest.fn().mockResolvedValue(metadata),
      ownerOf: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000001'),
      isRevoked: jest.fn().mockResolvedValue(false),
    };
    service = new StorageAnalysisService(
      blockchain as unknown as BlockchainService,
    );
  });

  describe('measureOnChainFields', () => {
    it('reads metadata, owner, and revocation state for the requested token', async () => {
      const result = await service.measureOnChainFields(7n);

      expect(blockchain.getTitleMetadata).toHaveBeenCalledWith(7n);
      expect(blockchain.ownerOf).toHaveBeenCalledWith(7n);
      expect(blockchain.isRevoked).toHaveBeenCalledWith(7n);
      expect(result).toMatchObject({
        owner: '0x0000000000000000000000000000000000000001',
        revoked: false,
        titleMetadataBytes: Buffer.byteLength(metadata.titleMetadata, 'utf8'),
        fields: {
          S_id: 256,
          S_geom: 256,
          S_owner: 160,
          S_oracle: Buffer.byteLength(metadata.titleMetadata, 'utf8') * 8,
          S_time: 0,
          S_rev: 8,
          S_sig: 256,
          S_merkle: 0,
        },
      });
    });

    it('reports timestamp as not stored by the contract', async () => {
      const { fields } = await service.measureOnChainFields(7n);
      expect(fields.S_time).toBe(0);
    });

    it('rejects non-positive token ids', async () => {
      await expect(service.measureOnChainFields(0n)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(blockchain.getTitleMetadata).not.toHaveBeenCalled();
    });
  });

  describe('computePerRecordBytes', () => {
    it('sums measured field widths and rounds up partial bytes', () => {
      expect(
        service.computePerRecordBytes({
          S_id: 1,
          S_geom: 1,
          S_owner: 1,
          S_oracle: 1,
          S_time: 1,
          S_rev: 1,
          S_sig: 1,
          S_merkle: 1,
        }),
      ).toBe(1);
    });
  });

  describe('computeBaselineStoragePerRecord', () => {
    it('averages ten representative WKT strings and adds fixed fields', () => {
      const baseline = service.computeBaselineStoragePerRecord();
      expect(Number.isInteger(baseline)).toBe(true);
      expect(baseline).toBe(146);
    });
  });

  describe('computeReductionPercentage', () => {
    it('matches the formula and remains within the documented range', () => {
      const result = service.computeReductionPercentage(100, 284);
      expect(result).toBe(64.79);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('returns 0 for invalid baselines or non-finite values', () => {
      expect(service.computeReductionPercentage(100, 0)).toBe(0);
      expect(service.computeReductionPercentage(Number.NaN, 200)).toBe(0);
      expect(
        service.computeReductionPercentage(100, Number.POSITIVE_INFINITY),
      ).toBe(0);
    });
  });

  describe('computeNetworkStorage', () => {
    it('multiplies per-record bytes by parcel count', () => {
      expect(service.computeNetworkStorage(200, 500)).toBe(100_000);
    });

    it('returns zero for invalid inputs', () => {
      expect(service.computeNetworkStorage(200, 0)).toBe(0);
      expect(service.computeNetworkStorage(200, -1)).toBe(0);
      expect(service.computeNetworkStorage(Number.NaN, 5)).toBe(0);
    });
  });

  describe('getFullReport', () => {
    it('returns a report based on the on-chain token data', async () => {
      const report = await service.getFullReport(7n, 500);

      expect(report.tokenId).toBe('7');
      expect(report.parcels).toBe(500);
      expect(report.titleMetadataBytes).toBe(
        Buffer.byteLength(metadata.titleMetadata, 'utf8'),
      );
      expect(report.perRecordBits).toBe(
        Object.values(report.fields).reduce((sum, bits) => sum + bits, 0),
      );
      expect(report.proposedPerRecordBytes).toBe(
        Math.ceil(report.perRecordBits / 8),
      );
      expect(report.networkStorageProposed).toBe(
        report.proposedPerRecordBytes * 500,
      );
      expect(report.networkStorageBaseline).toBe(
        report.baselinePerRecordBytes * 500,
      );
    });

    it('defaults the network projection to 1000 parcels', async () => {
      expect((await service.getFullReport(7n)).parcels).toBe(1000);
    });

    it('rejects invalid parcel counts', async () => {
      await expect(service.getFullReport(7n, 0)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
