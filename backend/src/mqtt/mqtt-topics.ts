export type QoS = 0 | 1 | 2;

export interface MqttTopicSchema {
  topic: string;
  qos: QoS;
  fields: string[];
}

export const MQTT_TOPICS = {
  REGISTRATION_STATUS: {
    topic: 'land/registration/status',
    qos: 1 as QoS,
    fields: ['applicationId', 'status', 'timestamp'],
  },
  TITLE_ISSUED: {
    topic: 'land/title/issued',
    qos: 1 as QoS,
    fields: ['tokenId', 'owner', 'parcelId', 'timestamp'],
  },
  TITLE_REVOKED: {
    topic: 'land/title/revoked',
    qos: 2 as QoS,
    fields: ['tokenId', 'ground', 'revokedBy', 'timestamp'],
  },
  VERIFICATION_RESULT: {
    topic: 'land/verification/result',
    qos: 1 as QoS,
    fields: ['applicationId', 'outcome', 'timestamp'],
  },
} as const satisfies Record<string, MqttTopicSchema>;
