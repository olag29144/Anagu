import { AuditService } from '../audit/audit.service';
import { MqttService } from '../mqtt/mqtt.service';
import { OracleService } from './oracle.service';
import {
  InstitutionalRecord,
  InstitutionalSourceClient,
} from './institutional-source.client';
import {
  CommunityRecord,
  CommunitySourceClient,
} from './community-source.client';
import { OwnershipClaim, VerificationOutcome } from './oracle.types';

interface OracleTrial {
  claim: OwnershipClaim;
  institutional: InstitutionalRecord;
  community: CommunityRecord | null;
  expected: VerificationOutcome;
}

describe('Component 3A — Ownership Verification Oracle Evaluation', () => {
  let service: OracleService;
  let auditMock: { record: jest.Mock };
  let mqttMock: { publish: jest.Mock };
  let institutionalMock: { fetchRecord: jest.Mock };
  let communityMock: { fetchRecord: jest.Mock };

  beforeEach(() => {
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    mqttMock = { publish: jest.fn().mockResolvedValue(undefined) };
    institutionalMock = { fetchRecord: jest.fn() };
    communityMock = { fetchRecord: jest.fn() };

    service = new OracleService(
      auditMock as unknown as AuditService,
      mqttMock as unknown as MqttService,
      institutionalMock as unknown as InstitutionalSourceClient,
      communityMock as unknown as CommunitySourceClient,
    );
  });

  it('evaluates 20 controlled claims across all 4 oracle categories and records Frequency/Percentage summary', async () => {
    const trials: OracleTrial[] = [
      // 11 SuccessfullyVerified (exact + minor Jaro-Winkler >= 0.85 typo)
      ...Array.from({ length: 10 }, (_, idx) => ({
        claim: {
          applicationId: `oracle-ok-${idx}`,
          parcelRef: `ABUJA/2026/OK-${idx}`,
          ownerName: `Chinedu Okafor ${idx}`,
          documentNumber: `C-OF-O-2026-0${idx}`,
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: `ABUJA/2026/OK-${idx}`,
          activeOwnerName: `Chinedu Okafor ${idx}`,
          documentNumber: `C-OF-O-2026-0${idx}`,
          legalHold: false,
        },
        community: {
          parcelRef: `ABUJA/2026/OK-${idx}`,
          communityAttestations: ['Chief Surveyor Bala'],
        },
        expected: 'SuccessfullyVerified' as const,
      })),
      {
        claim: {
          applicationId: 'oracle-ok-fuzzy',
          parcelRef: 'ABUJA/2026/OK-FUZZY',
          ownerName: 'Amina Mohammed-Bello',
          documentNumber: 'C-OF-O-2026-99',
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: 'ABUJA/2026/OK-FUZZY',
          activeOwnerName: 'Amina Mohamed-Bello',
          documentNumber: 'C-OF-O-2026-99',
          legalHold: false,
        },
        community: {
          parcelRef: 'ABUJA/2026/OK-FUZZY',
          communityAttestations: ['Community Elder Council'],
        },
        expected: 'SuccessfullyVerified',
      },

      // 3 IncompleteDocuments (missing documentNumber, missing ownerName, empty community attestations)
      {
        claim: {
          applicationId: 'oracle-inc-1',
          parcelRef: 'ABUJA/2026/INC-1',
          ownerName: 'Babatunde Lawal',
          documentNumber: '',
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: 'ABUJA/2026/INC-1',
          activeOwnerName: 'Babatunde Lawal',
          documentNumber: 'C-OF-O-1',
          legalHold: false,
        },
        community: {
          parcelRef: 'ABUJA/2026/INC-1',
          communityAttestations: ['Elder 1'],
        },
        expected: 'IncompleteDocuments',
      },
      {
        claim: {
          applicationId: 'oracle-inc-2',
          parcelRef: 'ABUJA/2026/INC-2',
          ownerName: '   ',
          documentNumber: 'C-OF-O-2',
          documentType: 'Deed of Assignment',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: 'ABUJA/2026/INC-2',
          activeOwnerName: 'Sadiq Umar',
          documentNumber: 'C-OF-O-2',
          legalHold: false,
        },
        community: {
          parcelRef: 'ABUJA/2026/INC-2',
          communityAttestations: ['Elder 2'],
        },
        expected: 'IncompleteDocuments',
      },
      {
        claim: {
          applicationId: 'oracle-inc-3',
          parcelRef: 'ABUJA/2026/INC-3',
          ownerName: 'Ngozi Eze',
          documentNumber: 'C-OF-O-3',
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: 'ABUJA/2026/INC-3',
          activeOwnerName: 'Ngozi Eze',
          documentNumber: 'C-OF-O-3',
          legalHold: false,
        },
        community: {
          parcelRef: 'ABUJA/2026/INC-3',
          communityAttestations: [],
        },
        expected: 'IncompleteDocuments',
      },

      // 4 OwnershipConflict (forged document number, different owner name)
      ...Array.from({ length: 2 }, (_, idx) => ({
        claim: {
          applicationId: `oracle-conf-doc-${idx}`,
          parcelRef: `ABUJA/2026/CONF-DOC-${idx}`,
          ownerName: 'Ibrahim Musa',
          documentNumber: `FORGED-${idx}`,
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: `ABUJA/2026/CONF-DOC-${idx}`,
          activeOwnerName: 'Ibrahim Musa',
          documentNumber: `GENUINE-${idx}`,
          legalHold: false,
        },
        community: {
          parcelRef: `ABUJA/2026/CONF-DOC-${idx}`,
          communityAttestations: ['Community Chief'],
        },
        expected: 'OwnershipConflict' as const,
      })),
      ...Array.from({ length: 2 }, (_, idx) => ({
        claim: {
          applicationId: `oracle-conf-name-${idx}`,
          parcelRef: `ABUJA/2026/CONF-NAME-${idx}`,
          ownerName: 'Samuel Adeyemi',
          documentNumber: `DOC-MATCH-${idx}`,
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: `ABUJA/2026/CONF-NAME-${idx}`,
          activeOwnerName: 'Fatima Danjuma',
          documentNumber: `DOC-MATCH-${idx}`,
          legalHold: false,
        },
        community: {
          parcelRef: `ABUJA/2026/CONF-NAME-${idx}`,
          communityAttestations: ['Community Chief'],
        },
        expected: 'OwnershipConflict' as const,
      })),

      // 2 LegalVerificationPending (active court / statutory hold)
      ...Array.from({ length: 2 }, (_, idx) => ({
        claim: {
          applicationId: `oracle-hold-${idx}`,
          parcelRef: `ABUJA/2026/HOLD-${idx}`,
          ownerName: 'Kemi Adeleke',
          documentNumber: `HOLD-DOC-${idx}`,
          documentType: 'Certificate of Occupancy',
          issuingAuthority: 'AGIS',
        },
        institutional: {
          parcelRef: `ABUJA/2026/HOLD-${idx}`,
          activeOwnerName: 'Kemi Adeleke',
          documentNumber: `HOLD-DOC-${idx}`,
          legalHold: true,
        },
        community: {
          parcelRef: `ABUJA/2026/HOLD-${idx}`,
          communityAttestations: ['Community Chief'],
        },
        expected: 'LegalVerificationPending' as const,
      })),
    ];

    const institutionalByParcel = new Map(
      trials.map((t) => [t.claim.parcelRef, t.institutional]),
    );
    const communityByParcel = new Map(
      trials.map((t) => [t.claim.parcelRef, t.community]),
    );

    institutionalMock.fetchRecord.mockImplementation(async (parcelRef: string) =>
      institutionalByParcel.get(parcelRef) ?? null,
    );
    communityMock.fetchRecord.mockImplementation(async (parcelRef: string) =>
      communityByParcel.get(parcelRef) ?? null,
    );

    const counts: Record<VerificationOutcome, number> = {
      SuccessfullyVerified: 0,
      IncompleteDocuments: 0,
      OwnershipConflict: 0,
      LegalVerificationPending: 0,
    };

    for (const trial of trials) {
      const res = await service.verify(trial.claim);
      expect(res.outcome).toBe(trial.expected);
      counts[res.outcome] += 1;
    }

    const total = trials.length;
    console.info('\n[Component 3A — Ownership Verification Oracle Test Results]');
    console.table([
      {
        'Verification Outcome': 'Successfully verified',
        Frequency: counts.SuccessfullyVerified,
        Percentage: `${((counts.SuccessfullyVerified / total) * 100).toFixed(1)}%`,
      },
      {
        'Verification Outcome': 'Incomplete supporting documents',
        Frequency: counts.IncompleteDocuments,
        Percentage: `${((counts.IncompleteDocuments / total) * 100).toFixed(1)}%`,
      },
      {
        'Verification Outcome': 'Ownership information conflict',
        Frequency: counts.OwnershipConflict,
        Percentage: `${((counts.OwnershipConflict / total) * 100).toFixed(1)}%`,
      },
      {
        'Verification Outcome': 'Legal verification pending',
        Frequency: counts.LegalVerificationPending,
        Percentage: `${((counts.LegalVerificationPending / total) * 100).toFixed(1)}%`,
      },
      {
        'Verification Outcome': 'Total',
        Frequency: total,
        Percentage: '100.0%',
      },
    ]);

    expect(total).toBe(20);
    expect(counts.SuccessfullyVerified).toBe(11);
    expect(counts.IncompleteDocuments).toBe(3);
    expect(counts.OwnershipConflict).toBe(4);
    expect(counts.LegalVerificationPending).toBe(2);
    expect(auditMock.record).toHaveBeenCalledTimes(20);
    expect(mqttMock.publish).toHaveBeenCalledTimes(20);
  });
});
