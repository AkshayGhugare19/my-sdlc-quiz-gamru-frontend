import { useEffect, useMemo, useState } from 'react';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import endpoints from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

// Staff only — the people who run the platform. The list query is forced to the
// staff roles (legacy aliases included); players live on the Users page.
// SUPER_ADMIN accounts are platform-level, so the form doesn't offer that role.
const STAFF_FORM_ROLES = ['ADMIN', 'MANAGER', 'TRAINER'];
const FIXED_PARAMS = { role: 'SUPER_ADMIN,PLATFORM_ADMIN,ADMIN,ORG_ADMIN,MANAGER,TRAINER' };

const base = RESOURCE_CONFIGS.users;
const STAFF_CONFIG = {
  ...base,
  title: 'System Users',
  singular: 'System User',
  subtitle: 'Admins, managers & trainers who run the platform',
  filters: base.filters.map((f) => (f.name === 'role' ? { ...f, options: STAFF_FORM_ROLES } : f)),
  fields: base.fields.map((f) =>
    f.name === 'role' ? { ...f, options: STAFF_FORM_ROLES, default: 'TRAINER' } : f,
  ),
};

// Super admins pick which organization a staff account belongs to; org-bound
// admins never see this — their created users inherit their org server-side.
const ORG_FIELD = {
  name: 'organizationId',
  label: 'Organization',
  type: 'reference',
  resource: 'organizations',
  optionLabel: 'name',
  required: true,
  help: 'Which organization this admin/manager/trainer belongs to',
};

export default function SystemUsers() {
  const isSuper = useAuthStore(
    (s) => s.user?.role === 'SUPER_ADMIN' || Array.isArray(s.user?.abilities?.['*']),
  );

  // Org id → name map so the table column shows names, never raw ids. If the
  // lookup fails the column is skipped entirely.
  const [orgNames, setOrgNames] = useState(null);
  useEffect(() => {
    if (!isSuper) return undefined;
    let alive = true;
    endpoints.organizations
      .list({ pageSize: 200 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.items || [];
        if (alive) setOrgNames(Object.fromEntries(list.map((o) => [String(o.id), o.name])));
      })
      .catch(() => {
        /* no map → no org column */
      });
    return () => {
      alive = false;
    };
  }, [isSuper]);

  const config = useMemo(() => {
    if (!isSuper) return STAFF_CONFIG;
    // Insert the Organization picker right after the role field.
    const fields = STAFF_CONFIG.fields.flatMap((f) => (f.name === 'role' ? [f, ORG_FIELD] : [f]));
    const columns = orgNames
      ? [
          ...STAFF_CONFIG.columns,
          {
            key: 'organizationId',
            label: 'Organization',
            className: 'text-white/60',
            render: (v) => (v != null && orgNames[String(v)]) || '—',
          },
        ]
      : STAFF_CONFIG.columns;
    return { ...STAFF_CONFIG, fields, columns };
  }, [isSuper, orgNames]);

  return <ResourceTable {...config} resource="users" fixedParams={FIXED_PARAMS} />;
}
