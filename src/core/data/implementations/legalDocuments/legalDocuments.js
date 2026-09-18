/**
 * Legacy compatibility implementation.
 * Canonical runtime access is provided by backend.legalDocumentRepository.
 */
export async function getPublishedLegalDocument(slug) {
  const { backend } = await import("../../../../application/backend/index.js");
  return backend.legalDocumentRepository.getPublishedLegalDocument(slug);
}
