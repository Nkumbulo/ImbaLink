import { rpc } from "../core/data/rpc";

export function heartbeatPresence() {
  return rpc("heartbeat_presence");
}
