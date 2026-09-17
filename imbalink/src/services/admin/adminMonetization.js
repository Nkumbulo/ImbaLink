import { rpc } from "../../core/data/rpc";
export const getMonetizationConfig = async () => (await rpc("get_monetization_config")) || { enabled: false };
export const setMonetizationEnabled = (enabled) => rpc("set_monetization_enabled", { p_enabled: Boolean(enabled) });
export const getMonetizationAnalytics = async (days = 30) => (await rpc("get_monetization_analytics", { p_days: days })) || {};
