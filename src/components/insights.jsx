import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal.jsx';
import { EmptyState, Spinner } from './ui.jsx';

// Medal for the top 3, otherwise a monospace #rank.
export function RankMedal({ rank }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return medal ? (
    <span className="text-lg leading-none">{medal}</span>
  ) : (
    <span className="text-white/45 font-mono text-sm">#{rank ?? '—'}</span>
  );
}

// Format a date-ish value into a short human string.
export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Generic ranked-standings modal. `load` is an async fn returning an array of rows;
// it refetches whenever the modal opens or `reloadKey` changes. `columns` is
// [{ key, label, render?(row), className?, align? }]; a leading rank column is added.
export function RankingsModal({
  open,
  onClose,
  title,
  subtitle,
  load,
  reloadKey,
  columns,
  empty = 'No entries yet',
  maxWidth = 'max-w-3xl',
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await load();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reloadKey]);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} maxWidth={maxWidth}>
      {loading ? (
        <div className="py-14 grid place-items-center text-neon">
          <Spinner className="w-7 h-7" />
        </div>
      ) : error ? (
        <div className="py-10 text-center text-red-300 text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="rank" title={empty} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/45 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="font-semibold px-4 py-3 w-14">Rank</th>
                  {columns.map((c) => (
                    <th key={c.key} className={`font-semibold px-4 py-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.userId || row.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition"
                  >
                    <td className="px-4 py-3">
                      <RankMedal rank={row.rank ?? i + 1} />
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 align-middle ${c.align === 'right' ? 'text-right' : ''} ${c.className || 'text-white/80'}`}>
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
