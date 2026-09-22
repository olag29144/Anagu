import { Injectable } from '@nestjs/common';

export interface StorageFields {
  /** uint256 tokenId — 256 bits */
  S_id: number;
  /** bytes32 keccak256(WKT) — 256 bits */
  S_geom: number;
  /** Ethereum address — 160 bits */
  S_owner: number;
  /** IPFS CID in titleMetadata string (~32 bytes = 256 bits) */
  S_oracle: number;
  /** uint256 block.timestamp — 256 bits */
  S_time: number;
  /** bool isRevoked — 8 bits */
  S_rev: number;
  /** bytes32 mintTxHash — 256 bits */
  S_sig: number;
}

export interface StorageReport {
  fields: StorageFields;
  perRecordBits: number;
  proposedPerRecordBytes: number;
  baselinePerRecordBytes: number;
  reductionPercentage: number;
  networkStorageProposed: number;
  networkStorageBaseline: number;
  parcels: number;
}

/**
 * StorageAnalysisService — measures the on-chain storage footprint of a land title
 * record and computes the reduction over a conventional (naive) baseline.
 *
 * On-chain fields (from design.md — Component 10 / on-chain storage fields table):
 *   S_id    uint256   tokenId                  256 bits
 *   S_geom  bytes32   keccak256 of WKT         256 bits
 *   S_owner address   NFT holder               160 bits
 *   S_oracle string   IPFS CID (~32 B)         256 bits
 *   S_time  uint256   block.timestamp          256 bits
 *   S_rev   bool      isRevoked                  8 bits
 *   S_sig   bytes32   mintTxHash               256 bits
 *   ─────────────────────────────────────────────────────
 *   Total fixed fields                       1,448 bits = 181 bytes
 *
 * Baseline design stores the full WKT geometry string on-chain (~200 chars) plus
 * an owner address (20 bytes) + timestamp (32 bytes) + ID (32 bytes) = 284 bytes.
 *
 * Requirements: 10.4, 10.5
 */
@Injectable()
export class StorageAnalysisService {
  /**
   * Return the bit length of each of the seven defined on-chain storage fields.
   * Requirements: 10.4
   */
  measureOnChainFields(): StorageFields {
    return {
      S_id: 256,    // uint256 tokenId
      S_geom: 256,  // bytes32 spatialHash (keccak256 of WKT geometry)
      S_owner: 160, // address (20 bytes — Ethereum address)
      S_oracle: 256, // IPFS CID stored as string in titleMetadata (~32 bytes = 256 bits)
      S_time: 256,  // uint256 block.timestamp
      S_rev: 8,     // bool isRevoked (1 byte)
      S_sig: 256,   // bytes32 mintTxHash
    };
  }

  /**
   * Sum all field bit lengths and convert to bytes (ceiling).
   * Requirements: 10.4
   */
  computePerRecordBytes(): number {
    const fields = this.measureOnChainFields();
    const totalBits = Object.values(fields).reduce((a, b) => a + b, 0);
    return Math.ceil(totalBits / 8);
  }

  /**
   * Estimate per-record storage for the naive conventional baseline design that
   * stores the full WKT geometry string on-chain (~200 characters) plus an
   * owner address (20 bytes), a timestamp (32 bytes), and an ID (32 bytes).
   * Returns a size in bytes.
   *
   * Requirements: 10.5
   */
  computeBaselineStoragePerRecord(): number {
    const wktChars = 200;   // representative WKT polygon string length
    const ownerBytes = 20;  // Ethereum address
    const timestampBytes = 32;
    const idBytes = 32;
    return wktChars + ownerBytes + timestampBytes + idBytes; // 284 bytes
  }

  /**
   * Compute percentage reduction: ((baseline - proposed) / baseline) * 100.
   * Returns 0 when baseline is 0 to avoid division-by-zero.
   *
   * Requirements: 10.5
   */
  computeReductionPercentage(proposed: number, baseline: number): number {
    if (baseline === 0) return 0;
    return parseFloat((((baseline - proposed) / baseline) * 100).toFixed(2));
  }

  /**
   * Total network storage for a given number of parcel records.
   */
  computeNetworkStorage(perRecordBytes: number, parcels: number): number {
    return perRecordBytes * parcels;
  }

  /**
   * Produce a complete storage analysis report.
   *
   * @param parcels - Number of parcel records used for network-wide projections (default 1000).
   * Requirements: 10.4, 10.5
   */
  getFullReport(parcels = 1000): StorageReport {
    const fields = this.measureOnChainFields();
    const perRecordBits = Object.values(fields).reduce((a, b) => a + b, 0);
    const proposed = this.computePerRecordBytes();
    const baseline = this.computeBaselineStoragePerRecord();
    const reduction = this.computeReductionPercentage(proposed, baseline);

    return {
      fields,
      perRecordBits,
      proposedPerRecordBytes: proposed,
      baselinePerRecordBytes: baseline,
      reductionPercentage: reduction,
      networkStorageProposed: this.computeNetworkStorage(proposed, parcels),
      networkStorageBaseline: this.computeNetworkStorage(baseline, parcels),
      parcels,
    };
  }
}
