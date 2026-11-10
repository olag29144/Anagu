import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { OracleService } from './oracle.service';
import { AuditService } from '../audit/audit.service';
import { MqttService } from '../mqtt/mqtt.service';
import { OwnershipClaim } from './oracle.types';
import { InstitutionalSourceClient } from './institutional-source.client';
import { CommunitySourceClient } from './community-source.client';

/**
 * OracleService tests.
 *
 * Source clients are mocked so each scenario is deterministic and does not
 * touch real database resources.
 */
describe('OracleService', () => {
  let service: OracleService;
  let auditMock: { record: jest.Mock };
  let mqttMock: { publish: jest.Mock };
  let institutionalMock: { fetchRecord: jest.Mock };
  let communityMock: { fetchRecord: jest.Mock };

  const baseClaim: OwnershipClaim = {
    applicationId: 'app-001',
    parcelRef: 'ABUJA/2024/001',
    ownerName: 'Emeka Okonkwo',
    documentNumber: 'DOC-12345',
    documentType: 'Certificate of Occupancy',
    issuingAuthority: 'FCT Land Registry',
  };
  const nonBlankString = fc
    .string({ minLength: 1, maxLength: 32 })
    .filter((value) => value.trim().length > 0);
  const validClaimArbitrary = fc.record({
    applicationId: fc.uuid(),
    parcelRef: nonBlankString,
    ownerName: nonBlankString,
    documentNumber: nonBlankString,
    documentType: nonBlankString,
    issuingAuthority: nonBlankString,
  });

  beforeEach(async () => {
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    mqttMock = { publish: jest.fn().mockResolvedValue(undefined) };
    institutionalMock = {
      fetchRecord: jest.fn().mockResolvedValue(null),
    };
    communityMock = {
      fetchRecord: jest
        .fn()
        .mockImplementation(async (parcelRef: string) => ({
          parcelRef,
          communityAttestations: ['verified community attestation'],
        })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleService,
        { provide: AuditService, useValue: auditMock },
        { provide: MqttService, useValue: mqttMock },
        { provide: InstitutionalSourceClient, useValue: institutionalMock },
        { provide: CommunitySourceClient, useValue: communityMock },
      ],
    }).compile();

    service = module.get<OracleService>(OracleService);
  });

  it('uses the institutional source record when verifying ownership', async () => {
    institutionalMock.fetchRecord.mockResolvedValue({
      parcelRef: baseClaim.parcelRef,
      activeOwnerName: 'Different Person',
      documentNumber: 'OTHER-DOCUMENT',
      legalHold: false,
    });

    const result = await service.verify(baseClaim);

    expect(institutionalMock.fetchRecord).toHaveBeenCalledWith(baseClaim.parcelRef);
    expect(result.outcome).toBe('OwnershipConflict');
    expect(result.reason).toBe('Document number mismatch');
  });

  it('requires at least one non-empty community attestation before verification', async () => {
    communityMock.fetchRecord.mockResolvedValue({
      parcelRef: baseClaim.parcelRef,
      communityAttestations: [' ', ''],
    });

    const result = await service.verify(baseClaim);

    expect(result).toEqual({
      outcome: 'IncompleteDocuments',
      reason: 'At least one community attestation is required',
    });
    expect(institutionalMock.fetchRecord).not.toHaveBeenCalled();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'IncompleteDocuments',
      }),
    );
    expect(mqttMock.publish).toHaveBeenCalledWith(
      'land/verification/result',
      expect.objectContaining({ outcome: 'IncompleteDocuments' }),
      1,
    );
  });

  it('does not accept an attestation from a different parcel', async () => {
    communityMock.fetchRecord.mockResolvedValue({
      parcelRef: 'ANOTHER/PARCEL',
      communityAttestations: ['attestation for another parcel'],
    });

    const result = await service.verify(baseClaim);

    expect(result).toEqual({
      outcome: 'IncompleteDocuments',
      reason: 'Community attestation does not match the claimed parcel',
    });
    expect(institutionalMock.fetchRecord).not.toHaveBeenCalled();
  });

  it('records and surfaces community source failures', async () => {
    communityMock.fetchRecord.mockRejectedValue(new Error('community source offline'));

    await expect(service.verify(baseClaim)).rejects.toThrow(
      'Community ownership verification failed: community source offline',
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'SOURCE_UNAVAILABLE',
        metadata: expect.objectContaining({ source: 'community' }),
      }),
    );
    expect(mqttMock.publish).toHaveBeenCalledWith(
      'land/verification/result',
      expect.objectContaining({ outcome: 'SourceUnavailable' }),
      1,
    );
  });

  it('audits and publishes institutional source failures before surfacing them', async () => {
    institutionalMock.fetchRecord.mockRejectedValue(
      new Error('registry connection timed out'),
    );

    await expect(service.verify(baseClaim)).rejects.toThrow(
      'Institutional ownership verification failed: registry connection timed out',
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: baseClaim.applicationId,
        action: 'ORACLE_VERIFICATION',
        outcome: 'SOURCE_UNAVAILABLE',
        metadata: expect.objectContaining({
          source: 'institutional',
          reason: 'registry connection timed out',
        }),
      }),
    );
    expect(mqttMock.publish).toHaveBeenCalledWith(
      'land/verification/result',
      expect.objectContaining({
        applicationId: baseClaim.applicationId,
        outcome: 'SourceUnavailable',
      }),
      1,
    );
  });

  // Helper to control institutional results without a real data source.
  function mockInstitutional(
    record: {
      ownerName?: string;
      documentNumber?: string;
      legalHold: boolean;
    } | null,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'fetchInstitutionalRecord').mockResolvedValue(
      record ?? { legalHold: false },
    );
  }

  // --------------------------------------------------------------------------
  // Rule 1 — IncompleteDocuments
  // --------------------------------------------------------------------------

  describe('IncompleteDocuments', () => {
    it('returns IncompleteDocuments when ownerName is empty', async () => {
      const result = await service.verify({ ...baseClaim, ownerName: '' });
      expect(result.outcome).toBe('IncompleteDocuments');
    });

    it('returns IncompleteDocuments when documentNumber is whitespace', async () => {
      const result = await service.verify({
        ...baseClaim,
        documentNumber: '   ',
      });
      expect(result.outcome).toBe('IncompleteDocuments');
    });

    it('returns IncompleteDocuments when documentType is missing', async () => {
      const result = await service.verify({ ...baseClaim, documentType: '' });
      expect(result.outcome).toBe('IncompleteDocuments');
    });

    it('returns IncompleteDocuments when issuingAuthority is missing', async () => {
      const result = await service.verify({
        ...baseClaim,
        issuingAuthority: '  ',
      });
      expect(result.outcome).toBe('IncompleteDocuments');
    });

    it('calls audit and mqtt exactly once for IncompleteDocuments', async () => {
      await service.verify({ ...baseClaim, ownerName: '' });
      expect(auditMock.record).toHaveBeenCalledTimes(1);
      expect(mqttMock.publish).toHaveBeenCalledTimes(1);
    });

    it('does not call fetchInstitutionalRecord when fields are incomplete', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = jest.spyOn(service as any, 'fetchInstitutionalRecord');
      await service.verify({ ...baseClaim, ownerName: '' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('returns IncompleteDocuments when a required field is undefined', async () => {
      const claim = {
        ...baseClaim,
        ownerName: undefined,
      } as unknown as OwnershipClaim;

      const result = await service.verify(claim);

      expect(result.outcome).toBe('IncompleteDocuments');
    });
  });

  // --------------------------------------------------------------------------
  // Rule 2 — LegalVerificationPending
  // --------------------------------------------------------------------------

  describe('LegalVerificationPending', () => {
    beforeEach(() => {
      mockInstitutional({
        ownerName: baseClaim.ownerName,
        documentNumber: baseClaim.documentNumber,
        legalHold: true,
      });
    });

    it('returns LegalVerificationPending when legalHold is true', async () => {
      const result = await service.verify(baseClaim);
      expect(result.outcome).toBe('LegalVerificationPending');
    });

    it('calls audit and mqtt exactly once', async () => {
      await service.verify(baseClaim);
      expect(auditMock.record).toHaveBeenCalledTimes(1);
      expect(mqttMock.publish).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Rule 3 — OwnershipConflict
  // --------------------------------------------------------------------------

  describe('OwnershipConflict', () => {
    beforeEach(() => {
      mockInstitutional({
        ownerName: 'Completely Different Name XYZ',
        documentNumber: baseClaim.documentNumber,
        legalHold: false,
      });
    });

    it('returns OwnershipConflict when name similarity is below 0.85', async () => {
      const result = await service.verify(baseClaim);
      expect(result.outcome).toBe('OwnershipConflict');
    });

    it('exposes a similarity score on OwnershipConflict', async () => {
      const result = await service.verify(baseClaim);
      expect(typeof result.score).toBe('number');
      expect((result.score ?? 1)).toBeLessThan(0.85);
    });

    it('calls audit and mqtt once for OwnershipConflict', async () => {
      await service.verify(baseClaim);
      expect(auditMock.record).toHaveBeenCalledTimes(1);
      expect(mqttMock.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('OwnershipConflict — document mismatch', () => {
    beforeEach(() => {
      mockInstitutional({
        ownerName: baseClaim.ownerName,           // same name — no name conflict
        documentNumber: 'COMPLETELY-DIFFERENT',   // document mismatch
        legalHold: false,
      });
    });

    it('returns OwnershipConflict when document numbers differ', async () => {
      const result = await service.verify(baseClaim);
      expect(result.outcome).toBe('OwnershipConflict');
    });
  });

  // --------------------------------------------------------------------------
  // Rule 4 — SuccessfullyVerified
  // --------------------------------------------------------------------------

  describe('SuccessfullyVerified', () => {
    beforeEach(() => {
      mockInstitutional({
        ownerName: baseClaim.ownerName,
        documentNumber: baseClaim.documentNumber,
        legalHold: false,
      });
    });

    it('returns SuccessfullyVerified for exact name and document match', async () => {
      const result = await service.verify(baseClaim);
      expect(result.outcome).toBe('SuccessfullyVerified');
    });

    it('calls audit exactly once', async () => {
      await service.verify(baseClaim);
      expect(auditMock.record).toHaveBeenCalledTimes(1);
    });

    it('calls mqtt publish exactly once on land/verification/result', async () => {
      await service.verify(baseClaim);
      expect(mqttMock.publish).toHaveBeenCalledWith(
        'land/verification/result',
        expect.objectContaining({
          applicationId: baseClaim.applicationId,
          outcome: 'SuccessfullyVerified',
        }),
        1,
      );
    });

    it('returns verifiedAt as a valid ISO 8601 string', async () => {
      // The service returns result.verifiedAt only if the type includes it;
      // our VerificationResult doesn't have verifiedAt — but it does return
      // a timestamp in the MQTT payload.  We verify the publish timestamp.
      await service.verify(baseClaim);
      const publishPayload = mqttMock.publish.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      const ts = publishPayload['timestamp'] as string;
      expect(new Date(ts).toISOString()).toBe(ts);
    });

    it('score is at or above 0.85 on a successful match', async () => {
      const result = await service.verify(baseClaim);
      expect((result.score ?? 0)).toBeGreaterThanOrEqual(0.85);
    });
  });

  // --------------------------------------------------------------------------
  // No institutional record (ownerName/documentNumber absent)
  //
  // When the institutional store has no owner data, the Jaro-Winkler comparison
  // runs against an empty string, scoring below 0.85 — so the service returns
  // OwnershipConflict rather than SuccessfullyVerified.  This is intentional:
  // the absence of a record is not the same as a confirmed match.
  // --------------------------------------------------------------------------

  describe('no institutional record (ownerName/documentNumber absent)', () => {
    beforeEach(() => {
      // Record exists but carries no owner identity — only a legalHold flag.
      mockInstitutional({ legalHold: false });
    });

    it('returns OwnershipConflict when owner name is absent from the institutional record', async () => {
      const result = await service.verify(baseClaim);
      expect(result.outcome).toBe('OwnershipConflict');
    });

    it('exposes a score below 0.85 when ownerName is absent', async () => {
      const result = await service.verify(baseClaim);
      expect((result.score ?? 1)).toBeLessThan(0.85);
    });

    it('returns OwnershipConflict when the institutional fetch returns null', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, 'fetchInstitutionalRecord').mockResolvedValue(null);

      const result = await service.verify(baseClaim);

      expect(result.outcome).toBe('OwnershipConflict');
    });
  });

  // --------------------------------------------------------------------------
  // Audit payload shape
  // --------------------------------------------------------------------------

  describe('audit payload', () => {
    it('audit entry contains the applicationId as entityId', async () => {
      mockInstitutional({
        ownerName: baseClaim.ownerName,
        documentNumber: baseClaim.documentNumber,
        legalHold: false,
      });
      await service.verify(baseClaim);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: baseClaim.applicationId }),
      );
    });

    it('audit action is always ORACLE_VERIFICATION', async () => {
      mockInstitutional({
        ownerName: baseClaim.ownerName,
        documentNumber: baseClaim.documentNumber,
        legalHold: false,
      });
      await service.verify(baseClaim);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORACLE_VERIFICATION' }),
      );
    });
  });

  describe('property invariants', () => {
    it('matches claims when owner names and document numbers match', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const institutionalSpy = jest.spyOn(service as any, 'fetchInstitutionalRecord');

      await fc.assert(
        fc.asyncProperty(validClaimArbitrary, async (claim) => {
          institutionalSpy.mockResolvedValue({
            ownerName: claim.ownerName,
            documentNumber: claim.documentNumber,
            legalHold: false,
          });
          auditMock.record.mockClear();
          mqttMock.publish.mockClear();

          const result = await service.verify(claim);

          expect(result.outcome).toBe('SuccessfullyVerified');
          expect(auditMock.record).toHaveBeenCalledTimes(1);
          expect(mqttMock.publish).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 25 },
      );
    });

    it('returns pending for every claim when the institutional record has a legal hold', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const institutionalSpy = jest.spyOn(service as any, 'fetchInstitutionalRecord');

      await fc.assert(
        fc.asyncProperty(validClaimArbitrary, async (claim) => {
          institutionalSpy.mockResolvedValue({
            ownerName: claim.ownerName,
            documentNumber: claim.documentNumber,
            legalHold: true,
          });
          auditMock.record.mockClear();
          mqttMock.publish.mockClear();

          const result = await service.verify(claim);

          expect(result.outcome).toBe('LegalVerificationPending');
          expect(auditMock.record).toHaveBeenCalledTimes(1);
          expect(mqttMock.publish).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 25 },
      );
    });

    it('returns conflict for every exact-name claim with a different document number', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const institutionalSpy = jest.spyOn(service as any, 'fetchInstitutionalRecord');

      await fc.assert(
        fc.asyncProperty(validClaimArbitrary, async (claim) => {
          institutionalSpy.mockResolvedValue({
            ownerName: claim.ownerName,
            documentNumber: `${claim.documentNumber}-different`,
            legalHold: false,
          });
          auditMock.record.mockClear();
          mqttMock.publish.mockClear();

          const result = await service.verify(claim);

          expect(result.outcome).toBe('OwnershipConflict');
          expect(auditMock.record).toHaveBeenCalledTimes(1);
          expect(mqttMock.publish).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 25 },
      );
    });

    it('does not fetch an institutional record for incomplete claims', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const institutionalSpy = jest.spyOn(service as any, 'fetchInstitutionalRecord');

      await fc.assert(
        fc.asyncProperty(validClaimArbitrary, async (claim) => {
          institutionalSpy.mockClear();
          auditMock.record.mockClear();
          mqttMock.publish.mockClear();

          const result = await service.verify({ ...claim, ownerName: '  ' });

          expect(result.outcome).toBe('IncompleteDocuments');
          expect(institutionalSpy).not.toHaveBeenCalled();
          expect(auditMock.record).toHaveBeenCalledTimes(1);
          expect(mqttMock.publish).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 25 },
      );
    });
  });
});
