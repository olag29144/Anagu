import { useEffect, useRef } from 'react';
import { connect, MqttClient } from 'mqtt';

/**
 * React hook that connects to the MQTT broker, subscribes to a topic, and
 * invokes `onMessage` for every incoming message.
 *
 * The connection is closed and cleaned up when the component unmounts or when
 * `topic` / `onMessage` change.
 *
 * @param topic     MQTT topic string to subscribe to.
 * @param onMessage Callback invoked with the raw topic string and the parsed
 *                  payload (JSON when parseable, raw string otherwise).
 */
export function useMqtt(
  topic: string,
  onMessage: (topic: string, payload: unknown) => void,
): void {
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    const brokerUrl =
      process.env.EXPO_PUBLIC_MQTT_URL ?? 'ws://localhost:8083/mqtt';

    const client = connect(brokerUrl);
    clientRef.current = client;

    client.on('connect', () => {
      client.subscribe(topic);
    });

    client.on('message', (t: string, message: Buffer) => {
      try {
        const parsed: unknown = JSON.parse(message.toString());
        onMessage(t, parsed);
      } catch {
        onMessage(t, message.toString());
      }
    });

    return () => {
      client.end();
    };
  }, [topic, onMessage]);
}
