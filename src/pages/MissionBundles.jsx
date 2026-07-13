import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import endpoints from '../services/api.js';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useAuthStore } from '../store/authStore.js';
import { RankingsModal } from '../components/insights.jsx';
import { EmptyState, Spinner, useToast } from '../components/ui.jsx';

// Ranked employees for the bundle "Leaderboard" view.
const BUNDLE_LEADERBOARD_COLUMNS = [
  { key: 'name', label: 'Employee', className: 'text-white/85', render: (r) => r.name || r.userId || '—' },
  { key: 'stars', label: 'Stars', align: 'right', className: 'text-amber-300', render: (r) => `★ ${r.stars ?? 0}` },
  { key: 'completionPct', label: 'Completion', align: 'right', className: 'text-neon', render: (r) => `${Math.round(r.completionPct || 0)}%` },
  { key: 'averageScore', label: 'Avg Score', align: 'right', render: (r) => (r.averageScore != null ? `${Math.round(r.averageScore)}%` : '—') },
];

// Bundle builder: assemble already-created missions into an ordered bundle.
function BundleBuilder({ bundle, canEdit }) {
  const toast = useToast();
  const [attached, setAttached] = useState([]);
  const [progress, setProgress] = useState({}); // missionId → progress row
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [available, setAvailable] = useState([]);
  const [pick, setPick] = useState('');
  const [availLoading, setAvailLoading] = useState(false);

  const loadAttached = useCallback(async () => {
    setLoading(true);
    try {
      const [missionsRes, progressRes] = await Promise.allSettled([
        endpoints.missionBundle.missions(bundle.id),
        endpoints.missionBundle.progress(bundle.id),
      ]);
      const list =
        missionsRes.status === 'fulfilled'
          ? Array.isArray(missionsRes.value)
            ? missionsRes.value
            : missionsRes.value?.items || []
          : [];
      setAttached(list);
      if (progressRes.status === 'fulfilled') {
        const rows = Array.isArray(progressRes.value) ? progressRes.value : progressRes.value?.items || [];
        const map = {};
        for (const r of rows) map[r.missionId] = r;
        setProgress(map);
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [bundle.id, toast]);

  const loadAvailable = useCallback(async () => {
    setAvailLoading(true);
    try {
      const res = await endpoints.missionBundle.available(bundle.id);
      setAvailable(Array.isArray(res) ? res : res?.items || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAvailLoading(false);
    }
  }, [bundle.id, toast]);

  useEffect(() => {
    loadAttached();
    loadAvailable();
  }, [loadAttached, loadAvailable]);

  const attach = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await endpoints.missionBundle.attach(bundle.id, pick, attached.length);
      toast('Mission added');
      setPick('');
      await Promise.all([loadAttached(), loadAvailable()]);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const detach = async (missionId) => {
    setBusy(true);
    try {
      await endpoints.missionBundle.detach(bundle.id, missionId);
      toast('Mission removed');
      await Promise.all([loadAttached(), loadAvailable()]);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const progressLine = (missionId) => {
    const p = progress[missionId];
    if (!p) return null;
    const parts = [`${p.learners ?? 0} learners`, `${Math.round(p.completionRate || 0)}% complete`];
    if (p.averageStars != null) parts.push(`★${Number(p.averageStars).toFixed(1)} avg`);
    return parts.join(' · ');
  };

  return (
    <div className="space-y-5">
      {/* Attached missions, ordered */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Icon name="target" className="w-4 h-4 text-neon" />
            Missions in this bundle
          </h4>
          <span className="text-xs text-white/40">{attached.length} attached</span>
        </div>
        <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-10 grid place-items-center text-neon">
              <Spinner className="w-6 h-6" />
            </div>
          ) : attached.length === 0 ? (
            <EmptyState icon="target" title="No missions yet" hint="Add one from the picker below." />
          ) : (
            attached.map((m, i) => {
              const line = progressLine(m.id ?? m.missionId);
              return (
                <div key={m.id ?? m.missionId} className="rounded-xl bg-black/20 border border-white/10 p-3">
                  <div className="flex items-start gap-3">
                    <span className="chip bg-white/10 text-white/60 border border-white/15 shrink-0">{(m.orderIndex ?? i) + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85 line-clamp-2">{m.title || `Mission ${m.id ?? m.missionId}`}</p>
                      {line && <p className="text-xs text-white/40 mt-0.5">{line}</p>}
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => detach(m.id ?? m.missionId)}
                        disabled={busy}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition"
                        title="Remove from bundle"
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add mission picker */}
      {canEdit && (
        <div className="border-t border-white/10 pt-4">
          <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2 mb-2">
            <Icon name="plus" className="w-4 h-4 text-amber-300" />
            Add a mission
          </h4>
          <div className="flex items-center gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="field flex-1"
              disabled={availLoading || busy}
            >
              <option value="">{availLoading ? 'Loading…' : 'Select a mission…'}</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title || `Mission ${m.id}`}
                </option>
              ))}
            </select>
            <button
              onClick={attach}
              disabled={!pick || busy}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? <Spinner className="w-4 h-4" /> : <Icon name="link" className="w-4 h-4" />}
              Add
            </button>
          </div>
          <p className="text-xs text-white/35 mt-2">
            Missions are created in the{' '}
            <Link to="/missions" className="text-neon hover:underline">
              Missions
            </Link>{' '}
            page first, then attached here.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MissionBundles() {
  const [builderBundle, setBuilderBundle] = useState(null);
  const [leaderboardBundle, setLeaderboardBundle] = useState(null);
  const canEdit = useAuthStore((s) => s.can('mission-bundles', 'update'));
  const canView = useAuthStore((s) => s.can('mission-bundles', 'view'));

  return (
    <>
      <ResourceTable
        {...RESOURCE_CONFIGS['mission-bundles']}
        resource="mission-bundles"
        rowActions={(row) => (
          <>
            {canView && (
              <button
                onClick={() => setLeaderboardBundle(row)}
                className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
                title="Leaderboard"
              >
                <Icon name="rank" className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setBuilderBundle(row)}
              className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
              title="Manage missions"
            >
              <Icon name="target" className="w-4 h-4" />
            </button>
          </>
        )}
      />
      <RankingsModal
        open={!!leaderboardBundle}
        onClose={() => setLeaderboardBundle(null)}
        reloadKey={leaderboardBundle?.id}
        title={leaderboardBundle ? `${leaderboardBundle.title} — Leaderboard` : 'Leaderboard'}
        subtitle="Top employees across this bundle's missions"
        columns={BUNDLE_LEADERBOARD_COLUMNS}
        empty="No participants yet"
        maxWidth="max-w-3xl"
        load={async () => {
          const res = await endpoints.insight.bundleLeaderboard(leaderboardBundle.id);
          return Array.isArray(res) ? res : res?.leaderboard || res?.items || [];
        }}
      />
      <Modal
        open={!!builderBundle}
        onClose={() => setBuilderBundle(null)}
        title={builderBundle ? `${builderBundle.title} — Missions` : 'Bundle Missions'}
        subtitle="Assemble already-created missions into this bundle, in order"
        maxWidth="max-w-2xl"
      >
        {builderBundle && <BundleBuilder bundle={builderBundle} canEdit={canEdit} />}
      </Modal>
    </>
  );
}
