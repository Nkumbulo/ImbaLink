/**
 * Small runtime helper for backend ports.
 *
 * JavaScript has no native interface keyword, so contracts are represented by
 * required method names plus this validator. The validator is intentionally
 * provider-agnostic: it knows nothing about Supabase, HTTP, PostgreSQL, etc.
 */
export function assertBackendContract(name, implementation, requiredMethods = []) {
  if (!implementation || typeof implementation !== "object") {
    throw new TypeError(`${name} implementation is required.`);
  }

  for (const method of requiredMethods) {
    if (typeof implementation[method] !== "function") {
      throw new TypeError(`${name} is missing required method: ${method}()`);
    }
  }

  return implementation;
}

export function defineBackendContract(name, requiredMethods = []) {
  return Object.freeze({
    name,
    requiredMethods: Object.freeze([...requiredMethods]),
    validate(implementation) {
      return assertBackendContract(name, implementation, requiredMethods);
    },
  });
}
