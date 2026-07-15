import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import Icon from './Icon.jsx';
import gamruLogo from '../assets/gamru.svg';

const DOCUMENTATION_URL = import.meta.env.VITE_DOCUMENTATION_URL || 'http://localhost:5300/';

export default function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isSuper = useAuthStore((s) => s.isSuperAdmin());
  const actingOrg = useAuthStore((s) => s.actingOrg);
  const setActingOrg = useAuthStore((s) => s.setActingOrg);
  const navigate = useNavigate();

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      '?'
    : '?';
  const orgName =
    user?.organization?.name || user?.organizationName || (user?.organizationId ? 'Organization' : 'Platform');

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 h-16 glass-strong border-b border-white/10 flex items-center gap-4 px-4 lg:px-6">
      <div className="flex items-center lg:hidden">
        <img src={gamruLogo} alt="Gamru" className="h-7 w-auto" />
      </div>

      <div className="flex-1" />

      <a
        href={DOCUMENTATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost !px-3 !py-2 flex items-center gap-2 text-sm"
        title="Open the documentation"
      >
        <Icon name="book" className="w-4 h-4" />
        <span className="hidden sm:inline">Documentation</span>
      </a>

      {isSuper && (
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-white/40">Acting org</span>
          <input
            value={actingOrg || ''}
            onChange={(e) => setActingOrg(e.target.value.trim())}
            placeholder="all tenants"
            className="field !py-1.5 !w-40 text-xs"
            title="Super-admin: set x-organization-id to act on a specific tenant"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-right leading-tight hidden sm:block">
          <div className="text-sm font-semibold text-white flex items-center justify-end gap-2">
            {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '—'}
            {(user?.effectiveRole || user?.role) && (
              <span className="chip bg-neon/10 text-neon border border-neon/20 text-[10px] !py-0.5">
                {user.effectiveRole || user.role}
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/45">{orgName}</div>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon to-royal grid place-items-center text-night font-bold text-sm shadow-neon">
          {initials}
        </div>
        <button onClick={onLogout} className="btn-ghost !px-3 !py-2" title="Log out">
          <Icon name="logout" className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
