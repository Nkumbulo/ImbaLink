/**
 * @deprecated compatibility facade.
 *
 * RPC is now implemented by infrastructure/supabase/rpc.js. Keep this
 * facade while existing domain services migrate to backend contracts.
 */
export {
  rpc,
  invokeFunction,
} from "../../infrastructure/supabase/rpc";
