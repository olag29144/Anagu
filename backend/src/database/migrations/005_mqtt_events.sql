-- mqtt_events — system monitoring log for every MQTT publish event
CREATE TABLE IF NOT EXISTS mqtt_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic        TEXT    NOT NULL,
  payload_size INTEGER NOT NULL,        -- byte length of the serialised JSON payload
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
