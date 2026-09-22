import { Module } from '@nestjs/common';
import { BaselineSimulatorService } from './baseline-simulator.service';

/**
 * BaselineModule — exposes the paper-based baseline simulator service.
 *
 * Requirement 10.1
 */
@Module({
  providers: [BaselineSimulatorService],
  exports: [BaselineSimulatorService],
})
export class BaselineModule {}
