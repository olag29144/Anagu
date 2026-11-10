import { BadRequestException } from '@nestjs/common';
import { BaselineSimulatorService } from '../baseline/baseline-simulator.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { OracleService } from '../oracle/oracle.service';
import { SpatialService } from '../spatial/spatial.service';
import { FraudScenariosService } from './fraud-scenarios.service';

describe('FraudScenariosService', () => {
  const overlapRing = JSON.stringify([
    [3, 6],
    [4, 6],
    [4, 7],
  ]);
  let originalRing: string | undefined;
  let originalParcelId: string | undefined;
  let originalTokenId: string | undefined;
  let baseline: BaselineSimulatorService;
  let baselineProcess: jest.SpyInstance;
  let spatial: { verifySpatial: jest.Mock };
  let oracle: { verify: jest.Mock };
  let blockchain: {
    isRevoked: jest.Mock;
    wouldTransferBeRejected: jest.Mock;
  };
  let service: FraudScenariosService;

  beforeEach(() => {
    originalRing = process.env.FRAUD_SCENARIO_OVERLAP_RING;
    originalParcelId = process.env.FRAUD_SCENARIO_OVERLAP_PARCEL_ID;
    originalTokenId = process.env.FRAUD_SCENARIO_REVOKED_TOKEN_ID;
    process.env.FRAUD_SCENARIO_OVERLAP_RING = overlapRing;
    process.env.FRAUD_SCENARIO_OVERLAP_PARCEL_ID = 'seeded-parcel-001';
    process.env.FRAUD_SCENARIO_REVOKED_TOKEN_ID = '42';

    spatial = {
      verifySpatial: jest.fn().mockResolvedValue({
        outcome: 'rejected_overlap',
        conflictingParcelId: 'seeded-parcel-001',
      }),
    };
    oracle = {
      verify: jest.fn().mockResolvedValue({ outcome: 'OwnershipConflict' }),
    };
    blockchain = {
      isRevoked: jest.fn().mockResolvedValue(true),
      wouldTransferBeRejected: jest.fn().mockResolvedValue(true),
    };
    baseline = new BaselineSimulatorService();
    baselineProcess = jest.spyOn(baseline, 'process');
    service = new FraudScenariosService(
      baseline,
      spatial as unknown as SpatialService,
      oracle as unknown as OracleService,
      blockchain as unknown as BlockchainService,
    );
  });

  afterEach(() => {
    restoreEnv('FRAUD_SCENARIO_OVERLAP_RING', originalRing);
    restoreEnv('FRAUD_SCENARIO_OVERLAP_PARCEL_ID', originalParcelId);
    restoreEnv('FRAUD_SCENARIO_REVOKED_TOKEN_ID', originalTokenId);
  });

  it('counts forged document detection from the oracle result and compares baseline checks', async () => {
    const result = await service.runScenario1(20);

    expect(oracle.verify).toHaveBeenCalledTimes(20);
    expect(oracle.verify.mock.calls[0][0].documentNumber).toMatch(/^TAMPERED-/);
    expect(oracle.verify.mock.calls[0][1].documentNumber).toBe('DOC-ANAGU-001');
    expect(
      baselineProcess.mock.calls[0][0].documents.titleDeed,
    ).toMatch(
      /^doctored-document-number:TAMPERED-/,
    );
    expect(result).toMatchObject({
      trials: 20,
      proposed: 20,
      baseline: 0,
    });
  });

  it('requires overlap with the configured seeded parcel for every spatial trial', async () => {
    const result = await service.runScenario2(20);

    expect(spatial.verifySpatial).toHaveBeenCalledTimes(20);
    expect(spatial.verifySpatial.mock.calls[0][0].parcelRing.coordinates).toEqual(
      JSON.parse(overlapRing),
    );
    expect(result).toMatchObject({ trials: 20, proposed: 20, baseline: 0 });
  });

  it('fails the overlap scenario if the configured seeded parcel is not detected', async () => {
    spatial.verifySpatial.mockResolvedValue({
      outcome: 'rejected_overlap',
      conflictingParcelId: 'different-parcel',
    });

    await expect(service.runScenario2(20)).rejects.toThrow(
      'Expected overlap with seeded parcel seeded-parcel-001',
    );
  });

  it('counts colluding informant detections from the oracle result', async () => {
    const result = await service.runScenario3(20);

    expect(oracle.verify).toHaveBeenCalledTimes(20);
    expect(oracle.verify.mock.calls[0][0].ownerName).toMatch(/^False Claimant/);
    expect(oracle.verify.mock.calls[0][1].activeOwnerName).toBe('Ada Okafor');
    expect(result).toMatchObject({ trials: 20, proposed: 20, baseline: 0 });
  });

  it('requires an already-revoked token and counts read-only rejected transfer attempts', async () => {
    const result = await service.runScenario4(20);

    expect(blockchain.isRevoked).toHaveBeenCalledWith(42n);
    expect(blockchain.wouldTransferBeRejected).toHaveBeenCalledTimes(20);
    expect(result).toMatchObject({ trials: 20, proposed: 20, baseline: 0 });
  });

  it('does not simulate transfers if the fixture token is not revoked', async () => {
    blockchain.isRevoked.mockResolvedValue(false);

    await expect(service.runScenario4(20)).rejects.toThrow('is not revoked');
    expect(blockchain.wouldTransferBeRejected).not.toHaveBeenCalled();
  });

  it('rejects fewer than 20 trials', async () => {
    await expect(service.runScenario1(19)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(oracle.verify).not.toHaveBeenCalled();
  });

  it('requires explicit seeded spatial and revoked-token fixtures', async () => {
    delete process.env.FRAUD_SCENARIO_OVERLAP_RING;
    await expect(service.runScenario2(20)).rejects.toThrow(
      'FRAUD_SCENARIO_OVERLAP_RING',
    );

    delete process.env.FRAUD_SCENARIO_REVOKED_TOKEN_ID;
    await expect(service.runScenario4(20)).rejects.toThrow(
      'FRAUD_SCENARIO_REVOKED_TOKEN_ID',
    );
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
