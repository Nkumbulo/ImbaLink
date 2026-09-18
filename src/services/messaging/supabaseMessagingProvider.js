import { MessagingProvider } from "./messagingProvider";
import { supabase } from "../supabase";
import { isOnline } from "./provider/shared";
import { connectionStateMethods } from "./provider/connectionState";
import { realtimeSubscriptionMethods } from "./provider/realtimeSubscriptions";
import { conversationResolutionMethods } from "./provider/conversationResolution";
import { conversationLoadingMethods } from "./provider/conversationLoading";
import { messageActionMethods } from "./provider/messageActions";

/**
 * Supabase-backed messaging implementation.
 *
 * IMPORTANT: this reuses ImbaLink's existing `db` (services/database.js)
 * for persistence instead of inventing a second, parallel store. `db`
 * already scopes every read/write to the signed-in account (see
 * `setActiveUser`) and already persists messages under the exact same
 * `contractor_<id>` / `<propertyId>` thread-key convention this provider
 * uses as `conversationId`. That means:
 *
 *   - Messages sent before this refactor are still there, unchanged.
 *   - Property threads resolve to the real listing owner.
 *   - There is no automated landlord reply; the recipient must send their own response.
 *   - Anything else in the app that still writes through `addMessage`
 *     (there is exactly one such call site, App.jsx's `sendMessage`) stays
 *     perfectly consistent with what the Messages page shows, because
 *     both read the same underlying store.
 *
 * FILE STRUCTURE (post file-size cleanup pass): this class's ~1200 lines
 * of methods now live in ./provider/*.js, grouped by domain (connection
 * state, realtime subscriptions, conversation identity resolution,
 * conversation fetching/construction, message send/read actions) and
 * mixed onto this class's prototype below via Object.assign. This is
 * purely a structural split — every method's behavior is byte-for-byte
 * unchanged from before. `this` inside a mixed-in method is still always
 * the real provider instance: JS resolves `this` for `instance.method()`
 * by the call site, not by which file originally defined the method, so
 * cross-method calls (e.g. sendMessage in messageActions.js calling
 * this._resolveConversationMeta from conversationResolution.js) work
 * exactly as if everything were still in one file. Verified this
 * empirically before splitting anything.
 */

export class SupabaseMessagingProvider extends MessagingProvider {
  constructor() {
    super();
    this._messageListeners = new Map(); // conversationId -> Set<callback>
    this._conversationListeners = new Set();
    this._connectionListeners = new Set();
    this._connectionState = isOnline() ? "online" : "offline";
    this._contractorsCache = null;
    this._currentUserId = null;

    // Per-conversation channel objects, keyed by conversation id, reused by
    // sendTypingSignal() below so typing broadcasts ride the SAME channel
    // subscribeToMessages already opened for that conversation instead of
    // opening a second one — avoids a duplicate realtime subscription per
    // open chat purely for typing state.
    this._messageChannels = new Map();

    // Inbox subscriptions are independent consumers (the navbar badge and
    // Messages inbox both subscribe). Deduplication therefore lives inside
    // each subscription instead of a provider-global Set; otherwise the first
    // subscriber to receive an INSERT could suppress the same event from the
    // second subscriber and leave its UI stale.
    this._messageCacheQueues = new Map();


    // Cache the authenticated id once. Calling auth.getUser() inside every
    // Realtime INSERT/UPDATE handler can serialize network/native bridge work
    // on Capacitor and make iOS feel frozen while a message is being sent.
    supabase.auth.getUser().then(({ data }) => {
      this._currentUserId = data?.user?.id ? String(data.user.id) : null;
    }).catch(() => {});
    supabase.auth.onAuthStateChange((_event, session) => {
      this._currentUserId = session?.user?.id ? String(session.user.id) : null;
    });

    if (typeof window !== "undefined") {
      window.addEventListener("offline", () => this._setConnectionState("offline"));
      window.addEventListener("online", () => {
        // Real reconnects usually need a beat to re-establish a socket —
        // surface that as a distinct "reconnecting" step instead of
        // snapping straight back to "online".
        this._setConnectionState("reconnecting");
        this._setConnectionState("online");
      });
    }
  }
}

Object.assign(
  SupabaseMessagingProvider.prototype,
  connectionStateMethods,
  realtimeSubscriptionMethods,
  conversationResolutionMethods,
  conversationLoadingMethods,
  messageActionMethods
);

export function createSupabaseMessagingProvider() {
  return new SupabaseMessagingProvider();
}
