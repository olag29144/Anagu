import { BaselineSimulatorService } from './baseline-simulator.service';

describe('BaselineSimulatorService', () => {
  let service: BaselineSimulatorService;

  beforeEach(() => {
    service = new BaselineSimulatorService();
  });

  // --------------------------------------------------------------------------
  // Happy path — all documents present
  // --------------------------------------------------------------------------

  it('accepts when all three required documents are present', () => {
    const result = service.process({
      applicationId: 'app-001',
      documents: {
        titleDeed: 'deed.pdf',
        surveyPlan: 'survey.pdf',
        identityDocument: 'id.pdf',
      },
      parcelCoords: [[3.0, 6.0]],
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('accepted');
  });

  // --------------------------------------------------------------------------
  // Missing / blank documents
  // --------------------------------------------------------------------------

  it('rejects when titleDeed is empty string', () => {
    const result = service.process({
      applicationId: 'app-002',
      documents: {
        titleDeed: '',
        surveyPlan: 'survey.pdf',
        identityDocument: 'id.pdf',
      },
      parcelCoords: [],
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('rejected_missing_documents');
  });

  it('rejects when surveyPlan is null', () => {
    const result = service.process({
      applicationId: 'app-003',
      documents: {
        titleDeed: 'deed.pdf',
        surveyPlan: null,
        identityDocument: 'id.pdf',
      },
      parcelCoords: [],
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('rejected_missing_documents');
  });

  it('rejects when identityDocument is whitespace only', () => {
    const result = service.process({
      applicationId: 'app-004',
      documents: {
        titleDeed: 'deed.pdf',
        surveyPlan: 'survey.pdf',
        identityDocument: '   ',
      },
      parcelCoords: [],
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('rejected_missing_documents');
  });

  it('rejects when all three documents are missing', () => {
    const result = service.process({
      applicationId: 'app-007',
      documents: {},
      parcelCoords: [],
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('rejected_missing_documents');
  });

  it('rejects when surveyPlan is undefined', () => {
    const result = service.process({
      applicationId: 'app-008',
      documents: {
        titleDeed: 'deed.pdf',
        surveyPlan: undefined,
        identityDocument: 'id.pdf',
      },
      parcelCoords: [],
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('rejected_missing_documents');
  });

  // --------------------------------------------------------------------------
  // Parcel coordinates are intentionally ignored (baseline design)
  // --------------------------------------------------------------------------

  it('performs NO spatial check — empty parcelCoords still accepts when documents are present', () => {
    const result = service.process({
      applicationId: 'app-005',
      documents: {
        titleDeed: 'deed.pdf',
        surveyPlan: 'survey.pdf',
        identityDocument: 'id.pdf',
      },
      parcelCoords: [],  // empty — but should still accept
      ownerName: 'Test User',
      documentNumber: 'DOC001',
    });
    expect(result).toBe('accepted');
  });

  // --------------------------------------------------------------------------
  // Owner name / document number are intentionally ignored (baseline design)
  // --------------------------------------------------------------------------

  it('performs NO ownership check — empty ownerName still accepts when documents are present', () => {
    const result = service.process({
      applicationId: 'app-006',
      documents: {
        titleDeed: 'deed.pdf',
        surveyPlan: 'survey.pdf',
        identityDocument: 'id.pdf',
      },
      parcelCoords: [],
      ownerName: '',    // empty — but should still accept
      documentNumber: '',
    });
    expect(result).toBe('accepted');
  });

  // --------------------------------------------------------------------------
  // REQUIRED_DOCS constant
  // --------------------------------------------------------------------------

  it('exposes REQUIRED_DOCS with exactly three entries', () => {
    expect(service.REQUIRED_DOCS).toHaveLength(3);
    expect(service.REQUIRED_DOCS).toContain('titleDeed');
    expect(service.REQUIRED_DOCS).toContain('surveyPlan');
    expect(service.REQUIRED_DOCS).toContain('identityDocument');
  });
});
