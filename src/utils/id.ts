export function newId(prefix = "id") {
  // fallback seguro (sin dependencias)
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${rand}`;
}
