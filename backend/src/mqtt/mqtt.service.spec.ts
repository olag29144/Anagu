import * as fc from 'fast-check';
import { ConfigService } from '@nestjs/config';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { MQTT_TOPICS, MqttTopicSchema } from './mqtt-topics';
import { MqttService } from './mqtt.service';

describe('MqttService', () => {
  const topicSchemas = Object.values(MQTT_TOPICS) as MqttTopicSchema[];
  let service: MqttService;
  let clientMock: {
    connected: boolean;
    publish: jest.Mock;
    end: jest.Mock;
  };
  let insertMock: jest.Mock;

  beforeEach(() => {
    insertMock = jest.fn().mockResolvedValue({ error: null });
    const supabaseMock = {
      from: jest.fn().mockReturnValue({ insert: insertMock }),
    };
    const configMock = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    service = new MqttService(
      configMock as unknown as ConfigService,
      supabaseMock as unknown as SupabaseClientService,
    );
    clientMock = {
      connected: true,
      publish: jest
        .fn()
        .mockImplementation(
          (
            _topic: string,
            _payload: string,
            _options: { qos: number },
            callback: (error?: Error | null) => void,
          ) => callback(null),
        ),
      end: jest.fn(),
    };
    Object.defineProperty(service, 'client', { value: clientMock });
  });

  it('queues messages while disconnected and flushes them in order after reconnect', async () => {
    const schema = MQTT_TOPICS.REGISTRATION_STATUS;
    const firstPayload = {
      applicationId: 'app-1',
      status: 'submitted',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const secondPayload = {
      applicationId: 'app-2',
      status: 'submitted',
      timestamp: '2026-01-01T00:00:01.000Z',
    };
    clientMock.connected = false;

    await service.publish(schema.topic, firstPayload, schema.qos);
    await service.publish(schema.topic, secondPayload, schema.qos);

    expect(clientMock.publish).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();

    clientMock.connected = true;
    await (
      service as unknown as { flushPending: () => Promise<void> }
    ).flushPending();

    expect(clientMock.publish.mock.calls.map((call) => call[1])).toEqual([
      JSON.stringify(firstPayload),
      JSON.stringify(secondPayload),
    ]);
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it.each(topicSchemas)(
    'publishes valid payloads to $topic with the configured QoS and logs their byte size',
    async (schema) => {
      const values = fc.string({ maxLength: 80 });
      const payloadArbitrary = fc
        .tuple(...schema.fields.map(() => values))
        .map((fieldValues) =>
          Object.fromEntries(
            schema.fields.map((field, index) => [field, fieldValues[index]]),
          ),
        );

      await fc.assert(
        fc.asyncProperty(payloadArbitrary, async (payload) => {
          clientMock.publish.mockClear();
          insertMock.mockClear();

          await service.publish(schema.topic, payload, schema.qos);

          const serialized = JSON.stringify(payload);
          expect(clientMock.publish).toHaveBeenCalledWith(
            schema.topic,
            serialized,
            { qos: schema.qos },
            expect.any(Function),
          );
          expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
              topic: schema.topic,
              payload_size: Buffer.byteLength(serialized, 'utf8'),
            }),
          );
          expect(Buffer.byteLength(serialized, 'utf8')).toBeGreaterThan(0);
        }),
        { numRuns: 25 },
      );
    },
  );

  it('rejects unknown topics and payloads missing required fields', async () => {
    await expect(
      service.publish('land/unknown', {}, 1),
    ).rejects.toThrow('Unsupported MQTT topic');
    await expect(
      service.publish(MQTT_TOPICS.TITLE_ISSUED.topic, {}, MQTT_TOPICS.TITLE_ISSUED.qos),
    ).rejects.toThrow('missing fields');

    expect(clientMock.publish).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects a QoS value that differs from the topic schema', async () => {
    await expect(
      service.publish(
        MQTT_TOPICS.TITLE_REVOKED.topic,
        {
          tokenId: '1',
          ground: 'OverridingPublicInterest',
          revokedBy: 'governor-1',
          timestamp: new Date().toISOString(),
        },
        1,
      ),
    ).rejects.toThrow('expected 2');

    expect(clientMock.publish).not.toHaveBeenCalled();
  });

  it('rejects when MQTT event logging fails after publish', async () => {
    insertMock.mockResolvedValueOnce({
      error: { message: 'database unavailable' },
    });

    await expect(
      service.publish(
        MQTT_TOPICS.VERIFICATION_RESULT.topic,
        {
          applicationId: 'app-1',
          outcome: 'SuccessfullyVerified',
          timestamp: new Date().toISOString(),
        },
        MQTT_TOPICS.VERIFICATION_RESULT.qos,
      ),
    ).rejects.toThrow('Failed to log MQTT event');

    expect(clientMock.publish).toHaveBeenCalledTimes(1);
  });
});
