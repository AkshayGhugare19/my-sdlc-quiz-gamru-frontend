import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from './nav.js';
import { useAuthStore } from '../store/authStore.js';
import Icon from './Icon.jsx';

export default function Sidebar() {
  const isSuper = useAuthStore((s) => s.isSuperAdmin());
  const can = useAuthStore((s) => s.can);

  // An item is visible when it isn't super-only (or the user is super) AND it
  // either has no resource or the user can view that resource.
  const canSeeItem = (it) =>
    (!it.super || isSuper) && (!it.resource || can(it.resource, 'view'));
  // A group is visible when it isn't super-only (or the user is super) and it
  // has at least one visible item.
  const visibleGroups = NAV_GROUPS.filter((g) => !g.super || isSuper)
    .map((g) => ({ ...g, items: g.items.filter(canSeeItem) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 glass-strong border-r border-white/10 z-30">
      <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon to-royal grid place-items-center text-night shadow-neon">
          <Icon name="spark" className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <div className="font-extrabold tracking-tight text-white">GamifiedLearning </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neon/80">Admin Console</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {visibleGroups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) =>
                      [
                        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-neon/15 text-neon border border-neon/25'
                          : 'text-white/65 hover:text-white hover:bg-white/5 border border-transparent',
                      ].join(' ')
                    }
                  >
                    <Icon name={it.icon} className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 text-[10px] text-white/30 text-center">
        Gamification Engine · v1.0
      </div>
    </aside>
  );
}
