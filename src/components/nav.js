// Sidebar navigation structure. `super` items only show for super/platform admins.
// `resource` gates visibility via can(resource, 'view'); items without a resource
// (e.g. Overview) are always visible.
export const NAV_GROUPS = [
  {
    title: null,
    items: [{ to: '/', label: 'Overview', icon: 'grid', end: true }],
  },
  {
    title: 'Content',
    items: [
      { to: '/courses', label: 'Courses', icon: 'hat', resource: 'courses' },
      { to: '/learning-paths', label: 'Learning Paths', icon: 'route', resource: 'learning-paths' },
      { to: '/media', label: 'Media', icon: 'image', resource: 'media' },
    ],
  },
  {
    title: 'Missions',
    items: [
      { to: '/mission-bundles', label: 'Mission Bundles', icon: 'layers', resource: 'mission-bundles' },
      { to: '/missions', label: 'Missions', icon: 'target', resource: 'missions' },
      { to: '/questions', label: 'Question Bank', icon: 'help', resource: 'questions' },
    ],
  },
  {
    title: 'Gamification',
    items: [
      { to: '/badges', label: 'Badges', icon: 'badge', resource: 'badges' },
      { to: '/ranks', label: 'Ranks', icon: 'crown', resource: 'ranks' },
      { to: '/accessories', label: 'Accessories', icon: 'spark', resource: 'accessories' },
      { to: '/avatars', label: 'Avatars', icon: 'ghost', resource: 'avatars' },
      { to: '/reward-rules', label: 'Reward Rules', icon: 'gift', resource: 'reward-rules' },
      { to: '/shop-items', label: 'Shop', icon: 'cart', resource: 'shop-items' },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { to: '/tournaments', label: 'Tournaments', icon: 'trophy', resource: 'tournaments' },
      { to: '/leaderboards', label: 'Leaderboards', icon: 'rank', resource: 'leaderboards' },
      { to: '/campaigns', label: 'Campaigns', icon: 'megaphone', resource: 'campaigns' },
      { to: '/notifications', label: 'Notifications', icon: 'bell', resource: 'notifications' },
      { to: '/certificate-templates', label: 'Certificates', icon: 'certificate', resource: 'certificate-templates' },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/users', label: 'Users', icon: 'users', resource: 'users' },
      // No 'shield' glyph in Icon.jsx — reuse 'crown' for staff accounts.
      { to: '/system-users', label: 'System Users', icon: 'crown', resource: 'users' },
      { to: '/team-structure', label: 'Team Structure', icon: 'layers', resource: 'users' },
      { to: '/departments', label: 'Departments', icon: 'building', resource: 'departments' },
    ],
  },
  {
    title: 'Platform',
    super: true,
    items: [{ to: '/organizations', label: 'Organizations', icon: 'building', super: true, resource: 'organizations' }],
  },
];
