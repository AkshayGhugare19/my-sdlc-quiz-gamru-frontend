import { useState } from 'react';
import endpoints from '../services/api.js';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Icon from '../components/Icon.jsx';
import { RankingsModal } from '../components/insights.jsx';
import { useAuthStore } from '../store/authStore.js';

const columns = [
  {
    key: 'user',
    label: 'User',
    className: 'text-white/85',
    render: (r) => r.user?.name || r.user?.displayName || r.user?.email || r.name || r.userId || '—',
  },
  { key: 'score', label: 'Score', align: 'right', className: 'text-neon', render: (r) => r.score ?? 0 },
];

export default function Leaderboards() {
  const [ranked, setRanked] = useState(null);
  const canView = useAuthStore((s) => s.can('leaderboards', 'view'));

  return (
    <>
      <ResourceTable
        {...RESOURCE_CONFIGS.leaderboards}
        resource="leaderboards"
        rowActions={(row) =>
          canView ? (
            <button
              onClick={() => setRanked(row)}
              className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
              title="View rankings"
            >
              <Icon name="rank" className="w-4 h-4" />
            </button>
          ) : null
        }
      />
      <RankingsModal
        open={!!ranked}
        onClose={() => setRanked(null)}
        reloadKey={ranked?.id}
        title={ranked ? `${ranked.name} — Rankings` : 'Rankings'}
        subtitle="Standings for this leaderboard"
        columns={columns}
        empty="No rankings yet"
        load={async () => {
          const res = await endpoints.leaderboardRankings(ranked.id);
          return Array.isArray(res) ? res : res?.rankings || res?.items || [];
        }}
      />
    </>
  );
}
