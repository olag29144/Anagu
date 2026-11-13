import { LatencyInstrumentationService, StageTiming } from './latency-instrumentation.service';

describe('LatencyInstrumentationService', () => {
  let service: LatencyInstrumentationService;

  beforeEach(() => {
    service = new LatencyInstrumentationService();
  });

  it('reports mean and standard deviation for each stage and total', async () => {
    const runs: StageTiming[] = [
      { t_gis: 1, t_oracle: 2, t_contract: 3, t_nft: 4, t_sync: 5, T_total: 15 },
      { t_gis: 3, t_oracle: 4, t_contract: 5, t_nft: 6, t_sync: 7, T_total: 25 },
      { t_gis: 5, t_oracle: 6, t_contract: 7, t_nft: 8, t_sync: 9, T_total: 35 },
    ];
    const timedRegistration = jest
      .spyOn(service, 'timedRegistration')
      .mockImplementation(async () => {
        const run = runs.shift();
        if (!run) throw new Error('Unexpected extra benchmark run');
        return run;
      });

    const result = await service.runLatencyBenchmark(3);

    expect(timedRegistration).toHaveBeenCalledTimes(3);
    expect(result.runs).toBe(3);
    expect(result.stages).toEqual({
      t_gis: { mean: 3, sd: 1.633 },
      t_oracle: { mean: 4, sd: 1.633 },
      t_contract: { mean: 5, sd: 1.633 },
      t_nft: { mean: 6, sd: 1.633 },
      t_sync: { mean: 7, sd: 1.633 },
      T_total: { mean: 25, sd: 8.165 },
    });
  });

  it('rejects invalid run counts instead of returning empty statistics', async () => {
    await expect(service.runLatencyBenchmark(0)).rejects.toThrow(
      'Benchmark run count must be a positive integer',
    );
    expect(() => service.runBaselineBenchmark(1.5)).toThrow(
      'Benchmark run count must be a positive integer',
    );
  });

  it('instruments custom stage hooks when supplied and computes improvement percentage', async () => {
    const called: string[] = [];
    const timing = await service.timedRegistration({
      gisVerify: async () => called.push('gis'),
      oracleVerify: async () => called.push('oracle'),
      executeSmartContract: async () => called.push('contract'),
      issueNFT: async () => called.push('nft'),
      publishMQTT: async () => called.push('mqtt'),
    });

    expect(called).toEqual(['gis', 'oracle', 'contract', 'nft', 'mqtt']);
    expect(timing.T_total).toBeCloseTo(
      timing.t_gis + timing.t_oracle + timing.t_contract + timing.t_nft + timing.t_sync,
      4,
    );
    expect(service.computeImprovementPercentage(25, 100)).toBe(75);
    expect(service.computeImprovementPercentage(100, 0)).toBe(0);
  });
});
