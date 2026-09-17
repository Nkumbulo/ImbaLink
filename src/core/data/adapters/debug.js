import { supabase } from '../../supabase/client';
import { createDebugService } from '../implementations/debug/debug';

export const MESSAGE_DISPLAY_LIMIT = 100;
export function rowToLegacyMessage(row, currentUserId) {
  return {
    id: row.id,
    from: row.sender_user_id === currentUserId ? 'me' : 'them',
    text: row.body,
    ts: new Date(row.sent_at).getTime(),
  };
}

let readyPromise = null;
export function ready() {
  if (!readyPromise) readyPromise = Promise.resolve();
  return readyPromise;
}

const service = createDebugService({
  rpc: (fn, args) => supabase.rpc(fn, args),
});

export const { __debugListStoreNames, __debugGetAllRecords } = service;
