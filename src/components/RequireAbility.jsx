import { useAuthStore } from '../store/authStore.js';
import Icon from './Icon.jsx';

// Page-level authorization gate. Renders `children` only when the current user
// can perform `action` on `resource`; otherwise shows a friendly access panel.
export default function RequireAbility({ resource, action = 'view', children }) {
  const can = useAuthStore((s) => s.can);

  if (resource && !can(resource, action)) {
    return (
      <div className="grid place-items-center py-24">
        <div className="glass rounded-2xl p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center mx-auto mb-4 text-white/40">
            <Icon name="logout" className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">No access to this section</h2>
          <p className="text-sm text-white/45 mt-1.5">
            You don&apos;t have permission to view this area. If you think this is a mistake, contact
            your administrator.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
