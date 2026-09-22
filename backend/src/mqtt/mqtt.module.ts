import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { MqttService } from './mqtt.service';

@Module({
  imports: [SupabaseModule, ConfigModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
