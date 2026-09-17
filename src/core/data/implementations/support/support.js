export function createSupportService({ getCurrentUser, insertRequest }) {
  async function submitSupportRequest({ category, message, contact, kind = 'problem', pageContext = null }) {
    const auth = await getCurrentUser();
    await insertRequest({
      user_id: auth?.user?.id || null,
      kind,
      category,
      message,
      contact: contact || null,
      page_context: pageContext,
      metadata: typeof navigator !== 'undefined' ? { userAgent: navigator.userAgent } : {},
    });
  }
  return { submitSupportRequest };
}
