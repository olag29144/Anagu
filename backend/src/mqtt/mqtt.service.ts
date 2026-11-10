import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, MqttClient } from 'mqtt';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { MQTT_TOPICS, QoS } from './mqtt-topics';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;
  private readonly pendingPublishes: Array<{
    topic: string;
    payload: string;
    qos: QoS;
    byteLen: number;
  }> = [];
  private flushPromise: Promise<void> | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseClientService,
  ) {}

  private readonly handleReconnect = (): void => {
    void this.flushPending().catch((error: unknown) => {
      this.logger.error(
        `Failed to flush queued MQTT messages: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  };

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('MQTT_DISABLED') === 'true') {
      this.logger.warn('MQTT disabled; continuing without broker connection');
      return;
    }

    const brokerUrl = this.config.getOrThrow<string>('MQTT_BROKER_URL');
    const client = connect(brokerUrl);
    this.client = client;
    client.on('connect', this.handleReconnect);

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

    const topicSchema = Object.values(MQTT_TOPICS).find(
      (schema) => schema.topic === topic,
    );
    if (!topicSchema) {
      throw new Error(`Unsupported MQTT topic: ${topic}`);
    }

    if (qos !== topicSchema.qos) {
      throw new Error(
        `Invalid QoS ${qos} for MQTT topic "${topic}"; expected ${topicSchema.qos}`,
      );
    }

    const missingFields = topicSchema.fields.filter(
      (field) =>
        !Object.prototype.hasOwnProperty.call(payload, field) ||
        payload[field] === undefined ||
        payload[field] === null,
    );
    if (missingFields.length > 0) {
      throw new Error(
        `Invalid payload for MQTT topic "${topic}"; missing fields: ${missingFields.join(', ')}`,
      );
    }

    const json = JSON.stringify(payload);
    const byteLen = Buffer.byteLength(json, 'utf8');
    const client = this.client;

    if (!client.connected || this.pendingPublishes.length > 0) {
      this.pendingPublishes.push({ topic, payload: json, qos, byteLen });
      if (client.connected) {
        await this.flushPending();
      }
      return;
    }

    await this.publishAndLog(client, { topic, payload: json, qos, byteLen });
  }

  private async flushPending(): Promise<void> {
    const client = this.client;
    if (!client?.connected || this.pendingPublishes.length === 0) {
      return;
    }
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = (async () => {
      while (client.connected && this.pendingPublishes.length > 0) {
        const pending = this.pendingPublishes[0];
        await this.publishAndLog(client, pending);
        this.pendingPublishes.shift();
      }
    })().finally(() => {
      this.flushPromise = undefined;
    });

    return this.flushPromise;
  }

  private async publishAndLog(
    client: MqttClient,
    message: { topic: string; payload: string; qos: QoS; byteLen: number },
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      client.publish(message.topic, message.payload, { qos: message.qos }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await this.logMqttEvent(message.topic, message.byteLen);
  }

  private async logMqttEvent(topic: string, payloadBytes: number): Promise<void> {
    const { error } = await this.supabase.from('mqtt_events').insert({
      topic,
      payload_size: payloadBytes,
      created_at: new Date().toISOString(),
    });

    if (error) {
      const message = `Failed to log MQTT event for topic "${topic}": ${error.message}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }
}
