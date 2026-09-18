/**
 * Application composition boundary.
 *
 * Features consume this backend port rather than importing a provider SDK or
 * provider-specific adapter. The concrete implementation is selected here.
 */
export { backend } from '../../infrastructure/supabase/backend.js';
