import { rpc } from "../../core/data/rpc";
export const getVerificationCenterMetrics = async () => (await rpc("get_verification_center_metrics")) || {};
export async function getVerificationDecisionHistory({ scope = "mine", status = null, store = null, limit = 100 } = {}) {
  const data = await rpc("get_verification_decision_history", { p_scope: scope, p_status: status || null, p_store_name: store || null, p_limit: limit, p_offset: 0 });
  return Array.isArray(data) ? data : [];
}
