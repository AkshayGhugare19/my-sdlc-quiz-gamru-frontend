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
  // The mission's question category (e.g. "Environment"), derived from its
  // attached questions — the bank below is filtered to it so you only swap in
  // questions from the SAME category the mission was created with.
  const [poolCategory, setPoolCategory] = useState(null);

  const loadAttached = useCallback(async () => {
    setLoading(true);
    try {
      const res = await endpoints.mission.questions(mission.id);
      const links = Array.isArray(res) ? res : res?.items || [];
      setAttached(links);
      // Derive the mission's category from its attached questions (the mission
      // form attaches a whole category on save, so the first one is canonical).
      const cat = links
        .map((l) => (l.Question || l.question || l).category)
        .find((c) => c && String(c).trim() !== '');
      setPoolCategory(cat ?? null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [mission.id, toast]);

  // Load the WHOLE bank (every page), not just the first 20 — otherwise
  // questions beyond page 1 look like they don't exist.
  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const pageSize = 200; // server page cap
      let page = 1;
      let all = [];
      // Page through until the server says we have everything (hard stop at 50
      // pages = 10k questions as a runaway guard).
      for (;;) {
        const res = await endpoints.questions.list({
          page,
          pageSize,
          search: bankSearch || undefined,
          // Only offer questions from the mission's own category — swapping in
          // another category's question would break the mission's theme.
          category: poolCategory || undefined,
        });
        const items = Array.isArray(res) ? res : res?.items || [];
        all = all.concat(items);
        const total = Array.isArray(res) ? all.length : res?.pagination?.total ?? all.length;
        if (items.length === 0 || all.length >= total || page >= 50) break;
        page++;
      }
      setBank(all);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBankLoading(false);
    }
  }, [bankSearch, poolCategory, toast]);

  useEffect(() => {
    loadAttached();
  }, [loadAttached]);
  useEffect(() => {
    const t = setTimeout(loadBank, 300);
    return () => clearTimeout(t);
  }, [loadBank]);

  // Normalize a link row into { question, orderIndex, isPinned }. The API
  // nests the question under `Question` (Sequelize association name) — accept
  // both casings so the pool shows real prompts/types, not "Question <id>".
  const linkView = (row) => {
    const q = row.Question || row.question || row;
    return {
      questionId: q.id ?? row.questionId,
      prompt: q.prompt || q.title || `Question ${q.id ?? row.questionId}`,
      type: q.type,
      category: q.category,
      orderIndex: row.orderIndex,
      isPinned: !!row.isPinned,
    };
  };
  const views = attached.map(linkView);
  const attachedIds = new Set(views.map((v) => v.questionId));
  // The pool is capped at the mission's Question Count (set on the mission
  // form) — attaching past it is blocked here and by the server.
  const limit = Number(mission.questionCount) || null;
  const poolFull = limit != null && views.length >= limit;

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
          <span className={`text-xs ${poolFull ? 'text-amber-300' : 'text-white/40'}`}>
            {limit != null ? `${views.length}/${limit} attached` : `${views.length} attached`}
          </span>
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="chip bg-neon/10 text-neon border border-neon/20">{v.type || 'question'}</span>
                    {v.category && (
                      <span className="chip bg-amber-400/10 text-amber-300 border border-amber-400/20">{v.category}</span>
                    )}
                  </div>
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
            {poolCategory && (
              <span className="chip bg-amber-400/10 text-amber-300 border border-amber-400/20">{poolCategory}</span>
            )}
          </h4>
          <span className="text-xs text-white/40">
            {bankLoading ? '…' : `${bank.length} in ${poolCategory ? `"${poolCategory}"` : 'bank'}`}
          </span>
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
        {canEdit && poolFull && (
          <div className="rounded-xl bg-amber-400/10 border border-amber-400/20 px-3 py-2 mb-2 text-xs text-amber-200">
            Pool is at the mission&apos;s Question Count limit ({limit}). Detach a question — or raise Question Count on
            the mission edit form — to attach more.
          </div>
        )}
        <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
          {bankLoading ? (
            <div className="py-10 grid place-items-center text-neon">
              <Spinner className="w-6 h-6" />
            </div>
          ) : bank.length === 0 ? (
            <EmptyState
              icon="help"
              title="No questions found"
              hint={
                poolCategory
                  ? `No more "${poolCategory}" questions in the bank — add some on the Question Bank page.`
                  : undefined
              }
            />
          ) : (
            bank.map((q) => {
              const isAttached = attachedIds.has(q.id);
              return (
                <div key={q.id} className="rounded-xl bg-black/20 border border-white/10 p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/85 line-clamp-2">{q.prompt || q.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="chip bg-neon/10 text-neon border border-neon/20">{q.type}</span>
                      {q.category && (
                        <span className="chip bg-amber-400/10 text-amber-300 border border-amber-400/20">{q.category}</span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => attach(q)}
                      disabled={busy || isAttached || poolFull}
                      className={
                        isAttached || poolFull
                          ? 'btn-ghost !px-2.5 !py-1.5 opacity-50 cursor-not-allowed'
                          : 'btn-primary !px-2.5 !py-1.5'
                      }
                      title={
                        isAttached
                          ? 'Already attached'
                          : poolFull
                            ? `Pool full — the mission uses ${limit} questions`
                            : 'Attach'
                      }
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
