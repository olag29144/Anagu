import { Module } from '@nestjs/common';
import { BaselineModule } from '../baseline/baseline.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { FraudScenariosService } from './fraud-scenarios.service';
import { LatencyInstrumentationService } from './latency-instrumentation.service';
import { StorageAnalysisService } from './storage-analysis.service';
import { EvaluationController } from './evaluation.controller';

/**
 * EvaluationModule — cross-cutting evaluation layer (Step 5).
 *
 * Wires the fraud scenario runner, latency instrumentation, and storage analysis
 * services behind the Land Admin-guarded evaluation endpoints.
 *
 * Requirements: 10.1–10.7
 */
@Module({
  imports: [BaselineModule, AuthModule, AuditModule],
  providers: [FraudScenariosService, LatencyInstrumentationService, StorageAnalysisService],
  controllers: [EvaluationController],
})
export class EvaluationModule {}
