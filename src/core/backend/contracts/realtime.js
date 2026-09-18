import { defineBackendContract } from "../contract";

/**
 * Realtime transport port.
 *
 * `subscribe(topic, handler)` returns an opaque subscription handle. The
 * handle is provider-owned; callers must not inspect it. `unsubscribe`
 * accepts the handle returned by `subscribe`.
 */
export const REALTIME_METHODS = [
  "subscribe",
  "unsubscribe",
];

export const realtimeContract = defineBackendContract(
  "Realtime",
  REALTIME_METHODS
);
