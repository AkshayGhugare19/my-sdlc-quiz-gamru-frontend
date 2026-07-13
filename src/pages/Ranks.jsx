import { useCallback, useEffect, useState } from 'react';
import endpoints from '../services/api.js';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useAuthStore } from '../store/authStore.js';
import { EmptyState, Spinner, useToast } from '../components/ui.jsx';

const emptyForm = { level: '', minXp: '', maxXp: '', title: '' };

// Levels live inside a rank as XP bands [minXp, maxXp). Manage them here.
function LevelManager({ rank, canEdit }) {
  const toast = useToast();
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await endpoints.rank.levels(rank.id);
      setLevels(Array.isArray(res) ? res : res?.items || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [rank.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (lvl) => {
    setEditingId(lvl.id);
    setForm({
      level: lvl.level ?? '',
      minXp: lvl.minXp ?? '',
      maxXp: lvl.maxXp ?? '',
      title: lvl.title ?? '',
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      level: form.level === '' ? undefined : Number(form.level),
      minXp: form.minXp === '' ? undefined : Number(form.minXp),
      maxXp: form.maxXp === '' ? undefined : Number(form.maxXp),
      title: form.title || undefined,
    };
    setBusy(true);
    try {
      if (editingId) {
        await endpoints.rank.updateLevel(rank.id, editingId, payload);
        toast('Level updated');
      } else {
        await endpoints.rank.addLevel(rank.id, payload);
        toast('Level added');
      }
      resetForm();
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (levelId) => {
    setBusy(true);
    try {
      await endpoints.rank.deleteLevel(rank.id, levelId);
      toast('Level deleted');
      if (editingId === levelId) resetForm();
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const setField = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      {/* Levels list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Icon name="bars" className="w-4 h-4 text-neon" />
            Levels in this rank
          </h4>
          <span className="text-xs text-white/40">{levels.length} levels</span>
        </div>
        <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-10 grid place-items-center text-neon">
              <Spinner className="w-6 h-6" />
            </div>
          ) : levels.length === 0 ? (
            <EmptyState icon="bars" title="No levels yet" hint="Add the first XP band below." />
          ) : (
            levels.map((lvl) => (
              <div key={lvl.id} className="rounded-xl bg-black/20 border border-white/10 p-3 flex items-center gap-3">
                <span className="chip bg-neon/10 text-neon border border-neon/20 shrink-0">L{lvl.level}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/85 truncate">{lvl.title || 'Untitled level'}</p>
                  <p className="text-xs text-white/40">
                    XP {lvl.minXp ?? 0}–{lvl.maxXp ?? '∞'}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(lvl)}
                      disabled={busy}
                      className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
                      title="Edit"
                    >
                      <Icon name="edit" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(lvl.id)}
                      disabled={busy}
                      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5 transition"
                      title="Delete"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / edit mini-form */}
      {canEdit && (
        <form onSubmit={submit} className="border-t border-white/10 pt-4">
          <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2 mb-3">
            <Icon name={editingId ? 'edit' : 'plus'} className="w-4 h-4 text-amber-300" />
            {editingId ? 'Edit level' : 'Add level'}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label">Level *</label>
              <input type="number" min={0} required value={form.level} onChange={setField('level')} className="field" />
            </div>
            <div>
              <label className="label">XP Start *</label>
              <input type="number" min={0} required value={form.minXp} onChange={setField('minXp')} className="field" />
            </div>
            <div>
              <label className="label">XP End</label>
              <input
                type="number"
                min={0}
                value={form.maxXp}
                onChange={setField('maxXp')}
                placeholder="∞ (blank)"
                className="field"
              />
            </div>
            <div>
              <label className="label">Title</label>
              <input type="text" value={form.title} onChange={setField('title')} className="field" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-ghost">
                Cancel
              </button>
            )}
            <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <Spinner className="w-4 h-4" /> : <Icon name={editingId ? 'check' : 'plus'} className="w-4 h-4" />}
              {editingId ? 'Save level' : 'Add level'}
            </button>
          </div>
          <p className="text-xs text-white/35 mt-2">XP End is optional — leave blank for an open-ended top band.</p>
        </form>
      )}
    </div>
  );
}

export default function Ranks() {
  const [levelsRank, setLevelsRank] = useState(null);
  const canEdit = useAuthStore((s) => s.can('ranks', 'update'));

  return (
    <>
      <ResourceTable
        {...RESOURCE_CONFIGS.ranks}
        resource="ranks"
        rowActions={(row) => (
          <button
            onClick={() => setLevelsRank(row)}
            className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
            title="Manage levels"
          >
            <Icon name="bars" className="w-4 h-4" />
          </button>
        )}
      />
      <Modal
        open={!!levelsRank}
        onClose={() => setLevelsRank(null)}
        title={levelsRank ? `${levelsRank.name} — Levels` : 'Rank Levels'}
        subtitle="Each level is an XP band players climb within this rank"
        maxWidth="max-w-2xl"
      >
        {levelsRank && <LevelManager rank={levelsRank} canEdit={canEdit} />}
      </Modal>
    </>
  );
}
