import { create } from 'zustand';
import endpoints, { setToken, getToken, setActingOrg, getActingOrg } from '../services/api';
import { can as canWith } from '../services/permissions';

// Auth + session state for the admin console.
export const useAuthStore = create((set, get) => ({
  token: getToken(),
  user: null,
  actingOrg: getActingOrg(),
  loading: false,
  bootstrapping: !!getToken(), // if we have a token, we must verify it before rendering
  error: null,

  isSuperAdmin: () => get().user?.role === 'SUPER_ADMIN' || get().user?.role === 'PLATFORM_ADMIN',

  // Can the current user perform `action` on `resource`? Reads user.abilities.
  can: (resource, action = 'view') => canWith(get().user?.abilities, resource, action),

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const { user, accessToken } = await endpoints.auth.login(email, password);
      setToken(accessToken);
      set({ token: accessToken, user });
      // The login response may omit abilities — refetch /auth/me so `can()` works.
      try {
        const me = await endpoints.auth.me();
        if (me) set({ user: me });
      } catch {
        /* keep login user if /auth/me fails */
      }
      return true;
    } catch (e) {
      set({ error: e.message });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // Verify a persisted token on app boot.
  async bootstrap() {
    if (!getToken()) {
      set({ bootstrapping: false });
      return;
    }
    set({ bootstrapping: true });
    try {
      const user = await endpoints.auth.me();
      set({ user, token: getToken() });
    } catch {
      setToken(null);
      set({ token: null, user: null });
    } finally {
      set({ bootstrapping: false });
    }
  },

  logout() {
    setToken(null);
    setActingOrg(null);
    set({ token: null, user: null, actingOrg: null });
  },

  // Super-admin "act as tenant" toggle.
  setActingOrg(orgId) {
    setActingOrg(orgId || null);
    set({ actingOrg: orgId || null });
  },
}));
