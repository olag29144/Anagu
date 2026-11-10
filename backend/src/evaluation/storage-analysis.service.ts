import { BadRequestException, Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';

export interface StorageFields {
  S_id: number;
  S_geom: number;
  S_owner: number;
  S_oracle: number;
  S_time: number;
  S_rev: number;
  S_sig: number;
}

export interface StorageReport {
  tokenId: string;
  owner: string;
  revoked: boolean;
  titleMetadataBytes: number;
  fields: StorageFields;
  perRecordBits: number;
  proposedPerRecordBytes: number;
  baselinePerRecordBytes: number;
  reductionPercentage: number;
  networkStorageProposed: number;
  networkStorageBaseline: number;
  parcels: number;
}

const BASELINE_WKT_SAMPLES = [
  'POLYGON((3 6, 3.001 6, 3.001 6.001, 3 6.001, 3 6))',
  'POLYGON((7.4 9.1, 7.402 9.1, 7.402 9.102, 7.4 9.102, 7.4 9.1))',
  'POLYGON((5.1 6.5, 5.103 6.5, 5.103 6.503, 5.1 6.503, 5.1 6.5))',
  'POLYGON((8 10, 8.004 10, 8.004 10.003, 8 10.003, 8 10))',
  'POLYGON((4.8 7.2, 4.802 7.2, 4.802 7.202, 4.8 7.202, 4.8 7.2))',
  'POLYGON((6.2 8.1, 6.205 8.1, 6.205 8.104, 6.2 8.104, 6.2 8.1))',
  'POLYGON((9.3 11.4, 9.306 11.4, 9.306 11.405, 9.3 11.405, 9.3 11.4))',
  'POLYGON((2.9 5.4, 2.903 5.4, 2.903 5.403, 2.9 5.403, 2.9 5.4))',
  'POLYGON((10.1 12.2, 10.108 12.2, 10.108 12.206, 10.1 12.206, 10.1 12.2))',
  'POLYGON((3.7 4.6, 3.704 4.6, 3.704 4.604, 3.7 4.604, 3.7 4.6))',
];

@Injectable()
export class StorageAnalysisService {
  constructor(private readonly blockchain: BlockchainService) {}

  async measureOnChainFields(tokenId: bigint): Promise<{
    fields: StorageFields;
    owner: string;
    revoked: boolean;
    titleMetadataBytes: number;
  }> {
    if (tokenId <= 0n) {
      throw new BadRequestException('tokenId must be a positive integer');
    }

    const [metadata, owner, revoked] = await Promise.all([
      this.blockchain.getTitleMetadata(tokenId),
      this.blockchain.ownerOf(tokenId),
      this.blockchain.isRevoked(tokenId),
    ]);

    if (typeof metadata.titleMetadata !== 'string') {
      throw new Error(`Token ${tokenId} returned invalid title metadata`);
    }

    const titleMetadataBytes = Buffer.byteLength(metadata.titleMetadata, 'utf8');
    const fields: StorageFields = {
      S_id: 256,
      S_geom: 256,
      S_owner: 160,
      S_oracle: titleMetadataBytes * 8,
      S_time: 0,
      S_rev: 8,
      S_sig: 256,
    };

    return { fields, owner, revoked, titleMetadataBytes };
  }

  computePerRecordBytes(fields: StorageFields): number {
    const totalBits = Object.values(fields).reduce((sum, bits) => sum + bits, 0);
    return Math.ceil(totalBits / 8);
  }

  computeBaselineStoragePerRecord(): number {
    const meanWktBytes =
      BASELINE_WKT_SAMPLES.reduce(
        (sum, wkt) => sum + Buffer.byteLength(wkt, 'utf8'),
        0,
      ) / BASELINE_WKT_SAMPLES.length;
    const ownerBytes = 20;
    const timestampBytes = 32;
    const idBytes = 32;
    return Math.ceil(meanWktBytes) + ownerBytes + timestampBytes + idBytes;
  }

  computeReductionPercentage(proposed: number, baseline: number): number {
    if (!Number.isFinite(proposed) || !Number.isFinite(baseline) || baseline <= 0) {
      return 0;
    }

    const reduction = ((baseline - proposed) / baseline) * 100;
    return Math.min(100, Math.max(0, Number(reduction.toFixed(2))));
  }

  computeNetworkStorage(perRecordBytes: number, parcels: number): number {
    if (!Number.isFinite(perRecordBytes) || !Number.isFinite(parcels) || parcels <= 0) {
      return 0;
    }
    return perRecordBytes * parcels;
  }

  async getFullReport(
    tokenId: bigint,
    parcels = 1000,
  ): Promise<StorageReport> {
    if (!Number.isInteger(parcels) || parcels <= 0) {
      throw new BadRequestException('parcels must be a positive integer');
    }

    const measured = await this.measureOnChainFields(tokenId);
    const perRecordBits = Object.values(measured.fields).reduce(
      (sum, bits) => sum + bits,
      0,
    );
    const proposedPerRecordBytes = this.computePerRecordBytes(measured.fields);
    const baselinePerRecordBytes = this.computeBaselineStoragePerRecord();

    return {
      tokenId: tokenId.toString(),
      owner: measured.owner,
      revoked: measured.revoked,
      titleMetadataBytes: measured.titleMetadataBytes,
      fields: measured.fields,
      perRecordBits,
      proposedPerRecordBytes,
      baselinePerRecordBytes,
      reductionPercentage: this.computeReductionPercentage(
        proposedPerRecordBytes,
        baselinePerRecordBytes,
      ),
      networkStorageProposed: this.computeNetworkStorage(
        proposedPerRecordBytes,
        parcels,
      ),
      networkStorageBaseline: this.computeNetworkStorage(
        baselinePerRecordBytes,
        parcels,
      ),
      parcels,
    };
  }
}
