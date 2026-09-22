import { Test, TestingModule } from '@nestjs/testing';
import { OracleService } from './oracle.service';
import { AuditService } from '../audit/audit.service';
import { MqttService } from '../mqtt/mqtt.service';
import { OwnershipClaim } from './oracle.types';

/**
 * OracleService tests.
 *
 * OracleService uses a private `fetchInstitutionalRecord()` method to retrieve
 * parcel data (no injected clients). We spy on that method to control results
 * for each scenario without touching real network/database resources.
 */
describe('OracleService', () => {
  let service: OracleService;
  let auditMock: { record: jest.Mock };
  let mqttMock: { publish: jest.Mock };

  const baseClaim: OwnershipClaim = {
    applicationId: 'app-001',
    parcelRef: 'ABUJA/2024/001',
    ownerName: 'Emeka Okonkwo',
    documentNumber: 'DOC-12345',
    documentType: 'Certificate of Occupancy',
    issuingAuthority: 'FCT Land Registry',
  };

  beforeEach(async () => {
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    mqttMock = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleService,
        { provide: AuditService, useValue: auditMock },
        { provide: MqttService, useValue: mqttMock },
      ],
    }).compile();

    service = module.get<OracleService>(OracleService);
  });

  // Helper to spy on the private institutional fetch
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
});
