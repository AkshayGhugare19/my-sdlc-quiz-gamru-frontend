import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import endpoints, { resourceApi } from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';
import { EmptyState, PageHeader, Spinner, formatCell, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import ResourceForm from './ResourceForm.jsx';

// Generic, reusable CRUD admin page.
// Props:
//   resourceKey  — key into `endpoints` (e.g. 'users', 'missions')
//   title, subtitle, icon
//   columns  — [{ key, label, render?(value,row), className? }]
//   fields   — ResourceForm field config for create/edit
//   filters  — [{ name, label, options }] rendered as <select> filters
//   singular — noun for the "New X" button / modal titles
//   rowActions — optional (row, reload) => ReactNode extra actions
//   onRowClick — optional (row) => void  (e.g. open mission builder)
//   fixedParams — optional object merged into EVERY list request (e.g. force
//                 role=EMPLOYEE,GUEST); user filters may narrow it further.
export default function ResourceTable({
  resourceKey,
  resource,
  title,
  subtitle,
  icon,
  columns,
  fields,
  filters = [],
  singular,
  rowActions,
  onRowClick,
  fixedParams,
  headerExtras, // optional ReactNode rendered next to the "New X" button
  pageSize = 10,
}) {
  const api = resourceApi(resourceKey);
  const toast = useToast();
  const noun = singular || title?.replace(/s$/, '') || 'Item';

  // Resource key for permission checks — the kebab route path. Falls back to the
  // config's resourceKey when a `resource` prop isn't supplied.
  const permResource = resource || resourceKey;
  const can = useAuthStore((s) => s.can);
  const canCreate = can(permResource, 'create');
  const canUpdate = can(permResource, 'update');
  const canDelete = can(permResource, 'delete');

  // Cross-tenant context: a SUPER ADMIN browsing WITHOUT "acting as" one org
  // sees every tenant's rows mixed together (the seed's demo org plus any org
  // created in the app) — what looks like duplicates is per-org copies. Add an
  // Organization column + filter so ownership is obvious and narrowable.
  const user = useAuthStore((s) => s.user);
  const actingOrg = useAuthStore((s) => s.actingOrg);
  const isSuper = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN';
  const crossTenant = isSuper && !actingOrg && resourceKey !== 'organizations';
  const [orgs, setOrgs] = useState([]);
  useEffect(() => {
    if (!crossTenant) return undefined;
    let alive = true;
    endpoints.organizations
      .list({ pageSize: 200 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.items || [];
        if (alive) setOrgs(list);
      })
      .catch(() => {}); // column simply shows the raw id if orgs can't load
    return () => {
      alive = false;
    };
  }, [crossTenant]);
  const orgName = (id) => orgs.find((o) => String(o.id) === String(id))?.name;
  const effColumns = crossTenant
    ? [
        ...columns,
        {
          key: 'organizationId',
          label: 'Organization',
          render: (v) =>
            v ? (
              <span className="chip bg-white/10 text-white/70 border border-white/15">
                {orgName(v) || `${String(v).slice(0, 8)}…`}
              </span>
            ) : (
              <span className="chip bg-neon/10 text-neon border border-neon/20">Platform</span>
            ),
        },
      ]
    : columns;

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterVals, setFilterVals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // row being edited (null = create)
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null); // top-level submit error message
  const [formFieldErrors, setFormFieldErrors] = useState(null); // { field: message }
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const debounceRef = useRef();

  // Keep fixedParams in a ref and key the loader on its serialized form so an
  // inline object literal doesn't retrigger loads on every render.
  const fixedRef = useRef(fixedParams);
  fixedRef.current = fixedParams;
  const fixedKey = JSON.stringify(fixedParams || null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, pageSize, ...(fixedRef.current || {}) };
      if (search) params.search = search;
      for (const [k, v] of Object.entries(filterVals)) if (v) params[k] = v;
      const res = await api.list(params);
      // Support both { items, pagination } and bare arrays.
      const list = Array.isArray(res) ? res : res?.items || [];
      setItems(list);
      setPagination(
        res?.pagination || { page, pageSize, total: list.length, totalPages: 1 },
      );
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, page, pageSize, search, filterVals, fixedKey]);

  useEffect(() => {
    load();
  }, [load]);

  const onSearchChange = (v) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(v);
    }, 350);
  };

  const clearFormErrors = () => {
    setFormError(null);
    setFormFieldErrors(null);
  };
  const openCreate = () => {
    clearFormErrors();
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (row) => {
    clearFormErrors();
    setEditing(row);
    setModalOpen(true);
  };

  const submitForm = async (payload) => {
    setSubmitting(true);
    clearFormErrors();
    try {
      if (editing) {
        await api.update(editing.id, payload);
        toast(`${noun} updated`);
      } else {
        await api.create(payload);
        toast(`${noun} created`);
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      // Keep the modal open and surface the backend's message + field errors.
      setFormError(e.message);
      setFormFieldErrors(e.fieldErrors || null);
      toast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async (row) => {
    setDeletingId(row.id);
    try {
      await api.remove(row.id);
      toast(`${noun} deleted`);
      setConfirmDel(null);
      // Step back a page if we just emptied the last one.
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const { page: curPage, totalPages, total } = pagination;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        actions={
          <>
            {headerExtras}
            {canCreate ? (
              <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                <Icon name="plus" className="w-4 h-4" />
                New {noun}
              </button>
            ) : null}
          </>
        }
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            defaultValue=""
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${title?.toLowerCase()}…`}
            className="field !pl-9"
          />
        </div>
        {filters.map((f) => (
          <select
            key={f.name}
            value={filterVals[f.name] || ''}
            onChange={(e) => {
              setPage(1);
              setFilterVals((s) => ({ ...s, [f.name]: e.target.value }));
            }}
            className="field !w-auto"
          >
            <option value="">{f.label}: all</option>
            {f.options.map((o) => {
              const val = typeof o === 'object' ? o.value : o;
              const lbl = typeof o === 'object' ? o.label : o;
              return (
                <option key={val} value={val}>
                  {lbl}
                </option>
              );
            })}
          </select>
        ))}
        {/* Super admin only: narrow the cross-tenant view to one organization. */}
        {crossTenant && orgs.length > 0 && (
          <select
            value={filterVals.organizationId || ''}
            onChange={(e) => {
              setPage(1);
              setFilterVals((s) => ({ ...s, organizationId: e.target.value }));
            }}
            className="field !w-auto"
          >
            <option value="">Organization: all</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={load} className="btn-ghost !px-3" title="Refresh">
          <Icon name="refresh" className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/45 text-xs uppercase tracking-wider border-b border-white/10">
                {effColumns.map((c) => (
                  <th key={c.key} className="font-semibold px-4 py-3 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                <th className="font-semibold px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={effColumns.length + 1} className="py-16 text-center text-white/40">
                    <Spinner className="w-6 h-6 mx-auto text-neon" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={effColumns.length + 1} className="py-12 text-center text-red-300">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={effColumns.length + 1}>
                    <EmptyState title={`No ${title?.toLowerCase()} found`} hint={`Create your first ${noun.toLowerCase()}.`} />
                  </td>
                </tr>
              ) : (
                items.map((row, i) => (
                  <motion.tr
                    key={row.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={`border-b border-white/5 hover:bg-white/[0.03] transition ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {effColumns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 align-middle ${c.className || 'text-white/80'}`}>
                        {c.render ? c.render(row[c.key], row) : formatCell(row[c.key])}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {rowActions?.(row, load)}
                        {canUpdate && (
                          <button
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
                            title="Edit"
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setConfirmDel(row)}
                            className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5 transition"
                            title="Delete"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-sm text-white/50">
          <div>
            {total} {total === 1 ? 'item' : 'items'}
            {totalPages > 1 && <span className="text-white/30"> · page {curPage} of {totalPages}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={curPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-ghost !px-2 !py-1.5"
            >
              <Icon name="chevronLeft" className="w-4 h-4" />
            </button>
            <button
              disabled={curPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-ghost !px-2 !py-1.5"
            >
              <Icon name="chevronRight" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          clearFormErrors();
        }}
        title={editing ? `Edit ${noun}` : `New ${noun}`}
        subtitle={editing ? `Update this ${noun.toLowerCase()}` : `Create a new ${noun.toLowerCase()}`}
      >
        <ResourceForm
          fields={fields}
          initial={editing}
          submitting={submitting}
          submitLabel={editing ? 'Save changes' : `Create ${noun}`}
          error={formError}
          fieldErrors={formFieldErrors}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
            clearFormErrors();
          }}
          onSubmit={submitForm}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title={`Delete ${noun}?`} maxWidth="max-w-md">
        <p className="text-white/60 text-sm mb-6">
          This will permanently delete{' '}
          <span className="text-white font-semibold">
            {confirmDel?.title || confirmDel?.name || confirmDel?.email || confirmDel?.slug || `#${confirmDel?.id}`}
          </span>
          . This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={() => doDelete(confirmDel)}
            disabled={deletingId === confirmDel?.id}
            className="btn-danger flex items-center gap-2"
          >
            {deletingId === confirmDel?.id && <Spinner className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
