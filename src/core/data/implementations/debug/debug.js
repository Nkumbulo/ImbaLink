export function createDebugService({ rpc }) {
  async function __debugGetAllRecords(storeName) {
    const allowed = new Set(['properties', 'registrations', 'contractors', 'student_profiles']);
    if (!allowed.has(storeName)) return [];
    const { data, error } = await rpc('get_moderation_records', { p_store_name: storeName });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }

  async function __debugListStoreNames() {
    return [
      'users', 'student_profiles', 'universities', 'properties', 'property_images',
      'contractors', 'registrations', 'property_likes', 'property_saves',
      'contractor_likes', 'viewing_requests', 'quote_requests',
      'student_share_requests', 'student_interests', 'conversations',
      'conversation_participants', 'messages',
    ];
  }

  return { __debugListStoreNames, __debugGetAllRecords };
}
