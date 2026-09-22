import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, UserRole } from '../auth/roles';
import { FraudScenariosService } from './fraud-scenarios.service';
import { LatencyInstrumentationService } from './latency-instrumentation.service';
import { StorageAnalysisService } from './storage-analysis.service';

/**
 * EvaluationController — exposes the cross-cutting evaluation endpoints.
 *
 * All endpoints are restricted to the Land Administrator role (Requirement 7.6).
 *
 * POST /evaluation/fraud/:scenario  — run one of the four fraud scenarios (Req 10.2)
 * POST /evaluation/latency          — run latency benchmark (Req 10.3, 10.6)
 * GET  /evaluation/storage          — report storage overhead (Req 10.4, 10.5)
 *
 * Requirements: 10.2–10.7
 */
@Controller('evaluation')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.LAND_ADMIN)
export class EvaluationController {
  constructor(
    private readonly fraud: FraudScenariosService,
    private readonly latency: LatencyInstrumentationService,
    private readonly storage: StorageAnalysisService,
  ) {}

  /**
   * Run one of the four defined fraud adversary scenarios.
   * Each scenario executes 30 trials (≥ 20 as mandated by Requirement 10.2).
   *
   * POST /evaluation/fraud/1  — forged/altered document
   * POST /evaluation/fraud/2  — duplicate/overlapping parcel
   * POST /evaluation/fraud/3  — colluding verification informant
   * POST /evaluation/fraud/4  — post-revocation NFT reuse (Requirement 10.7)
   */
  @Post('fraud/:scenario')
  @HttpCode(HttpStatus.OK)
  runFraudScenario(@Param('scenario') scenario: string) {
    const n = 30; // ≥ 20 trials as required by Requirement 10.2
    switch (scenario) {
      case '1':
        return this.fraud.runScenario1(n);
      case '2':
        return this.fraud.runScenario2(n);
      case '3':
        return this.fraud.runScenario3(n);
      case '4':
        return this.fraud.runScenario4(n);
      default:
        return { error: `Unknown scenario: ${scenario}. Valid values: 1–4.` };
    }
  }

  /**
   * Run the processing latency benchmark across all five pipeline stages.
   * Executes 30 complete timed registration transactions for both the proposed
   * system and the conventional baseline, returning mean ± SD per stage.
   *
   * Requirements: 10.3, 10.6
   */
  @Post('latency')
  @HttpCode(HttpStatus.OK)
  async runLatency() {
    const [proposed, baseline] = await Promise.all([
      this.latency.runLatencyBenchmark(30),
      Promise.resolve(this.latency.runBaselineBenchmark(30)),
    ]);
    return { proposed, baseline };
  }

  /**
   * Return the on-chain storage overhead analysis report for 1 000 parcels.
   * Includes per-field bit lengths, per-record byte total, and percentage reduction
   * vs the conventional baseline.
   *
   * Requirements: 10.4, 10.5
   */
  @Get('storage')
  getStorage() {
    return this.storage.getFullReport(1000);
  }
}
