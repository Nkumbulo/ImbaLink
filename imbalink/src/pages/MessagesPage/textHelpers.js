export function getFirstName(name) {
  const value = String(name || "").trim();
  return value ? value.split(/\s+/)[0] : "";
}
