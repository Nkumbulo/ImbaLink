// Mixed into SupabaseMessagingProvider.prototype (see ../supabaseMessagingProvider.js).
// `this` inside these methods is always the actual provider instance at call
// time — JS binds `this` for `instance.method()` by the call site, not by
// which file the method was physically defined in — verified this holds
// (including cross-method calls like getValue() calling another mixed-in
// method) before splitting this file at all.
export const connectionStateMethods = {
  _setConnectionState(state) {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this._connectionListeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.warn("messaging connection listener error:", err);
      }
    });
  },

  subscribeToConnectionState(callback) {
    if (typeof callback !== "function") return () => {};
    this._connectionListeners.add(callback);
    callback(this._connectionState);
    return () => this._connectionListeners.delete(callback);
  },
};
