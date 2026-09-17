/** Infrastructure adapter: canonical account lifecycle boundary. */
import { Preferences } from '@capacitor/preferences';
import { supabase } from '../../../services/supabase.js';
import { invalidatePropertyCache } from './properties.js';
import { resetContractorCache } from '../domains/interactions.js';
import { setActiveUser as setIdentityUser, activeUserKey } from '../implementations/shared/identity.js';
import { createAccountService } from '../implementations/account/account.js';

const deleteRows = async (table, userId) => {
  const { error } = await supabase.from(table).delete().eq('user_id', userId);
  if (error) throw error;
};

const service = createAccountService({
  setIdentityUser,
  activeUserKey,
  invalidatePropertyCache,
  resetContractorCache,
  removeSession: () => Preferences.remove({ key: 'imbalink_session' }),
  deleteRows,
});

export const { setActiveUser, clearCache, clearUserData } = service;
