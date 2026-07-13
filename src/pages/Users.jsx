import { useState } from 'react';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import EmployeeProfile from '../components/EmployeeProfile.jsx';
import { useAuthStore } from '../store/authStore.js';

// Players only — staff accounts (admins / managers / trainers) live on the
// System Users page. The list query is forced to role=EMPLOYEE,GUEST.
const PLAYER_ROLES = ['EMPLOYEE', 'GUEST'];
const FIXED_PARAMS = { role: PLAYER_ROLES.join(',') };

const base = RESOURCE_CONFIGS.users;
const PLAYER_CONFIG = {
  ...base,
  subtitle: 'Players — employees & guests',
  filters: base.filters.map((f) => (f.name === 'role' ? { ...f, options: PLAYER_ROLES } : f)),
  fields: base.fields.map((f) =>
    f.name === 'role'
      ? { ...f, options: PLAYER_ROLES, help: 'Guest = demo account — plays everything, earns nothing' }
      : f,
  ),
};

export default function Users() {
  const [profileUser, setProfileUser] = useState(null);
  const canView = useAuthStore((s) => s.can('users', 'view'));

  return (
    <>
      <ResourceTable
        {...PLAYER_CONFIG}
        resource="users"
        fixedParams={FIXED_PARAMS}
        rowActions={(row) =>
          canView ? (
            <button
              onClick={() => setProfileUser(row)}
              className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
              title="View profile"
            >
              <Icon name="badge" className="w-4 h-4" />
            </button>
          ) : null
        }
      />
      <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
        <span className="chip bg-amber-500/10 text-amber-300 border border-amber-500/20">GUEST</span>
        <span>= demo account — plays everything, earns nothing.</span>
      </div>
      <Modal
        open={!!profileUser}
        onClose={() => setProfileUser(null)}
        title={profileUser ? `${`${profileUser.firstName || ''} ${profileUser.lastName || ''}`.trim() || profileUser.email} — Profile` : 'Employee Profile'}
        subtitle="Participation, progress and standings across the platform"
        maxWidth="max-w-5xl"
      >
        {profileUser && <EmployeeProfile userId={profileUser.id} />}
      </Modal>
    </>
  );
}
