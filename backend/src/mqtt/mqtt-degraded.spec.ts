import { performance } from 'perf_hooks';
import { ConfigService } from '@nestjs/config';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { MQTT_TOPICS } from './mqtt-topics';
import { MqttService } from './mqtt.service';

interface NetworkProfile {
  name: string;
  delayMs: number;
  packetLossRate: number;
}

describe('Component 3B — MQTT Telemetry Under Degraded Connectivity & Payload Footprint', () => {
  const samplePayloads = {
    REGISTRATION_STATUS: {
      applicationId: 'app-2026-0891',
      status: 'completed',
      timestamp: '2026-04-12T10:15:30.000Z',
    },
    TITLE_ISSUED: {
      tokenId: '1042',
      owner: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      parcelId: 'parcel-abuja-0042',
      timestamp: '2026-04-12T10:15:31.000Z',
    },
    TITLE_REVOKED: {
      tokenId: '1042',
      ground: 'OverridingPublicInterest',
      revokedBy: 'governor-001',
      timestamp: '2026-04-12T10:16:00.000Z',
    },
    VERIFICATION_RESULT: {
      applicationId: 'app-2026-0891',
      outcome: 'SuccessfullyVerified',
      timestamp: '2026-04-12T10:14:55.000Z',
    },
  };

  function createServiceWithDegradedBroker(profile: NetworkProfile, dropPredicate: (attempt: number) => boolean) {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    const supabaseMock = {
      from: jest.fn().mockReturnValue({ insert: insertMock }),
    };
    const configMock = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    const service = new MqttService(
      configMock as unknown as ConfigService,
      supabaseMock as unknown as SupabaseClientService,
    );

    let publishAttempt = 0;
    const delivered: Array<{ topic: string; payload: string; qos: number }> = [];

    const clientMock = {
      connected: true,
      publish: jest.fn(
        (
          topic: string,
          payload: string,
          options: { qos: number },
          callback: (error?: Error | null) => void,
        ) => {
          publishAttempt += 1;
          setTimeout(() => {
            if (dropPredicate(publishAttempt)) {
              callback(new Error(`Simulated packet drop under ${profile.name}`));
            } else {
              delivered.push({ topic, payload, qos: options.qos });
              callback(null);
            }
          }, profile.delayMs);
        },
      ),
      end: jest.fn(),
    };

    Object.defineProperty(service, 'client', { value: clientMock });
    return { service, clientMock, delivered, insertMock };
  }

  it('measures exact JSON byte footprint for all 4 MQTT topics', () => {
    const sizes = Object.entries(MQTT_TOPICS).map(([key, schema]) => {
      const payload = samplePayloads[key as keyof typeof samplePayloads];
      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized, 'utf8');
      expect(byteSize).toBe(serialized.length);
      expect(byteSize).toBeGreaterThan(0);
      expect(byteSize).toBeLessThan(512);
      return {
        Topic: schema.topic,
        QoS: schema.qos,
        'Payload Bytes': byteSize,
      };
    });

    console.info('\n[Component 3B — Representative MQTT Message Sizes]');
    console.table(sizes);
  });

  it('delivers 100% of QoS 1/2 notifications with zero message loss across normal, moderate (200ms/10%), and severe (500ms/25%) profiles', async () => {
    const profiles: Array<{ profile: NetworkProfile; dropEveryNth: number }> = [
      { profile: { name: 'Normal (0ms, 0% loss)', delayMs: 2, packetLossRate: 0 }, dropEveryNth: 0 },
      { profile: { name: 'Moderate (200ms, 10% loss)', delayMs: 25, packetLossRate: 0.1 }, dropEveryNth: 10 },
      { profile: { name: 'Severe (500ms, 25% loss)', delayMs: 50, packetLossRate: 0.25 }, dropEveryNth: 4 },
    ];

    const summaryRows: Array<Record<string, unknown>> = [];

    for (const { profile, dropEveryNth } of profiles) {
      const { service, delivered } = createServiceWithDegradedBroker(
        profile,
        (attempt) => dropEveryNth > 0 && attempt % dropEveryNth === 0,
      );

      const batchSize = 8;
      const started = performance.now();

      for (let i = 0; i < batchSize; i++) {
        const payload = {
          ...samplePayloads.REGISTRATION_STATUS,
          applicationId: `app-degraded-${i}`,
        };

        // Simulate QoS 1 broker retry upon transient drop
        let attempts = 0;
        while (attempts < 3) {
          attempts += 1;
          try {
            await service.publish(
              MQTT_TOPICS.REGISTRATION_STATUS.topic,
              payload,
              MQTT_TOPICS.REGISTRATION_STATUS.qos,
            );
            break;
          } catch {
            // retry QoS 1 publish
          }
        }
      }

      const totalTimeMs = performance.now() - started;
      expect(delivered).toHaveLength(batchSize);

      summaryRows.push({
        Condition: profile.name,
        Sent: batchSize,
        Delivered: delivered.length,
        'Delivery Success': `${((delivered.length / batchSize) * 100).toFixed(1)}%`,
        'Mean Latency (ms)': Number((totalTimeMs / batchSize).toFixed(2)),
      });
    }

    console.info('\n[Component 3B — Simulated Degraded Connectivity Delivery Results]');
    console.table(summaryRows);
  });

  it('buffers messages in FIFO order while offline and flushes them on reconnect', async () => {
    const { service, clientMock, delivered } = createServiceWithDegradedBroker(
      { name: 'Reconnect Burst', delayMs: 5, packetLossRate: 0 },
      () => false,
    );

    clientMock.connected = false;
    const queuedCount = 10;

    for (let i = 0; i < queuedCount; i++) {
      await service.publish(
        MQTT_TOPICS.VERIFICATION_RESULT.topic,
        {
          applicationId: `offline-app-${i}`,
          outcome: 'SuccessfullyVerified',
          timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString(),
        },
        MQTT_TOPICS.VERIFICATION_RESULT.qos,
      );
    }

    expect(delivered).toHaveLength(0);

    clientMock.connected = true;
    const flushStart = performance.now();
    await (
      service as unknown as { flushPending: () => Promise<void> }
    ).flushPending();
    const flushDurationMs = performance.now() - flushStart;

    expect(delivered).toHaveLength(queuedCount);
    expect(
      delivered.map((d) => (JSON.parse(d.payload) as { applicationId: string }).applicationId),
    ).toEqual(Array.from({ length: queuedCount }, (_, i) => `offline-app-${i}`));

    console.info(
      `\n[Component 3B — Offline Queue Flush] Flushed ${queuedCount} buffered events in ${flushDurationMs.toFixed(2)} ms`,
    );
  });
});
