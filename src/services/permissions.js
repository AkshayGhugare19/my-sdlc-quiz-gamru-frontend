// Pure authorization helper shared by the auth store and components.
// `abilities` is the resource→actions map returned by /auth/me:
//   { courses: ['view','create',...], users: ['view'], '*': ['*'] }
// Rules:
//   - no abilities        → deny
//   - abilities['*']      → allow everything (SUPER_ADMIN wildcard)
//   - abilities[resource] includes '*' or the action → allow
//   - otherwise           → deny
export function can(abilities, resource, action = 'view') {
  if (!abilities || typeof abilities !== 'object') return false;
  if (Array.isArray(abilities['*'])) return true; // full wildcard
  const allowed = abilities[resource];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes('*') || allowed.includes(action);
}

export default can;
