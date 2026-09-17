// Account lifecycle policy is kept independent from persistence. The adapter
// supplies the persistence/cache operations at the infrastructure boundary.
export function createAccountService({ setIdentityUser, activeUserKey, invalidatePropertyCache, resetContractorCache, removeSession, deleteRows }) {
  const setActiveUser = (userId) => {
    setIdentityUser(userId);
    invalidatePropertyCache();
  };

  const clearCache = () => {
    invalidatePropertyCache();
    resetContractorCache();
  };

  const clearUserData = async () => {
    const userId = activeUserKey();
    if (!userId) return;
    const tables = [
      'property_likes', 'property_saves', 'contractor_likes', 'viewing_requests',
      'student_interests', 'quote_requests', 'student_share_requests', 'registrations',
    ];
    for (const table of tables) await deleteRows(table, userId);
    await deleteRows('conversation_participants', userId);
    await removeSession();
    clearCache();
  };

  return { setActiveUser, clearCache, clearUserData };
}

//: account lifecycle policy extracted from legacy db/account.js.
