import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import endpoints from '../services/api.js';
import Icon from './Icon.jsx';
import { EmptyState, Spinner, StatusPill } from './ui.jsx';
import { fmtDate } from './insights.jsx';

function Bar({ pct, accent = 'neon' }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const grad = accent === 'amber' ? 'from-amber-500 to-amber-300' : 'from-royal to-neon';
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function Stat({ label, value, accent = 'white' }) {
  const color =
    accent === 'neon' ? 'text-neon' : accent === 'amber' ? 'text-amber-300' : accent === 'emerald' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="glass rounded-xl px-3 py-2.5 text-center">
      <div className={`text-xl font-extrabold tracking-tight ${color}`}>{value ?? 0}</div>
      <div className="text-[11px] text-white/45 mt-0.5">{label}</div>
    </div>
  );
}

function Section({ icon, title, count, children }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Icon name={icon} className="w-4 h-4 text-neon" />
          <h4 className="font-bold text-white text-sm">{title}</h4>
        </div>
        {count != null && <span className="text-xs text-white/40">{count}</span>}
      </div>
      {children}
    </div>
  );
}

// Rich, read-only employee profile built from GET /users/:id/progress.
export default function EmployeeProfile({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await endpoints.insight.userProgress(userId);
        if (alive) setData(res || {});
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="py-16 grid place-items-center text-neon">
        <Spinner className="w-7 h-7" />
      </div>
    );
  }
  if (error) return <div className="py-10 text-center text-red-300 text-sm">{error}</div>;

  const user = data?.user || {};
  const stats = data?.stats || {};
  const missionProgress = data?.missionProgress || [];
  const bundleProgress = data?.bundleProgress || [];
  const tournaments = data?.tournaments || [];
  const recentAttempts = data?.recentAttempts || [];
  const badges = data?.badges || [];
  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-white/15" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon to-royal grid place-items-center text-night font-extrabold text-xl shadow-neon">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-extrabold text-white truncate">{user.name || user.email || 'Employee'}</h3>
            {user.role && <span className="chip bg-neon/10 text-neon border border-neon/20">{user.role}</span>}
            {user.rank && (
              <span
                className="chip bg-amber-400/10 text-amber-300 border border-amber-400/25"
                style={user.rank.color ? { color: user.rank.color } : undefined}
              >
                {user.rank.name || user.rank}
              </span>
            )}
          </div>
          <div className="text-sm text-white/45">{user.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Stat label="Level" value={user.level} accent="neon" />
          <Stat label="Total XP" value={user.totalXp} accent="neon" />
          <Stat label="Stars" value={user.stars} accent="amber" />
          <Stat label="Coins" value={user.coins} accent="amber" />
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        <Stat label="Missions" value={stats.missionsJoined} />
        <Stat label="Bundles" value={stats.bundlesJoined} />
        <Stat label="Tournaments" value={stats.tournamentsJoined} />
        <Stat label="Answered" value={stats.answered} />
        <Stat label="Correct" value={stats.correct} accent="emerald" />
        <Stat label="Wrong" value={stats.wrong} accent="amber" />
        <Stat label="Accuracy" value={stats.accuracy != null ? `${Math.round(stats.accuracy)}%` : '—'} accent="neon" />
        <Stat label="Badges" value={stats.badges} />
        <Stat label="Accessories" value={stats.accessories} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Missions */}
        <Section icon="target" title="Missions" count={missionProgress.length}>
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {missionProgress.length === 0 ? (
              <EmptyState icon="target" title="No missions joined" />
            ) : (
              missionProgress.map((m, i) => (
                <motion.div
                  key={m.id || m.title || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl bg-black/20 border border-white/5 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white/85 truncate">{m.title}</p>
                    <StatusPill value={m.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Bar pct={m.completionPct} />
                    <span className="text-xs text-white/50 w-9 text-right">{Math.round(m.completionPct || 0)}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-white/45">
                    <span className="text-amber-300">★ {m.starsEarned ?? 0}</span>
                    <span>Best {m.bestScorePct != null ? `${Math.round(m.bestScorePct)}%` : '—'}</span>
                    <span>{m.attempts ?? 0} attempts</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Section>

        {/* Mission Bundles */}
        <Section icon="layers" title="Mission Bundles" count={bundleProgress.length}>
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {bundleProgress.length === 0 ? (
              <EmptyState icon="layers" title="No bundles joined" />
            ) : (
              bundleProgress.map((b, i) => (
                <div key={b.id || b.title || i} className="rounded-xl bg-black/20 border border-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white/85 truncate">{b.title}</p>
                    <StatusPill value={b.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Bar pct={b.completionPct} />
                    <span className="text-xs text-white/50 w-9 text-right">{Math.round(b.completionPct || 0)}%</span>
                  </div>
                  <div className="mt-1.5 text-xs text-amber-300">★ {b.starsEarned ?? 0}</div>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* Tournaments */}
        <Section icon="trophy" title="Tournaments joined" count={tournaments.length}>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {tournaments.length === 0 ? (
              <EmptyState icon="trophy" title="No tournaments joined" />
            ) : (
              tournaments.map((t, i) => (
                <div key={t.id || t.name || i} className="rounded-xl bg-black/20 border border-white/5 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white/85 truncate">{t.name}</p>
                    <p className="text-xs text-white/40">{t.type}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    {t.placement != null && <span className="chip bg-white/10 text-white/70 border border-white/15">#{t.placement}</span>}
                    <span className="text-neon">{t.score ?? 0} pts</span>
                    <span className="text-amber-300">★ {t.stars ?? 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* Badges */}
        <Section icon="badge" title="Badges earned" count={badges.length}>
          <div className="p-3">
            {badges.length === 0 ? (
              <EmptyState icon="badge" title="No badges yet" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <div key={b.id || b.name || i} className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/10 px-3 py-2">
                    {b.iconUrl ? (
                      <img src={b.iconUrl} alt="" className="w-6 h-6 rounded" />
                    ) : (
                      <Icon name="badge" className="w-5 h-5 text-amber-300" />
                    )}
                    <span className="text-sm text-white/80">{b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Recent attempts */}
      <Section icon="spark" title="Recent attempts" count={recentAttempts.length}>
        <div className="overflow-x-auto">
          {recentAttempts.length === 0 ? (
            <EmptyState icon="spark" title="No attempts recorded" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/45 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="font-semibold px-4 py-2.5">Mission</th>
                  <th className="font-semibold px-4 py-2.5">Score</th>
                  <th className="font-semibold px-4 py-2.5">Stars</th>
                  <th className="font-semibold px-4 py-2.5">Rating</th>
                  <th className="font-semibold px-4 py-2.5">Status</th>
                  <th className="font-semibold px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.map((a, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-white/85">{a.missionTitle}</td>
                    <td className="px-4 py-2.5 text-neon">{a.scorePct != null ? `${Math.round(a.scorePct)}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-amber-300">★ {a.stars ?? 0}</td>
                    <td className="px-4 py-2.5 text-white/60">{a.rating ?? '—'}</td>
                    <td className="px-4 py-2.5"><StatusPill value={a.status} /></td>
                    <td className="px-4 py-2.5 text-white/50">{fmtDate(a.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}
