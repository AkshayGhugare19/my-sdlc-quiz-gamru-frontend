import { useForm, useController, useWatch } from 'react-hook-form';
import { useEffect, useState } from 'react';
import endpoints from '../services/api.js';
import { Spinner } from './ui.jsx';
import PasswordInput from './PasswordInput.jsx';

// Renders a form from a `fields` config array and calls onSubmit with a cleaned payload.
// Field shape: { name, label, type, options?, required?, placeholder?, help?, colSpan?, min, max, step }
// type ∈ text | textarea | number | email | password | select | checkbox | slug | json | reference | multiReference
// A `reference` field: { name, label, type:'reference', resource:'mission-bundles', optionLabel:'title' }
//   - `resource` is the kebab endpoint key; options are fetched from its list endpoint.
//   - `optionLabel` is a row field name or a function(row)=>string.
// A `multiReference` field additionally supports `selectedEndpoint(id)` to preselect
//   the currently-attached rows when editing; it stores/submits an array of ids.
function coerce(field, value) {
  // A non-array multiReference value means "current selection still loading (or
  // failed to load)" — OMIT the field so the backend leaves existing links
  // untouched, instead of submitting [] and silently detaching everything.
  if (field.type === 'multiReference') return Array.isArray(value) ? value : undefined;
  if (field.type === 'answerOptions') {
    if (!Array.isArray(value)) return undefined; // still loading — leave existing options untouched
    return value
      .filter((r) => String(r.label ?? '').trim() !== '')
      .map((r) => ({ ...(r.id ? { id: r.id } : {}), label: String(r.label).trim(), isCorrect: !!r.isCorrect }));
  }
  if (field.type === 'levelBands') {
    if (!Array.isArray(value)) return undefined; // still loading — leave existing levels untouched
    // Drop incomplete rows; numbers in, blank XP End = open-ended (null).
    return value
      .filter((r) => r.level !== '' && r.level != null && r.minXp !== '' && r.minXp != null)
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        level: Number(r.level),
        minXp: Number(r.minXp),
        maxXp: r.maxXp === '' || r.maxXp == null ? null : Number(r.maxXp),
        title: r.title || undefined,
      }));
  }
  if (field.type === 'points') {
    // Storyboard panels live directly on the record (JSONB), loaded synchronously
    // from `initial` — so an array here is authoritative. Drop fully-blank rows.
    if (!Array.isArray(value)) return undefined;
    return value
      .map((p) => ({
        title: String(p.title ?? '').trim(),
        description: String(p.description ?? '').trim(),
        imageUrl: String(p.imageUrl ?? '').trim(),
        instructions: String(p.instructions ?? '').trim(),
      }))
      .filter((p) => p.title || p.description || p.imageUrl || p.instructions);
  }
  if (value === '' || value === undefined) return field.required ? value : undefined;
  if (field.type === 'number') {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  if (field.type === 'datetime') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (field.type === 'checkbox') return !!value;
  if (field.type === 'json') {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

// ISO date → the "YYYY-MM-DDTHH:mm" a datetime-local input expects (local tz).
function toDatetimeLocal(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDefaults(fields, initial) {
  const d = {};
  for (const f of fields) {
    // `valueFrom` lets a field read a nested value (e.g. row.gameConfig.questionCount).
    let v = f.valueFrom && initial ? f.valueFrom(initial) : initial?.[f.name];
    if (f.type === 'multiReference') {
      // Editing: the current selection loads asynchronously — start as undefined
      // ("not loaded yet") so a too-early save can't submit an empty selection
      // and wipe the record's existing links. New records start genuinely empty.
      d[f.name] = Array.isArray(v) ? v : initial?.id && f.selectedEndpoint ? undefined : [];
      continue;
    }
    if (f.type === 'levelBands' || f.type === 'answerOptions') {
      // Same protection as multiReference: while an existing record's rows are
      // still loading, the value is undefined and the field is omitted on save.
      d[f.name] = Array.isArray(v) ? v : initial?.id && f.selectedEndpoint ? undefined : [];
      continue;
    }
    if (f.type === 'points') {
      // Storyboard panels come inline on the record (JSONB) — no async load — so
      // normalise straight from `initial`; a new record starts with none.
      d[f.name] = Array.isArray(v)
        ? v.map((p) => ({
            title: p?.title ?? '',
            description: p?.description ?? '',
            imageUrl: p?.imageUrl ?? '',
            instructions: p?.instructions ?? '',
          }))
        : [];
      continue;
    }
    if (f.type === 'json' && v && typeof v === 'object') v = JSON.stringify(v, null, 2);
    if (f.type === 'datetime' && v) v = toDatetimeLocal(v);
    if (v === null || v === undefined) v = f.type === 'checkbox' ? f.default ?? false : f.default ?? '';
    d[f.name] = v;
  }
  return d;
}

// Resolve a kebab resource key to its `endpoints` list function.
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function refLister(resource) {
  if (!resource) return null;
  if (resource === 'media') return endpoints.media?.list || null;
  const api = endpoints[kebabToCamel(resource)];
  return api?.list || null;
}

// Human label for a reference option, per the fallback chain.
function optionLabelFor(row, optionLabel) {
  if (typeof optionLabel === 'function') return optionLabel(row);
  if (optionLabel && row?.[optionLabel] != null && row[optionLabel] !== '') return String(row[optionLabel]);
  if (row?.name) return row.name;
  if (row?.title) return row.title;
  if (row?.displayName) return row.displayName;
  if (row?.prompt) return String(row.prompt).slice(0, 60);
  if (row?.email) return row.email;
  return String(row?.id ?? '');
}

// A <select> populated from a related resource's list endpoint. Controlled via
// react-hook-form so the current value shows correctly after the async fetch.
function ReferenceSelect({ field, control, error }) {
  const { field: rhf } = useController({ name: field.name, control, rules: { required: field.required } });
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const lister = refLister(field.resource);
    if (!lister) {
      setFailed(true);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await lister({ pageSize: 200 });
        const items = Array.isArray(res) ? res : res?.items || [];
        if (alive) setOptions(items);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [field.resource]);

  // A required select displays its FIRST option as soon as the list loads, so
  // commit that option to form state too — otherwise submitting fails with
  // "This field is required" on a field that looks pre-filled, until the user
  // manually re-selects the same value.
  useEffect(() => {
    if (loading || failed || !field.required) return;
    if ((rhf.value == null || rhf.value === '') && options.length) rhf.onChange(options[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, failed, options]);

  // Graceful fallback: if the endpoint is unavailable, behave like text.
  if (failed) {
    return (
      <input
        type="text"
        value={rhf.value ?? ''}
        onChange={rhf.onChange}
        onBlur={rhf.onBlur}
        ref={rhf.ref}
        placeholder={field.placeholder}
        className={`field ${error ? '!border-red-400/60' : ''}`}
      />
    );
  }
  return (
    <select
      value={rhf.value ?? ''}
      onChange={rhf.onChange}
      onBlur={rhf.onBlur}
      ref={rhf.ref}
      className={`field ${error ? '!border-red-400/60' : ''}`}
    >
      {!field.required && <option value="">— none —</option>}
      {loading ? (
        <option value="" disabled>
          Loading…
        </option>
      ) : (
        options.map((o) => (
          <option key={o.id} value={o.id}>
            {optionLabelFor(o, field.optionLabel)}
          </option>
        ))
      )}
    </select>
  );
}

// A scrollable checkbox list backed by a related resource's list endpoint. Stores
// an array of selected ids in react-hook-form. When editing, `selectedEndpoint(id)`
// pre-populates the current selection.
function MultiReferenceSelect({ field, control, initialRow, error }) {
  const { field: rhf } = useController({ name: field.name, control, rules: { required: field.required } });
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectionFailed, setSelectionFailed] = useState(false);

  useEffect(() => {
    const lister = refLister(field.resource);
    if (!lister) {
      setFailed(true);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await lister({ pageSize: 200 });
        const items = Array.isArray(res) ? res : res?.items || [];
        if (alive) setOptions(items);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [field.resource]);

  // Preselect the currently-attached rows when editing an existing record. The
  // form value stays `undefined` ("not loaded") until this resolves, and the
  // checklist is disabled meanwhile — so saving early or a failed fetch can
  // never submit an empty selection that would detach the record's links.
  useEffect(() => {
    if (!initialRow?.id || typeof field.selectedEndpoint !== 'function') return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await field.selectedEndpoint(initialRow.id);
        const rows = Array.isArray(res) ? res : res?.items || [];
        if (alive) rhf.onChange(rows.map((r) => r.id));
      } catch {
        if (alive) setSelectionFailed(true); // value stays undefined → field omitted on save
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRow?.id]);

  // Selection still loading (or failed) for an existing record → read-only.
  const selectionPending =
    !!initialRow?.id && typeof field.selectedEndpoint === 'function' && !Array.isArray(rhf.value);
  const selected = Array.isArray(rhf.value) ? rhf.value : [];
  const isChecked = (id) => selected.some((s) => String(s) === String(id));
  const toggle = (id) => {
    if (selectionPending) return;
    rhf.onChange(isChecked(id) ? selected.filter((s) => String(s) !== String(id)) : [...selected, id]);
  };

  if (failed) {
    return <div className="text-xs text-red-400 mt-1">Couldn&apos;t load options for this field.</div>;
  }

  return (
    <div>
      <div
        className={`rounded-xl bg-black/20 border ${
          error ? '!border-red-400/60' : 'border-white/10'
        } max-h-52 overflow-y-auto divide-y divide-white/5 ${selectionPending ? 'opacity-60' : ''}`}
      >
        {loading ? (
          <div className="p-4 grid place-items-center text-neon">
            <Spinner className="w-5 h-5" />
          </div>
        ) : options.length === 0 ? (
          <div className="px-3 py-3 text-sm text-white/40">No options available.</div>
        ) : (
          options.map((o) => (
            <label
              key={o.id}
              className={`flex items-center gap-3 px-3 py-2 transition ${
                selectionPending ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked(o.id)}
                onChange={() => toggle(o.id)}
                disabled={selectionPending}
                className="w-4 h-4 accent-neon shrink-0"
              />
              <span className="text-sm text-white/80 truncate">{optionLabelFor(o, field.optionLabel)}</span>
            </label>
          ))
        )}
      </div>
      {selectionPending &&
        (selectionFailed ? (
          <div className="text-xs text-amber-300 mt-1">
            Couldn&apos;t load the current selection — saving now will leave this field unchanged.
          </div>
        ) : (
          <div className="text-xs text-white/40 mt-1">Loading current selection…</div>
        ))}
    </div>
  );
}

// A reference <select> whose SOURCE RESOURCE depends on another field's value —
// e.g. a shop item's Target: kind=ACCESSORY lists accessories, kind=BADGE lists
// badges, other kinds need no target at all. Config:
//   { type:'dependentReference', dependsOn:'kind', resourceByValue:{ ACCESSORY:'accessories', … } }
// A stale id (picked under a different controlling value) is cleared once the
// new option list loads, so a kind switch can never submit a mismatched target.
function DependentReferenceSelect({ field, control, error }) {
  const { field: rhf } = useController({ name: field.name, control, rules: { required: field.required } });
  const controllingValue = useWatch({ control, name: field.dependsOn });
  const resource = field.resourceByValue?.[controllingValue] || null;
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setOptions([]);
    setFailed(false);
    if (!resource) return undefined;
    const lister = refLister(resource);
    if (!lister) {
      setFailed(true);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await lister({ pageSize: 200 });
        const items = Array.isArray(res) ? res : res?.items || [];
        if (alive) setOptions(items);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [resource]);

  // Drop a selection that doesn't belong to the current option list.
  useEffect(() => {
    if (loading || failed || !resource) return;
    if (rhf.value && !options.some((o) => String(o.id) === String(rhf.value))) rhf.onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, failed, resource, options]);

  if (!resource) {
    return (
      <div className="field !py-2.5 text-sm text-white/35 select-none cursor-not-allowed">
        {field.notApplicableText || 'Not applicable for this selection'}
      </div>
    );
  }
  // Graceful fallback: if the endpoint is unavailable, behave like text.
  if (failed) {
    return (
      <input
        type="text"
        value={rhf.value ?? ''}
        onChange={rhf.onChange}
        onBlur={rhf.onBlur}
        ref={rhf.ref}
        placeholder={field.placeholder}
        className={`field ${error ? '!border-red-400/60' : ''}`}
      />
    );
  }
  return (
    <select
      value={rhf.value ?? ''}
      onChange={rhf.onChange}
      onBlur={rhf.onBlur}
      ref={rhf.ref}
      className={`field ${error ? '!border-red-400/60' : ''}`}
    >
      <option value="">{loading ? 'Loading…' : field.placeholder || '— none —'}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {optionLabelFor(o, field.optionLabel)}
        </option>
      ))}
    </select>
  );
}

// A <select> whose string options are loaded from a plain endpoint (not a CRUD
// resource) — e.g. the distinct question categories. Stores the chosen string.
// When editing, `selectedEndpoint(id)` resolves the record's current value so it
// shows preselected. Options may be strings or objects (mapped via optionValue /
// optionLabel). Used by the mission "Question Category" picker.
function RemoteSelect({ field, control, initialRow, error }) {
  const { field: rhf } = useController({ name: field.name, control, rules: { required: field.required } });
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const valueOf = (o) => (typeof o === 'object' && o !== null ? field.optionValue?.(o) ?? o.value ?? o.category ?? o.id : o);
  const labelOf = (o) =>
    typeof o === 'object' && o !== null ? field.optionLabel?.(o) ?? o.label ?? String(valueOf(o)) : String(o);

  useEffect(() => {
    if (typeof field.optionsEndpoint !== 'function') {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await field.optionsEndpoint();
        const items = Array.isArray(res) ? res : res?.items || [];
        if (alive) setOptions(items);
      } catch {
        /* leave empty on failure */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preselect the record's current value when editing.
  useEffect(() => {
    if (!initialRow?.id || typeof field.selectedEndpoint !== 'function') return undefined;
    let alive = true;
    (async () => {
      try {
        const v = await field.selectedEndpoint(initialRow.id);
        if (alive && v != null && v !== '') rhf.onChange(v);
      } catch {
        /* leave unselected on failure */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRow?.id]);

  return (
    <select
      value={rhf.value ?? ''}
      onChange={rhf.onChange}
      onBlur={rhf.onBlur}
      ref={rhf.ref}
      className={`field ${error ? '!border-red-400/60' : ''}`}
    >
      <option value="">{loading ? 'Loading…' : field.placeholder || '— none —'}</option>
      {options.map((o) => {
        const val = valueOf(o);
        return (
          <option key={String(val)} value={val}>
            {labelOf(o)}
          </option>
        );
      })}
    </select>
  );
}

// Inline level-band rows for the rank form: each level has a number, an XP
// start and an optional XP end (blank = open-ended top band). When editing,
// `selectedEndpoint(id)` pre-populates the rank's current levels.
function LevelBandsEditor({ field, control, initialRow }) {
  const { field: rhf } = useController({ name: field.name, control });
  const rows = Array.isArray(rhf.value) ? rhf.value : [];

  useEffect(() => {
    if (!initialRow?.id || typeof field.selectedEndpoint !== 'function') return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await field.selectedEndpoint(initialRow.id);
        const levels = Array.isArray(res) ? res : res?.items || [];
        if (alive) {
          rhf.onChange(
            levels.map((l) => ({
              id: l.id,
              level: l.level ?? '',
              minXp: l.minXp ?? '',
              maxXp: l.maxXp ?? '',
              title: l.title ?? '',
            })),
          );
        }
      } catch {
        /* leave empty on failure */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRow?.id]);

  const setCell = (i, key, val) => rhf.onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const removeRow = (i) => rhf.onChange(rows.filter((_, idx) => idx !== i));
  const addRow = () => {
    const last = rows[rows.length - 1];
    rhf.onChange([
      ...rows,
      {
        level: last?.level !== '' && last?.level != null ? Number(last.level) + 1 : 1,
        // Next band starts where the previous one ended.
        minXp: last?.maxXp !== '' && last?.maxXp != null ? last.maxXp : rows.length === 0 ? 0 : '',
        maxXp: '',
        title: '',
      },
    ]);
  };

  return (
    <div className="rounded-xl bg-black/20 border border-white/10 p-3 space-y-2">
      {rows.length > 0 && (
        <div className="grid grid-cols-[4rem_1fr_1fr_1.4fr_2rem] gap-2 text-[11px] text-white/40 px-0.5">
          <span>Level</span>
          <span>XP Start</span>
          <span>XP End</span>
          <span>Title</span>
          <span />
        </div>
      )}
      {rows.map((r, i) => (
        <div key={r.id || i} className="grid grid-cols-[4rem_1fr_1fr_1.4fr_2rem] gap-2 items-center">
          <input type="number" min={0} value={r.level} onChange={(e) => setCell(i, 'level', e.target.value)} className="field !px-2.5 !py-2 text-sm" />
          <input type="number" min={0} value={r.minXp} onChange={(e) => setCell(i, 'minXp', e.target.value)} className="field !px-2.5 !py-2 text-sm" />
          <input type="number" min={0} value={r.maxXp} onChange={(e) => setCell(i, 'maxXp', e.target.value)} placeholder="∞" className="field !px-2.5 !py-2 text-sm" />
          <input type="text" value={r.title} onChange={(e) => setCell(i, 'title', e.target.value)} placeholder={`Level ${r.level || i + 1}`} className="field !px-2.5 !py-2 text-sm" />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition justify-self-center"
            title="Remove level"
          >
            ✕
          </button>
        </div>
      ))}
      {rows.length === 0 && <div className="text-sm text-white/35 px-0.5 py-1">No levels yet — add the first XP band.</div>}
      <button type="button" onClick={addRow} className="text-sm font-semibold text-neon hover:text-white transition">
        + Add level
      </button>
    </div>
  );
}

// Inline answer-option rows for the question form: each option is a racing
// lane; the ✓ toggle marks the correct answer(s). When editing,
// `selectedEndpoint(id)` pre-populates the question's current options.
function AnswerOptionsEditor({ field, control, initialRow, error }) {
  const { field: rhf } = useController({ name: field.name, control });
  const rows = Array.isArray(rhf.value) ? rhf.value : [];

  useEffect(() => {
    if (!initialRow?.id || typeof field.selectedEndpoint !== 'function') return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await field.selectedEndpoint(initialRow.id);
        const opts = Array.isArray(res) ? res : res?.items || [];
        if (alive) {
          rhf.onChange(opts.map((o) => ({ id: o.id, label: o.label ?? '', isCorrect: !!o.isCorrect })));
        }
      } catch {
        /* leave empty on failure */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRow?.id]);

  const setCell = (i, key, val) => rhf.onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const removeRow = (i) => rhf.onChange(rows.filter((_, idx) => idx !== i));
  const addRow = () => rhf.onChange([...rows, { label: '', isCorrect: rows.length === 0 }]);

  const LANE = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className={`rounded-xl bg-black/20 border p-3 space-y-2 ${error ? '!border-red-400/60' : 'border-white/10'}`}>
      {rows.map((r, i) => (
        <div key={r.id || i} className="flex items-center gap-2">
          <span className="chip bg-white/10 text-white/60 border border-white/15 shrink-0 w-8 justify-center">
            {LANE[i] ?? i + 1}
          </span>
          <input
            type="text"
            value={r.label}
            onChange={(e) => setCell(i, 'label', e.target.value)}
            placeholder={`Answer option ${LANE[i] ?? i + 1}`}
            className="field !px-3 !py-2 text-sm flex-1"
          />
          <button
            type="button"
            onClick={() => setCell(i, 'isCorrect', !r.isCorrect)}
            title={r.isCorrect ? 'Correct answer' : 'Mark as the correct answer'}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
              r.isCorrect
                ? 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-white/5 text-white/35 hover:text-white/70 ring-1 ring-white/10'
            }`}
          >
            ✓ {r.isCorrect ? 'CORRECT' : 'correct?'}
          </button>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition shrink-0"
            title="Remove option"
          >
            ✕
          </button>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="text-sm text-white/35 px-0.5 py-1">No options yet — add the answers players will race into.</div>
      )}
      <button type="button" onClick={addRow} className="text-sm font-semibold text-neon hover:text-white transition">
        + Add option
      </button>
    </div>
  );
}

// Ordered storyboard "points" for a learning path — each point is a panel with a
// title, image, description and instructions (the 6-panel chapter layout). Stored
// inline on the record as a JSONB array, so there's no async preselect: the "+ Add
// point" button appends a blank panel and blank panels are dropped on save.
function PointsEditor({ field, control }) {
  const { field: rhf } = useController({ name: field.name, control });
  const rows = Array.isArray(rhf.value) ? rhf.value : [];

  const setCell = (i, key, val) => rhf.onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const removeRow = (i) => rhf.onChange(rows.filter((_, idx) => idx !== i));
  const addRow = () => rhf.onChange([...rows, { title: '', description: '', imageUrl: '', instructions: '' }]);

  return (
    <div className="rounded-xl bg-black/20 border border-white/10 p-3 space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg bg-white/[0.04] border border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="chip bg-neon/10 text-neon border border-neon/20">Point {i + 1}</span>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition"
              title="Remove point"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={r.title ?? ''}
            onChange={(e) => setCell(i, 'title', e.target.value)}
            placeholder="Title (e.g. Medical Emergency)"
            className="field !px-3 !py-2 text-sm"
          />
          <input
            type="text"
            value={r.imageUrl ?? ''}
            onChange={(e) => setCell(i, 'imageUrl', e.target.value)}
            placeholder="Image URL"
            className="field !px-3 !py-2 text-sm"
          />
          <textarea
            rows={2}
            value={r.description ?? ''}
            onChange={(e) => setCell(i, 'description', e.target.value)}
            placeholder="Description"
            className="field !px-3 !py-2 text-sm"
          />
          <textarea
            rows={2}
            value={r.instructions ?? ''}
            onChange={(e) => setCell(i, 'instructions', e.target.value)}
            placeholder="Instructions (e.g. Press SPACE 3 times to give chest compressions)"
            className="field !px-3 !py-2 text-sm"
          />
        </div>
      ))}
      {rows.length === 0 && (
        <div className="text-sm text-white/35 px-0.5 py-1">No points yet — add the first storyboard panel.</div>
      )}
      <button type="button" onClick={addRow} className="text-sm font-semibold text-neon hover:text-white transition">
        + Add point
      </button>
    </div>
  );
}

export default function ResourceForm({
  fields,
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = 'Save',
  error,
  fieldErrors,
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: buildDefaults(fields, initial) });

  useEffect(() => {
    reset(buildDefaults(fields, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const submit = (values) => {
    const payload = {};
    let blocked = false;
    for (const f of fields) {
      if (f.readOnly) continue;
      // JSON fields: omit when blank (backend applies its default), parse when
      // present, and block submit with a field error on invalid JSON.
      if (f.type === 'json') {
        const raw = values[f.name];
        if (raw === '' || raw === undefined || raw === null) continue;
        if (typeof raw !== 'string') {
          payload[f.name] = raw;
          continue;
        }
        try {
          payload[f.name] = JSON.parse(raw);
        } catch {
          setError(f.name, { type: 'manual', message: 'Invalid JSON' });
          blocked = true;
        }
        continue;
      }
      const c = coerce(f, values[f.name]);
      if (c !== undefined) payload[f.name] = c;
    }
    if (blocked) return;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => {
          const span =
            f.colSpan === 2 ||
            f.type === 'textarea' ||
            f.type === 'json' ||
            f.type === 'multiReference' ||
            f.type === 'levelBands' ||
            f.type === 'answerOptions' ||
            f.type === 'points'
              ? 'sm:col-span-2'
              : '';
          const serverMsg = fieldErrors?.[f.name];
          if (f.type === 'checkbox') {
            return (
              <label
                key={f.name}
                className={`${span} flex items-center gap-3 rounded-xl bg-black/20 border border-white/10 px-3.5 py-3 cursor-pointer hover:border-white/20 transition`}
              >
                <input type="checkbox" {...register(f.name)} className="w-4 h-4 accent-neon" />
                <div>
                  <div className="text-sm font-medium text-white/85">{f.label}</div>
                  {f.help && <div className="text-xs text-white/40">{f.help}</div>}
                </div>
              </label>
            );
          }
          return (
            <div key={f.name} className={span}>
              <label className="label">
                {f.label}
                {f.required && <span className="text-neon"> *</span>}
              </label>
              {f.type === 'reference' ? (
                <ReferenceSelect field={f} control={control} error={serverMsg} />
              ) : f.type === 'dependentReference' ? (
                <DependentReferenceSelect field={f} control={control} error={serverMsg} />
              ) : f.type === 'remoteSelect' ? (
                <RemoteSelect field={f} control={control} initialRow={initial} error={serverMsg} />
              ) : f.type === 'multiReference' ? (
                <MultiReferenceSelect field={f} control={control} initialRow={initial} error={serverMsg} />
              ) : f.type === 'levelBands' ? (
                <LevelBandsEditor field={f} control={control} initialRow={initial} />
              ) : f.type === 'answerOptions' ? (
                <AnswerOptionsEditor field={f} control={control} initialRow={initial} error={serverMsg} />
              ) : f.type === 'points' ? (
                <PointsEditor field={f} control={control} />
              ) : f.type === 'select' ? (
                <select
                  {...register(f.name, { required: f.required })}
                  className={`field ${serverMsg ? '!border-red-400/60' : ''}`}
                  defaultValue=""
                >
                  <option value="" disabled={f.required}>
                    {f.placeholder || 'Select…'}
                  </option>
                  {(f.options || []).map((o) => {
                    const val = typeof o === 'object' ? o.value : o;
                    const lbl = typeof o === 'object' ? o.label : o;
                    return (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    );
                  })}
                </select>
              ) : f.type === 'textarea' || f.type === 'json' ? (
                <textarea
                  rows={f.type === 'json' ? 5 : 3}
                  {...register(f.name, { required: f.required })}
                  placeholder={f.placeholder}
                  className={`field ${f.type === 'json' ? 'font-mono text-xs' : ''} ${serverMsg ? '!border-red-400/60' : ''}`}
                />
              ) : f.type === 'password' ? (
                <PasswordInput
                  {...register(f.name, { required: f.required })}
                  placeholder={f.placeholder}
                  className={`field ${serverMsg ? '!border-red-400/60' : ''}`}
                />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  {...register(f.name, { required: f.required })}
                  placeholder={f.placeholder}
                  className={`field ${serverMsg ? '!border-red-400/60' : ''}`}
                />
              )}
              {f.help && f.type !== 'checkbox' && <div className="text-xs text-white/35 mt-1">{f.help}</div>}
              {serverMsg ? (
                <div className="text-xs text-red-400 mt-1">{serverMsg}</div>
              ) : (
                errors[f.name] && (
                  <div className="text-xs text-red-400 mt-1">
                    {errors[f.name].message || 'This field is required'}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
          {submitting && <Spinner className="w-4 h-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
