import { useState } from 'react';
import endpoints from '../services/api.js';
import { RESOURCE_CONFIGS } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Icon from '../components/Icon.jsx';
import { RankingsModal } from '../components/insights.jsx';
import { useAuthStore } from '../store/authStore.js';

const columns = [
  { key: 'userId', label: 'Player', render: (r) => r.user?.name || r.name || r.userId || '—', className: 'text-white/85' },
  { key: 'score', label: 'Score', align: 'right', className: 'text-neon', render: (r) => r.score ?? 0 },
  { key: 'starsEarned', label: 'Stars', align: 'right', className: 'text-amber-300', render: (r) => `★ ${r.starsEarned ?? r.stars ?? 0}` },
  { key: 'placement', label: 'Placement', align: 'right', render: (r) => (r.placement != null ? `#${r.placement}` : '—') },
];

export default function Tournaments() {
  const [ranked, setRanked] = useState(null);
  const canView = useAuthStore((s) => s.can('tournaments', 'view'));

  return (
    <>
      <ResourceTable
        {...RESOURCE_CONFIGS.tournaments}
        resource="tournaments"
        rowActions={(row) =>
          canView ? (
            <button
              onClick={() => setRanked(row)}
              className="p-1.5 rounded-lg text-white/50 hover:text-neon hover:bg-white/5 transition"
              title="Rankings"
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
        subtitle="Standings for this tournament"
        columns={columns}
        empty="No rankings yet"
        load={async () => {
          const res = await endpoints.tournamentRankings(ranked.id);
          return Array.isArray(res) ? res : res?.rankings || res?.items || [];
        }}
      />
    </>
  );
}
