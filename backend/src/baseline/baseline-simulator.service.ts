import { Injectable } from '@nestjs/common';

export interface BaselineSubmission {
  applicationId: string;
  documents: Record<string, string | null | undefined>;
  parcelCoords: [number, number][];
  ownerName: string;
  documentNumber: string;
}

export type BaselineOutcome = 'accepted' | 'rejected_missing_documents';

/**
 * Simulates a manual/paper-based land registration process.
 * Checks ONLY that the three required documents are non-empty strings.
 * Performs NO spatial check and NO ownership cross-check.
 * Requirement 10.1
 */
@Injectable()
export class BaselineSimulatorService {
  readonly REQUIRED_DOCS = ['titleDeed', 'surveyPlan', 'identityDocument'] as const;

  process(submission: BaselineSubmission): BaselineOutcome {
    const documents = submission.documents ?? {};

    const allPresent = this.REQUIRED_DOCS.every((doc) => {
      const value = documents[doc];
      return typeof value === 'string' && value.trim().length > 0;
    });

    return allPresent ? 'accepted' : 'rejected_missing_documents';
  }
}
