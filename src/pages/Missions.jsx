import { useCallback, useEffect, useState } from 'react';
import endpoints from '../services/api.js';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useAuthStore } from '../store/authStore.js';
import { RankingsModal, fmtDate } from '../components/insights.jsx';
import { EmptyState, Spinner, StatusPill, useToast } from '../components/ui.jsx';

// Ranked players table for the mission "Players" view.
const PLAYER_COLUMNS = [
  { key: 'name', label: 'Player', className: 'text-white/85', render: (r) => r.name || r.userId || '—' },
  { key: 'bestScore', label: 'Best Score', align: 'right', className: 'text-neon', render: (r) => (r.bestScore != null ? `${Math.round(r.bestScore)}%` : '—') },
  { key: 'stars', label: 'Stars', align: 'right', className: 'text-amber-300', render: (r) => `★ ${r.stars ?? 0}` },
  { key: 'attempts', label: 'Attempts', align: 'right', render: (r) => r.attempts ?? 0 },
  { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
  { key: 'lastPlayedAt', label: 'Last Played', render: (r) => fmtDate(r.lastPlayedAt) },
];

// Mission builder: attach/detach questions from the bank, toggle pinned.
function MissionBuilder({ mission, onClose, canEdit }) {
  const toast = useToast();
  const [attached, setAttached] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [bank, setBank] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankLoading, setBankLoading] = useState(false);

  const loadAttached = useCallback(async () => {
    setLoading(true);
    try {
      const res = await endpoints.mission.questions(mission.id);
      setAttached(Array.isArray(res) ? res : res?.items || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [mission.id, toast]);

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await endpoints.questions.list({ page: 1, pageSize: 20, search: bankSearch || undefined });
      setBank(Array.isArray(res) ? res : res?.items || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBankLoading(false);
    }
  }, [bankSearch, toast]);

  useEffect(() => {
    loadAttached();
  }, [loadAttached]);
  useEffect(() => {
    const t = setTimeout(loadBank, 300);
    return () => clearTimeout(t);
  }, [loadBank]);

  // Normalize a link row into { question, orderIndex, isPinned }.
  const linkView = (row) => {
    const q = row.question || row;
    return {
      questionId: q.id ?? row.questionId,
      prompt: q.prompt || q.title || `Question ${q.id ?? row.questionId}`,
      type: q.type,
      orderIndex: row.orderIndex,
      isPinned: !!row.isPinned,
    };
  };
  const views = attached.map(linkView);
  const attachedIds = new Set(views.map((v) => v.questionId));

  const attach = async (question, isPinned = false) => {
    setBusy(true);
    try {
      await endpoints.mission.attachQuestion(mission.id, {
        questionId: question.id,
        orderIndex: views.length,
        isPinned,
      });
      toast('Question attached');
      await loadAttached();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const detach = async (questionId) => {
    setBusy(true);
    try {
      await endpoints.mission.detachQuestion(mission.id, questionId);
      toast('Question detached');
      await loadAttached();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (v) => {
    // Re-attach with flipped isPinned (idempotent upsert on the link).
    setBusy(true);
    try {
      await endpoints.mission.attachQuestion(mission.id, {
        questionId: v.questionId,
        orderIndex: v.orderIndex ?? 0,
        isPinned: !v.isPinned,
      });
      await loadAttached();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Attached pool */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Icon name="target" className="w-4 h-4 text-neon" />
            Question Pool
          </h4>
          <span className="text-xs text-white/40">{views.length} attached</span>
        </div>
        <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-10 grid place-items-center text-neon">
              <Spinner className="w-6 h-6" />
            </div>
          ) : views.length === 0 ? (
            <EmptyState icon="target" title="No questions yet" hint="Attach from the bank →" />
          ) : (
            views.map((v) => (
              <div key={v.questionId} className="rounded-xl bg-black/20 border border-white/10 p-3">
                <p className="text-sm text-white/85 line-clamp-2">{v.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="chip bg-white/10 text-white/60 border border-white/15">{v.type || 'question'}</span>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePin(v)}
                        disabled={busy}
                        className={`p-1.5 rounded-lg transition ${
                          v.isPinned ? 'text-neon bg-neon/10' : 'text-white/40 hover:text-neon hover:bg-white/5'
                        }`}
                        title={v.isPinned ? 'Unpin' : 'Pin'}
                      >
                        <Icon name="pin" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => detach(v.questionId)}
                        disabled={busy}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition"
                        title="Detach"
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Question bank */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Icon name="help" className="w-4 h-4 text-amber-300" />
            Question Bank
          </h4>
        </div>
        <div className="relative mb-2">
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            placeholder="Search the bank…"
            className="field !pl-9"
          />
        </div>
        <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
          {bankLoading ? (
            <div className="py-10 grid place-items-center text-neon">
              <Spinner className="w-6 h-6" />
            </div>
          ) : bank.length === 0 ? (
            <EmptyState icon="help" title="No questions found" />
          ) : (
            bank.map((q) => {
              const isAttached = attachedIds.has(q.id);
              return (
                <div key={q.id} className="rounded-xl bg-black/20 border border-white/10 p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/85 line-clamp-2">{q.prompt || q.title}</p>
                    <span className="chip bg-white/10 text-white/60 border border-white/15 mt-1">{q.type}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => attach(q)}
                      disabled={busy || isAttached}
                      className={isAttached ? 'btn-ghost !px-2.5 !py-1.5 opacity-50' : 'btn-primary !px-2.5 !py-1.5'}
                      title={isAttached ? 'Already attached' : 'Attach'}
                    >
                      <Icon name={isAttached ? 'check' : 'link'} className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function Missions() {
  const [builderMission, setBuilderMission] = useState(null);
  const [playersMission, setPlayersMission] = useState(null);
  const canEdit = useAuthStore((s) => s.can('missions', 'update'));
  const canView = useAuthStore((s) => s.can('missions', 'view'));

  return (
    <>
      <ResourceTable
        {...RESOURCE_CONFIGS.missions}
        resource="missions"
        onRowClick={(row) => setBuilderMission(row)}
        rowActions={(row) => (
          <>
            {canView && (
              <button
                onClick={() => setPlayersMission(row)}
                className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
                title="Players"
              >
                <Icon name="users" className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setBuilderMission(row)}
              className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
              title="Manage questions"
            >
              <Icon name="target" className="w-4 h-4" />
            </button>
          </>
        )}
      />
      <RankingsModal
        open={!!playersMission}
        onClose={() => setPlayersMission(null)}
        reloadKey={playersMission?.id}
        title={playersMission ? `${playersMission.title} — Players` : 'Players'}
        subtitle="Who joined this mission and how they're doing"
        columns={PLAYER_COLUMNS}
        empty="No players yet"
        maxWidth="max-w-4xl"
        load={async () => {
          const res = await endpoints.insight.missionPlayers(playersMission.id);
          return Array.isArray(res) ? res : res?.players || res?.items || [];
        }}
      />
      <Modal
        open={!!builderMission}
        onClose={() => setBuilderMission(null)}
        title={builderMission ? `Mission Builder — ${builderMission.title}` : 'Mission Builder'}
        subtitle="Attach questions from the bank, pin key ones, or detach"
        maxWidth="max-w-4xl"
      >
        {builderMission && (
          <MissionBuilder
            mission={builderMission}
            onClose={() => setBuilderMission(null)}
            canEdit={canEdit}
          />
        )}
      </Modal>
    </>
  );
}
