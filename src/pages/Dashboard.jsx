import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import endpoints from '../services/api.js';
import { EmptyState, PageHeader, Spinner } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

function StatCard({ icon, label, value, accent = 'neon', delay = 0, suffix }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl p-5 relative overflow-hidden group"
    >
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition ${
          accent === 'amber' ? 'bg-amber-400' : accent === 'emerald' ? 'bg-emerald-400' : 'bg-neon'
        }`}
      />
      <div className="flex items-center justify-between relative">
        <div
          className={`w-10 h-10 rounded-xl grid place-items-center ${
            accent === 'amber'
              ? 'bg-amber-400/15 text-amber-300'
              : accent === 'emerald'
                ? 'bg-emerald-400/15 text-emerald-300'
                : 'bg-neon/15 text-neon'
          }`}
        >
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 relative">
        <div className="text-3xl font-extrabold text-white tracking-tight">
          {value}
          {suffix && <span className="text-lg text-white/40 font-bold">{suffix}</span>}
        </div>
        <div className="text-sm text-white/45 mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
}

function Bar({ pct }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-royal to-neon" style={{ width: `${p}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [pillars, setPillars] = useState([]);
  const [hardest, setHardest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [o, p, h] = await Promise.allSettled([
          endpoints.analytics.overview(),
          endpoints.analytics.pillars(),
          endpoints.analytics.hardestQuestions(),
        ]);
        if (!alive) return;
        if (o.status === 'fulfilled') setOverview(o.value);
        else setError(o.reason?.message || 'Failed to load analytics');
        if (p.status === 'fulfilled') setPillars(Array.isArray(p.value) ? p.value : p.value?.items || []);
        if (h.status === 'fulfilled') setHardest(Array.isArray(h.value) ? h.value : h.value?.items || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const c = overview?.counts || {};
  const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}`);

  if (loading) {
    return (
      <div className="py-24 grid place-items-center text-neon">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Engine health and learning analytics at a glance"
        icon="grid"
      />

      {error && !overview && (
        <div className="glass rounded-2xl p-6 text-center text-white/50 mb-6">
          <Icon name="bars" className="w-8 h-8 mx-auto mb-2 text-white/30" />
          Could not reach the analytics API. {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard icon="users" label="Employees" value={c.employees ?? 0} delay={0.02} />
        <StatCard icon="target" label="Missions" value={c.missions ?? 0} delay={0.06} />
        <StatCard icon="layers" label="Bundles" value={c.bundles ?? 0} delay={0.1} />
        <StatCard icon="book" label="Courses" value={c.courses ?? 0} delay={0.14} />
        <StatCard icon="help" label="Questions" value={c.questions ?? 0} delay={0.18} />
        <StatCard
          icon="check"
          label="Completion"
          value={pct(overview?.completionRate)}
          suffix="%"
          accent="emerald"
          delay={0.22}
        />
        <StatCard
          icon="spark"
          label="Avg Score"
          value={pct(overview?.averageScore)}
          suffix="%"
          accent="amber"
          delay={0.26}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Pillars table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="xl:col-span-2 glass rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Icon name="layers" className="w-5 h-5 text-neon" />
              <h3 className="font-bold text-white">Performance by Pillar</h3>
            </div>
            <span className="text-xs text-white/40">{pillars.length} bundles</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="px-5 py-2.5 font-semibold">Pillar</th>
                  <th className="px-4 py-2.5 font-semibold">Missions</th>
                  <th className="px-4 py-2.5 font-semibold">Attempts</th>
                  <th className="px-4 py-2.5 font-semibold">Avg Score</th>
                  <th className="px-4 py-2.5 font-semibold">Completion</th>
                </tr>
              </thead>
              <tbody>
                {pillars.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon="layers" title="No pillar data yet" />
                    </td>
                  </tr>
                ) : (
                  pillars.map((p) => (
                    <tr key={p.bundleId || p.title} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-5 py-3 text-white font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-white/70">{p.missions ?? 0}</td>
                      <td className="px-4 py-3 text-white/70">{p.attempts ?? 0}</td>
                      <td className="px-4 py-3 text-amber-300">{p.averageScore != null ? `${Math.round(p.averageScore)}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bar pct={p.completionRate} />
                          <span className="text-white/60 text-xs w-9">{Math.round(p.completionRate || 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Hardest questions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
            <Icon name="help" className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-white">Hardest Questions</h3>
          </div>
          <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
            {hardest.length === 0 ? (
              <EmptyState icon="help" title="No question data yet" />
            ) : (
              hardest.slice(0, 12).map((q, i) => {
                const rate =
                  q.correctRate ?? q.accuracy ?? q.successRate ?? (q.averageScore != null ? q.averageScore : null);
                return (
                  <div key={q.id || q.questionId || i} className="rounded-xl bg-black/20 border border-white/5 p-3">
                    <div className="flex items-start gap-2">
                      <span className="chip bg-amber-400/15 text-amber-300 border border-amber-400/25 shrink-0">#{i + 1}</span>
                      <p className="text-sm text-white/80 line-clamp-2">{q.prompt || q.title || `Question ${q.id}`}</p>
                    </div>
                    {rate != null && (
                      <div className="mt-2 flex items-center gap-2">
                        <Bar pct={rate} />
                        <span className="text-xs text-white/50">{Math.round(rate)}% correct</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
