import { Fragment, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import endpoints from '../services/api.js';
import Icon from '../components/Icon.jsx';
import { EmptyState, PageHeader, Spinner } from '../components/ui.jsx';

// Renders GET /users/structure — the org hierarchy: admins, trainers, then each
// department (manager + employees + the "reports to" chain), then unassigned
// players. Org-bound admins get a single flat structure; SUPER_ADMIN gets
// { multi: true, organizations: [{ organization, ...structure }] } and we render
// one <OrgStructure/> block per organization with a client-side org filter.
// Read-only insight view; gated by the `users` resource.

const ROLE_CHIP = {
  SUPER_ADMIN: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
  ADMIN: 'bg-neon/10 text-neon border-neon/20',
  MANAGER: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  TRAINER: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  EMPLOYEE: 'bg-white/10 text-white/70 border-white/15',
  GUEST: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
};

function RoleChip({ role }) {
  const cls = ROLE_CHIP[role] || ROLE_CHIP.EMPLOYEE;
  return (
    <span className={`chip border text-[10px] ${cls}`}>
      {role}
      {role === 'GUEST' && <span className="opacity-80"> · demo</span>}
    </span>
  );
}

function initialsOf(person) {
  const src = person?.name || person?.email || '?';
  const parts = src.trim().split(/\s+/).filter(Boolean);
  const init = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : src.slice(0, 2);
  return init.toUpperCase();
}

function Avatar({ person, size = 'w-9 h-9' }) {
  if (person?.avatarUrl) {
    return <img src={person.avatarUrl} alt="" className={`${size} rounded-xl object-cover shrink-0`} />;
  }
  return (
    <div
      className={`${size} rounded-xl bg-gradient-to-br from-neon/25 to-royal/25 border border-white/10 grid place-items-center text-xs font-bold text-white/80 shrink-0`}
    >
      {initialsOf(person)}
    </div>
  );
}

function PersonCard({ person, highlight = false, note }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
        highlight
          ? 'bg-neon/[0.07] border-neon/25 shadow-neon/10'
          : 'bg-white/[0.03] border-white/10'
      }`}
    >
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{person.name || '—'}</span>
          <RoleChip role={person.role} />
        </div>
        <div className="text-xs text-white/40 truncate">{person.email}</div>
        {note && <div className="text-[11px] text-neon/70 mt-0.5">{note}</div>}
      </div>
    </div>
  );
}

function StatChip({ label, value, compact = false }) {
  return (
    <div
      className={`glass rounded-xl flex items-baseline gap-2 ${
        compact ? 'px-3 py-1.5' : 'px-4 py-2.5'
      }`}
    >
      <span className={`font-extrabold text-neon ${compact ? 'text-sm' : 'text-lg'}`}>{value ?? 0}</span>
      <span className="text-xs text-white/50">{label}</span>
    </div>
  );
}

function TotalsRow({ totals = {}, compact = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatChip label="admins" value={totals.admins} compact={compact} />
      <StatChip label="managers" value={totals.managers} compact={compact} />
      <StatChip label="trainers" value={totals.trainers} compact={compact} />
      <StatChip label="players" value={totals.players} compact={compact} />
      <StatChip label="departments" value={totals.departments} compact={compact} />
    </div>
  );
}

function SectionTitle({ title, hint }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 mb-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">{title}</h2>
      {hint && <span className="text-xs text-white/35">{hint}</span>}
    </div>
  );
}

function ReportsToLine({ people, prefix = 'reports to' }) {
  if (!people?.length) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/35 mt-3">
      <span>{prefix}</span>
      <Icon name="chevronRight" className="w-3.5 h-3.5" />
      <span className="text-white/55">{people.map((p) => p.name || p.email).join(', ')}</span>
    </div>
  );
}

// The role ladder from `hierarchy` — SUPER ADMIN → ADMIN → … — with GUEST
// rendered after EMPLOYEE as a muted "demo" chip (guests aren't a real rung).
function HierarchyLadder({ roles }) {
  if (!roles?.length) return null;
  return (
    <div className="glass rounded-2xl px-5 py-4 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {roles.map((role, i) => (
          <Fragment key={role}>
            {i > 0 && <Icon name="chevronRight" className="w-4 h-4 text-white/25 shrink-0" />}
            <span
              className={`chip border ${
                role === 'GUEST'
                  ? 'bg-white/5 text-white/40 border-white/10'
                  : ROLE_CHIP[role] || ROLE_CHIP.EMPLOYEE
              }`}
            >
              {role.replace(/_/g, ' ')}
              {role === 'GUEST' && <span className="opacity-80"> · demo</span>}
            </span>
          </Fragment>
        ))}
      </div>
      <div className="text-xs text-white/40 mt-2">Progress reports flow up this chain.</div>
    </div>
  );
}

function structureIsEmpty(data) {
  return (
    !data?.admins?.length &&
    !data?.trainers?.length &&
    !data?.departments?.length &&
    !data?.unassigned?.employees?.length
  );
}

// One organization's full hierarchy — shared by the single-org shape and each
// entry of the multi-org (super admin) shape. In multi mode the totals live in
// the org header, so `showTotals` is turned off there.
function OrgStructure({ data, showTotals = true }) {
  const departments = data?.departments || [];
  const unassigned = data?.unassigned || { employees: [], reportsTo: [] };

  return (
    <div className="space-y-8">
      {showTotals && <TotalsRow totals={data?.totals} />}

      {/* Organization admins */}
      <section>
        <SectionTitle title="Organization Admins" hint="the top of every reporting chain" />
        {data?.admins?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.admins.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/35">No organization admins.</div>
        )}
      </section>

      {/* Trainers */}
      <section>
        <SectionTitle title="Trainers" hint="author content — not a reporting line" />
        {data?.trainers?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.trainers.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/35">No trainers yet.</div>
        )}
      </section>

      {/* Departments */}
      <section>
        <SectionTitle title="Departments" hint="each team's manager receives its players' progress" />
        {departments.length ? (
          <div className="space-y-4">
            {departments.map((dept) => (
              <div key={dept.id} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-white/50">
                    <Icon name="building" className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">{dept.name}</h3>
                  <span className="text-xs text-white/35">
                    {dept.employees?.length || 0} {dept.employees?.length === 1 ? 'player' : 'players'}
                  </span>
                </div>

                {dept.manager ? (
                  <div className="mb-3 max-w-md">
                    <PersonCard
                      person={dept.manager}
                      highlight
                      note="Manager — receives this team's progress"
                    />
                  </div>
                ) : (
                  <div className="mb-3 text-xs text-amber-300/80">
                    No manager assigned — progress reports to the organization admins.
                  </div>
                )}

                {dept.employees?.length ? (
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {dept.employees.map((p) => (
                      <PersonCard key={p.id} person={p} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-white/35">No players in this department.</div>
                )}

                <ReportsToLine people={dept.reportsTo} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/35">No departments yet.</div>
        )}
      </section>

      {/* Unassigned players */}
      {unassigned.employees?.length > 0 && (
        <section>
          <SectionTitle
            title="Unassigned players"
            hint="not in any department — report directly to the organization admins"
          />
          <div className="glass rounded-2xl p-5">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {unassigned.employees.map((p) => (
                <PersonCard key={p.id} person={p} />
              ))}
            </div>
            <ReportsToLine people={unassigned.reportsTo} />
          </div>
        </section>
      )}
    </div>
  );
}

export default function TeamStructure() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orgFilter, setOrgFilter] = useState(''); // multi mode: '' = all orgs

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await endpoints.insight.structure());
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isMulti = !!data?.multi;
  const orgs = isMulti ? data.organizations || [] : [];
  const visibleOrgs = orgFilter
    ? orgs.filter((o) => String(o.organization?.id) === orgFilter)
    : orgs;
  const isEmpty = data && (isMulti ? orgs.length === 0 : structureIsEmpty(data));

  return (
    <div>
      <PageHeader
        title="Team Structure"
        subtitle="Who runs the platform and where each player's progress reports"
        icon="layers"
        actions={
          <button onClick={load} className="btn-ghost !px-3" title="Refresh">
            <Icon name="refresh" className="w-4 h-4" />
          </button>
        }
      />

      {loading ? (
        <div className="py-24 grid place-items-center text-neon">
          <Spinner className="w-7 h-7" />
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-10 text-center">
          <div className="text-red-300 font-semibold mb-1">Couldn&apos;t load the team structure</div>
          <div className="text-sm text-white/40 mb-4">{error}</div>
          <button onClick={load} className="btn-primary">
            Retry
          </button>
        </div>
      ) : isEmpty ? (
        <>
          <HierarchyLadder roles={data?.hierarchy} />
          <div className="glass rounded-2xl">
            <EmptyState
              icon="users"
              title={isMulti ? 'No organizations yet' : 'No people yet'}
              hint={
                isMulti
                  ? 'Create organizations and users to see their hierarchies here.'
                  : 'Create users and departments to see the organization hierarchy here.'
              }
            />
          </div>
        </>
      ) : isMulti ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <HierarchyLadder roles={data.hierarchy} />

          {/* Platform-level accounts — above every organization */}
          {data.superAdmins?.length > 0 && (
            <section className="glass rounded-2xl p-6">
              <SectionTitle title="Platform Super Admins" hint="Manage every organization" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.superAdmins.map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            </section>
          )}

          {/* Org filter — client-side, just hides sections */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="field !w-auto"
            >
              <option value="">All organizations</option>
              {orgs.map((o) => (
                <option key={o.organization?.id} value={String(o.organization?.id)}>
                  {o.organization?.name || o.organization?.slug || `#${o.organization?.id}`}
                </option>
              ))}
            </select>
            <span className="text-xs text-white/35">
              showing {visibleOrgs.length} of {orgs.length}{' '}
              {orgs.length === 1 ? 'organization' : 'organizations'}
            </span>
          </div>

          {visibleOrgs.length === 0 ? (
            <div className="glass rounded-2xl">
              <EmptyState icon="building" title="No matching organization" hint="Adjust the filter above." />
            </div>
          ) : (
            visibleOrgs.map((entry) => (
              <section key={entry.organization?.id} className="glass rounded-2xl p-6">
                {/* Org header: name + slug chip + this org's totals */}
                <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon/20 to-royal/20 border border-white/10 grid place-items-center text-neon shrink-0">
                    <Icon name="building" className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-lg font-extrabold tracking-tight text-white truncate">
                      {entry.organization?.name || '—'}
                    </h2>
                    {entry.organization?.slug && (
                      <span className="chip bg-white/10 text-white/60 border border-white/15 font-mono text-[10px]">
                        {entry.organization.slug}
                      </span>
                    )}
                  </div>
                  <div className="ml-auto">
                    <TotalsRow totals={entry.totals} compact />
                  </div>
                </div>
                <OrgStructure data={entry} showTotals={false} />
              </section>
            ))
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <HierarchyLadder roles={data.hierarchy} />
          <OrgStructure data={data} />
        </motion.div>
      )}
    </div>
  );
}
