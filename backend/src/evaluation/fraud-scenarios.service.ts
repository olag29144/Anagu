import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BaselineSimulatorService } from '../baseline/baseline-simulator.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { OracleService } from '../oracle/oracle.service';
import { SpatialService } from '../spatial/spatial.service';
import { CoordinateRing } from '../spatial/dto/spatial-verification.dto';

export interface ScenarioResult {
  scenario: number;
  description: string;
  trials: number;
  proposed: number;
  baseline: number;
  proposedDetected: number;
  baselineDetected: number;
  proposedRate: string;
  baselineRate: string;
}

const VALID_DOCUMENTS = {
  titleDeed: 'title-deed-document',
  surveyPlan: 'survey-plan-document',
  identityDocument: 'identity-document',
};

const REGISTERED_OWNER = 'Ada Okafor';
const REGISTERED_DOCUMENT = 'DOC-ANAGU-001';

@Injectable()
export class FraudScenariosService {
  constructor(
    private readonly baseline: BaselineSimulatorService,
    private readonly spatial: SpatialService,
    private readonly oracle: OracleService,
    private readonly blockchain: BlockchainService,
  ) {}

  async runScenario1(n = 20): Promise<ScenarioResult> {
    this.assertTrials(n);
    let proposed = 0;
    let baseline = 0;

    for (let i = 0; i < n; i++) {
      const applicationId = randomUUID();
      const tamperedDocumentNumber = `TAMPERED-${i}`;
      const submission = this.createSubmission(applicationId, {
        titleDeed: `doctored-document-number:${tamperedDocumentNumber}`,
      });
      const verification = await this.oracle.verify(
        {
          applicationId,
          parcelRef: `FRAUD-DOCUMENT-${i}`,
          ownerName: REGISTERED_OWNER,
          documentNumber: tamperedDocumentNumber,
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'Anagu Land Registry',
        },
        {
          activeOwnerName: REGISTERED_OWNER,
          documentNumber: REGISTERED_DOCUMENT,
          legalHold: false,
        },
        { parcelRef: `FRAUD-DOCUMENT-${i}`, communityAttestations: ['evaluation fixture'] },
      );

      if (verification.outcome === 'OwnershipConflict') proposed++;
      if (this.baseline.process(submission) === 'rejected_missing_documents') baseline++;
    }

    return this.buildResult(1, 'Forged/altered document', n, proposed, baseline);
  }

  async runScenario2(n = 20): Promise<ScenarioResult> {
    this.assertTrials(n);
    const { parcelRing, parcelId } = this.getOverlapFixture();
    let proposed = 0;
    let baseline = 0;

    for (let i = 0; i < n; i++) {
      const applicationId = randomUUID();
      const result = await this.spatial.verifySpatial({ applicationId, parcelRing });
      if (result.outcome === 'rejected_overlap') {
        if (result.conflictingParcelId !== parcelId) {
          throw new Error(
            `Expected overlap with seeded parcel ${parcelId}, received ${result.conflictingParcelId ?? 'no parcel ID'}`,
          );
        }
        proposed++;
      } else {
        throw new Error(
          `Overlap fixture ${parcelId} was not detected in trial ${i + 1}: ${result.outcome}`,
        );
      }

      if (this.baseline.process(this.createSubmission(applicationId)) === 'rejected_missing_documents') {
        baseline++;
      }
    }

    return this.buildResult(2, 'Duplicate/overlapping parcel', n, proposed, baseline);
  }

  async runScenario3(n = 20): Promise<ScenarioResult> {
    this.assertTrials(n);
    let proposed = 0;
    let baseline = 0;

    for (let i = 0; i < n; i++) {
      const applicationId = randomUUID();
      const verification = await this.oracle.verify(
        {
          applicationId,
          parcelRef: `FRAUD-INFORMANT-${i}`,
          ownerName: `False Claimant ${i}`,
          documentNumber: REGISTERED_DOCUMENT,
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'Anagu Land Registry',
        },
        {
          activeOwnerName: REGISTERED_OWNER,
          documentNumber: REGISTERED_DOCUMENT,
          legalHold: false,
        },
        { parcelRef: `FRAUD-INFORMANT-${i}`, communityAttestations: ['evaluation fixture'] },
      );

      if (verification.outcome === 'OwnershipConflict') proposed++;
      if (this.baseline.process(this.createSubmission(applicationId)) === 'rejected_missing_documents') {
        baseline++;
      }
    }

    return this.buildResult(3, 'Colluding verification informant', n, proposed, baseline);
  }

  async runScenario4(n = 20): Promise<ScenarioResult> {
    this.assertTrials(n);
    const tokenId = this.getRevokedTokenId();
    if (!(await this.blockchain.isRevoked(tokenId))) {
      throw new Error(
        `Fraud scenario 4 requires an already-revoked token; token ${tokenId} is not revoked`,
      );
    }

    let proposed = 0;
    let baseline = 0;
    for (let i = 0; i < n; i++) {
      if (await this.blockchain.wouldTransferBeRejected(tokenId)) proposed++;
      if (this.baseline.process(this.createSubmission(`revoked-token-trial-${i}`)) === 'rejected_missing_documents') {
        baseline++;
      }
    }

    return this.buildResult(4, 'Post-revocation NFT reuse', n, proposed, baseline);
  }

  private assertTrials(n: number): void {
    if (!Number.isInteger(n) || n < 20) {
      throw new BadRequestException('Fraud scenarios require at least 20 integer trials');
    }
  }

  private getOverlapFixture(): { parcelRing: CoordinateRing; parcelId: string } {
    const ringValue = process.env.FRAUD_SCENARIO_OVERLAP_RING;
    const parcelId = process.env.FRAUD_SCENARIO_OVERLAP_PARCEL_ID;
    if (!ringValue || !parcelId) {
      throw new Error(
        'Scenario 2 requires FRAUD_SCENARIO_OVERLAP_RING and FRAUD_SCENARIO_OVERLAP_PARCEL_ID for a seeded registered parcel',
      );
    }

    let coordinates: unknown;
    try {
      coordinates = JSON.parse(ringValue);
    } catch (error) {
      throw new Error(
        `FRAUD_SCENARIO_OVERLAP_RING must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 3 ||
      !coordinates.every(
        (point) =>
          Array.isArray(point) &&
          point.length === 2 &&
          point.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)),
      )
    ) {
      throw new Error(
        'FRAUD_SCENARIO_OVERLAP_RING must be an array of at least three [longitude, latitude] numeric coordinates',
      );
    }

    return {
      parcelRing: { coordinates: coordinates as [number, number][] },
      parcelId,
    };
  }

  private getRevokedTokenId(): bigint {
    const value = process.env.FRAUD_SCENARIO_REVOKED_TOKEN_ID;
    if (!value || !/^[1-9]\d*$/.test(value)) {
      throw new Error(
        'Scenario 4 requires FRAUD_SCENARIO_REVOKED_TOKEN_ID to identify an existing revoked token',
      );
    }
    return BigInt(value);
  }

  private createSubmission(
    applicationId: string,
    documentOverrides: Record<string, string> = {},
  ) {
    return {
      applicationId,
      documents: { ...VALID_DOCUMENTS, ...documentOverrides },
      parcelCoords: [],
      ownerName: 'Test Applicant',
      documentNumber: 'DOC-TEST',
    };
  }

  private buildResult(
    scenario: number,
    description: string,
    trials: number,
    proposed: number,
    baseline: number,
  ): ScenarioResult {
    return {
      scenario,
      description,
      trials,
      proposed,
      baseline,
      proposedDetected: proposed,
      baselineDetected: baseline,
      proposedRate: `${proposed}/${trials} (${((proposed / trials) * 100).toFixed(1)}%)`,
      baselineRate: `${baseline}/${trials} (${((baseline / trials) * 100).toFixed(1)}%)`,
    };
  }
}
