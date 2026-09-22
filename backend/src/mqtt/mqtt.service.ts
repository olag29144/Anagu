import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, MqttClient } from 'mqtt';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import type { QoS } from './mqtt-topics';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('MQTT_DISABLED') === 'true') {
      this.logger.warn('MQTT disabled; continuing without broker connection');
      return;
    }

    const brokerUrl = this.config.getOrThrow<string>('MQTT_BROKER_URL');
    const client = connect(brokerUrl);
    this.client = client;

    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => {
        this.logger.log('MQTT broker connected');
        resolve();
      });
      client.once('error', (err: Error) => {
        reject(err);
      });
    });
  }

  onModuleDestroy(): void {
    this.client?.end();
  }

  async publish(
    topic: string,
    payload: Record<string, unknown>,
    qos: QoS,
  ): Promise<void> {
    if (!this.client) {
      this.logger.warn(`Skipping MQTT publish while MQTT is disabled: ${topic}`);
      return;
    }

    const json = JSON.stringify(payload);
    const byteLen = Buffer.byteLength(json, 'utf8');

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(topic, json, { qos }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await this.logMqttEvent(topic, byteLen);
  }

  private async logMqttEvent(topic: string, payloadBytes: number): Promise<void> {
    const { error } = await this.supabase.from('mqtt_events').insert({
      topic,
      payload_size: payloadBytes,
      created_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error(`Failed to log MQTT event for topic "${topic}": ${error.message}`);
    }
  }
}
