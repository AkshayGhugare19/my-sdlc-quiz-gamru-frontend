import { StatusPill, formatCell } from '../components/ui.jsx';
import endpoints from '../services/api.js';

// ── Shared option lists ── (values are authoritative backend enum members)
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TRAINER', 'EMPLOYEE', 'GUEST'];
const USER_STATUS = ['ACTIVE', 'INVITED', 'DISABLED'];
const DIFFICULTY = ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'];
const TOURNAMENT_TYPE = [
  'WEEKLY_CHALLENGE',
  'MONTHLY_CHALLENGE',
  'DEPARTMENT_COMPETITION',
  'ORGANIZATION_COMPETITION',
  'TIME_LIMITED',
  'MISSION_RACE',
  'SCORE_RACE',
  'XP_RACE',
  'FASTEST_COMPLETION',
];
const TOURNAMENT_STATUS = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
const METRIC = ['XP', 'STARS', 'SPEED', 'SCORE'];
const CAMPAIGN_CHANNEL = ['IN_APP', 'EMAIL', 'PUSH', 'WEBHOOK'];
const CAMPAIGN_STATUS = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED'];
const ACCESSORY_SLOT = ['EXHAUST', 'WINGS', 'BOOST', 'BLADE', 'HELMET', 'TRAIL', 'BODY', 'SPECIAL'];
const LEADERBOARD_SCOPE = ['GLOBAL', 'ORGANIZATION', 'DEPARTMENT', 'TOURNAMENT'];
const LEADERBOARD_PERIOD = ['ALL_TIME', 'SEASON', 'MONTHLY', 'WEEKLY', 'DAILY'];
const ORG_STATUS = ['ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED'];
const SHOP_KIND = ['ACCESSORY', 'COUPON', 'TITLE', 'COMPANY_REWARD', 'BADGE', 'CUSTOM'];
const REWARD_TYPE = ['XP', 'COINS', 'STARS', 'BADGE', 'TITLE', 'ACCESSORY', 'CERTIFICATE', 'COUPON', 'CUSTOM'];
const REWARD_REFTYPE = ['MISSION', 'MISSION_BUNDLE', 'TOURNAMENT'];
const UNLOCK_TYPE = ['REWARD', 'SHOP', 'DEFAULT'];
const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'IMAGE_CHOICE',
  'DRAG_DROP',
  'ARRANGE_ORDER',
  'HOTSPOT',
  'FILL_IN_BLANK',
  'MATCH_PAIR',
  'SCENARIO_BASED',
  'VIDEO_QUESTION',
  'TIMED_QUESTION',
];

// ── Reusable column & field bits ──
const publishedCol = { key: 'isPublished', label: 'Published', render: (v) => <StatusPill value={!!v} /> };
const publishedField = { name: 'isPublished', label: 'Published', type: 'checkbox', help: 'Visible to players' };
const slugField = { name: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated-if-empty', help: 'URL-safe identifier' };
const descField = { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 };
const titleCol = { key: 'title', label: 'Title', className: 'text-white font-medium' };
const nameCol = { key: 'name', label: 'Name', className: 'text-white font-medium' };
const slugCol = { key: 'slug', label: 'Slug', className: 'text-white/50 font-mono text-xs' };

// Reference option label for a user row.
const userLabel = (r) =>
  r.displayName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || String(r.id);

// ── Config map. Key === route path segment. ──
export const RESOURCE_CONFIGS = {
  users: {
    resourceKey: 'users',
    title: 'Users',
    icon: 'users',
    singular: 'User',
    subtitle: 'Employees, trainers and admins across your organization',
    filters: [
      { name: 'role', label: 'Role', options: ROLES },
      { name: 'status', label: 'Status', options: USER_STATUS },
    ],
    columns: [
      {
        key: 'firstName',
        label: 'Name',
        className: 'text-white font-medium',
        render: (v, r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—',
      },
      { key: 'email', label: 'Email', className: 'text-white/60' },
      { key: 'role', label: 'Role', render: (v) => <span className="chip bg-neon/10 text-neon border border-neon/20">{v}</span> },
      { key: 'status', label: 'Status', render: (v) => <StatusPill value={v} /> },
    ],
    fields: [
      { name: 'firstName', label: 'First name', type: 'text', required: true },
      { name: 'lastName', label: 'Last name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', help: 'Leave blank to keep unchanged' },
      { name: 'role', label: 'Role', type: 'select', options: ROLES, required: true, default: 'EMPLOYEE' },
      { name: 'status', label: 'Status', type: 'select', options: USER_STATUS, default: 'ACTIVE' },
      { name: 'departmentId', label: 'Department', type: 'reference', resource: 'departments', optionLabel: 'name', help: 'Optional — link to a department' },
    ],
  },

  departments: {
    resourceKey: 'departments',
    title: 'Departments',
    icon: 'building',
    singular: 'Department',
    subtitle: 'Organizational units for grouping employees',
    columns: [nameCol, { key: 'code', label: 'Code', className: 'text-white/50 font-mono text-xs' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', help: 'auto-generated if blank' },
      { name: 'managerId', label: 'Manager', type: 'reference', resource: 'users', optionLabel: userLabel, help: 'Optional' },
      { name: 'parentId', label: 'Parent Department', type: 'reference', resource: 'departments', optionLabel: 'name', help: 'Optional' },
    ],
  },

  courses: {
    resourceKey: 'courses',
    title: 'Courses',
    icon: 'book',
    singular: 'Course',
    subtitle: 'Learning content that missions draw from',
    filters: [{ name: 'isPublished', label: 'Published', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] }],
    columns: [titleCol, slugCol, publishedCol],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      slugField,
      descField,
      publishedField,
    ],
  },

  'learning-paths': {
    resourceKey: 'learningPaths',
    title: 'Learning Paths',
    icon: 'route',
    singular: 'Learning Path',
    subtitle: 'Ordered journeys through courses and missions',
    columns: [titleCol, slugCol, publishedCol],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      slugField,
      descField,
      publishedField,
    ],
  },

  'mission-bundles': {
    resourceKey: 'missionBundles',
    title: 'Mission Bundles',
    icon: 'layers',
    singular: 'Mission Bundle',
    subtitle: 'Pillars that group missions — the top level of the game map',
    columns: [
      titleCol,
      slugCol,
      { key: 'xpReward', label: 'XP', className: 'text-neon' },
      { key: 'starReward', label: 'Stars', className: 'text-amber-300' },
      { key: 'maxStars', label: 'Max Stars' },
      publishedCol,
    ],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      slugField,
      { name: 'xpReward', label: 'XP Reward', type: 'number', min: 0, default: 100 },
      { name: 'starReward', label: 'Star Reward', type: 'number', min: 0, default: 1 },
      { name: 'maxStars', label: 'Max Stars', type: 'number', min: 0, default: 3 },
      {
        name: 'missionIds',
        label: 'Missions in this bundle',
        type: 'multiReference',
        resource: 'missions',
        optionLabel: 'title',
        help: 'Pick missions to include (create them in the Missions page first)',
        selectedEndpoint: (id) => endpoints.missionBundle.missions(id),
      },
      descField,
      publishedField,
    ],
  },

  missions: {
    resourceKey: 'missions',
    title: 'Missions',
    icon: 'target',
    singular: 'Mission',
    subtitle: 'Playable races — click a row to manage its question pool',
    filters: [{ name: 'difficulty', label: 'Difficulty', options: DIFFICULTY }],
    columns: [
      titleCol,
      { key: 'difficulty', label: 'Difficulty', render: (v) => <span className="chip bg-white/10 text-white/70 border border-white/15">{v}</span> },
      { key: 'questionCount', label: 'Questions' },
      { key: 'xpReward', label: 'XP', className: 'text-neon' },
      { key: 'timerSec', label: 'Timer', render: (v) => (v ? `${v}s` : '—') },
      publishedCol,
    ],
    fields: [
      // A mission is created standalone. It is added to a bundle from the
      // Mission Bundles page (a bundle selects its missions), NOT here.
      { name: 'title', label: 'Title', type: 'text', required: true },
      slugField,
      { name: 'courseId', label: 'Course', type: 'reference', resource: 'courses', optionLabel: 'title', help: 'Source learning content' },
      { name: 'difficulty', label: 'Difficulty', type: 'select', options: DIFFICULTY, default: 'MEDIUM' },
      { name: 'timerSec', label: 'Timer (sec)', type: 'number', min: 0, default: 60 },
      { name: 'correctBonusSec', label: 'Correct Bonus (sec)', type: 'number', min: 0, default: 3 },
      { name: 'questionCount', label: 'Question Count', type: 'number', min: 0, default: 10 },
      { name: 'passingScorePct', label: 'Passing Score %', type: 'number', min: 0, max: 100, default: 70 },
      { name: 'maxStars', label: 'Max Stars', type: 'number', min: 0, default: 3 },
      { name: 'laneCount', label: 'Lane Count', type: 'number', min: 1, default: 3 },
      { name: 'xpReward', label: 'XP Reward', type: 'number', min: 0, default: 100 },
      descField,
      publishedField,
    ],
  },

  questions: {
    resourceKey: 'questions',
    title: 'Question Bank',
    icon: 'help',
    singular: 'Question',
    subtitle: 'Reusable questions attached to missions',
    filters: [{ name: 'type', label: 'Type', options: QUESTION_TYPES }],
    columns: [
      { key: 'prompt', label: 'Prompt', className: 'text-white font-medium max-w-md truncate' },
      { key: 'type', label: 'Type', render: (v) => <span className="chip bg-white/10 text-white/70 border border-white/15">{v}</span> },
      { key: 'category', label: 'Category', className: 'text-white/50' },
      { key: 'points', label: 'Points', className: 'text-neon' },
    ],
    fields: [
      { name: 'prompt', label: 'Prompt', type: 'textarea', required: true, colSpan: 2 },
      { name: 'type', label: 'Type', type: 'select', options: QUESTION_TYPES, required: true, default: 'SINGLE_CHOICE' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'points', label: 'Points', type: 'number', min: 0, default: 10 },
      {
        name: 'options',
        label: 'Answer Options',
        type: 'answerOptions',
        selectedEndpoint: (id) => endpoints.questionOptions.list({ questionId: id, pageSize: 100 }),
        help: 'The lanes players race into — add at least 2 and tick the correct answer (single-choice types allow exactly one).',
      },
      { name: 'explanation', label: 'Explanation', type: 'textarea', colSpan: 2, help: 'Shown after answering' },
    ],
  },

  badges: {
    resourceKey: 'badges',
    title: 'Badges',
    icon: 'badge',
    singular: 'Badge',
    subtitle: 'Awards earned for achievements',
    columns: [
      nameCol,
      { key: 'code', label: 'Code', className: 'text-white/50 font-mono text-xs' },
      { key: 'description', label: 'Description', className: 'text-white/50' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', help: 'auto from name' },
      { name: 'iconUrl', label: 'Icon URL', type: 'text' },
      descField,
    ],
  },

  ranks: {
    resourceKey: 'ranks',
    title: 'Ranks',
    icon: 'crown',
    singular: 'Rank',
    subtitle: 'Prestige tiers players climb through',
    columns: [
      nameCol,
      { key: 'tier', label: 'Tier', className: 'text-neon' },
      { key: 'minXp', label: 'Min XP', className: 'text-amber-300' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'tier', label: 'Tier', type: 'number', min: 0, default: 1 },
      { name: 'minXp', label: 'Min XP', type: 'number', min: 0, default: 0 },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'iconUrl', label: 'Icon URL', type: 'text' },
      {
        name: 'levels',
        label: 'Levels (XP bands)',
        type: 'levelBands',
        selectedEndpoint: (id) => endpoints.rank.levels(id),
        help: 'Each level is an XP band players climb within this rank. Leave XP End blank for an open-ended top band.',
      },
    ],
  },

  accessories: {
    resourceKey: 'accessories',
    title: 'Accessories',
    icon: 'hat',
    singular: 'Accessory',
    subtitle: 'Cosmetic items players equip on their avatar',
    columns: [
      nameCol,
      { key: 'slot', label: 'Slot', className: 'text-white/60' },
      { key: 'unlockType', label: 'Unlock', className: 'text-white/60' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'key', label: 'Key', type: 'text', help: 'auto' },
      { name: 'slot', label: 'Slot', type: 'select', options: ACCESSORY_SLOT },
      { name: 'unlockType', label: 'Unlock Type', type: 'select', options: UNLOCK_TYPE, default: 'REWARD' },
      { name: 'rarity', label: 'Rarity', type: 'text' },
      { name: 'iconUrl', label: 'Icon URL', type: 'text' },
      { name: 'spriteUrl', label: 'Sprite URL', type: 'text' },
      { name: 'shopPriceCoins', label: 'Shop Price (Coins)', type: 'number', min: 0 },
    ],
  },

  avatars: {
    resourceKey: 'avatars',
    title: 'Avatars',
    icon: 'ghost',
    singular: 'Avatar',
    subtitle: 'Characters players race as',
    columns: [nameCol, { key: 'key', label: 'Key', className: 'text-white/50 font-mono text-xs' }],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'key', label: 'Key', type: 'text', help: 'auto' },
      { name: 'portraitUrl', label: 'Portrait URL', type: 'text' },
      { name: 'spriteUrl', label: 'Sprite URL', type: 'text' },
      { name: 'isDefault', label: 'Default', type: 'checkbox', help: 'Assigned to new players' },
    ],
  },

  'reward-rules': {
    resourceKey: 'rewardRules',
    title: 'Reward Rules',
    icon: 'gift',
    singular: 'Reward Rule',
    subtitle: 'Automations that grant XP, badges or items on events',
    columns: [
      { key: 'type', label: 'Type', className: 'text-neon' },
      { key: 'refType', label: 'Ref Type', className: 'text-white/60' },
      { key: 'amount', label: 'Amount', className: 'text-amber-300' },
    ],
    fields: [
      { name: 'type', label: 'Reward Type', type: 'select', options: REWARD_TYPE, required: true },
      { name: 'amount', label: 'Amount', type: 'number', min: 0 },
      { name: 'refType', label: 'Ref Type', type: 'select', options: REWARD_REFTYPE, required: true },
      { name: 'missionId', label: 'Mission', type: 'reference', resource: 'missions', optionLabel: 'title', help: 'Optional' },
      { name: 'missionBundleId', label: 'Mission Bundle', type: 'reference', resource: 'mission-bundles', optionLabel: 'title', help: 'Optional' },
      { name: 'targetId', label: 'Target ID', type: 'text', help: 'badge/accessory/certificate id' },
    ],
  },

  'shop-items': {
    resourceKey: 'shopItems',
    title: 'Shop',
    icon: 'cart',
    singular: 'Shop Item',
    subtitle: 'Items players buy with earned currency',
    columns: [
      nameCol,
      { key: 'kind', label: 'Kind', className: 'text-white/60' },
      { key: 'priceCoins', label: 'Coins', className: 'text-amber-300' },
      { key: 'priceStars', label: 'Stars', className: 'text-amber-300' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'kind', label: 'Kind', type: 'select', options: SHOP_KIND, required: true },
      { name: 'priceCoins', label: 'Price (Coins)', type: 'number', min: 0, default: 0 },
      { name: 'priceStars', label: 'Price (Stars)', type: 'number', min: 0, default: 0 },
      { name: 'stock', label: 'Stock', type: 'number', min: 0, help: 'blank = unlimited' },
      { name: 'imageUrl', label: 'Image URL', type: 'text' },
      { name: 'targetId', label: 'Target ID', type: 'text' },
      { name: 'isActive', label: 'Active', type: 'checkbox', default: true },
      descField,
    ],
  },

  tournaments: {
    resourceKey: 'tournaments',
    title: 'Tournaments',
    icon: 'trophy',
    singular: 'Tournament',
    subtitle: 'Time-boxed competitions with their own races, rankings and prizes',
    filters: [{ name: 'status', label: 'Status', options: TOURNAMENT_STATUS }],
    columns: [
      nameCol,
      { key: 'type', label: 'Type', className: 'text-white/60' },
      { key: 'metric', label: 'Metric', className: 'text-white/60' },
      { key: 'status', label: 'Status', render: (v) => <StatusPill value={v} /> },
      { key: 'startsAt', label: 'Starts', className: 'text-white/60', render: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
      { key: 'endsAt', label: 'Ends', className: 'text-white/60', render: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
      { key: 'starReward', label: 'Stars', className: 'text-amber-300' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'type', label: 'Type', type: 'select', options: TOURNAMENT_TYPE, default: 'WEEKLY_CHALLENGE' },
      { name: 'status', label: 'Status', type: 'select', options: TOURNAMENT_STATUS, default: 'DRAFT', help: 'Players can only race while ACTIVE; rewards pay out automatically after the end time' },
      { name: 'metric', label: 'Metric', type: 'select', options: METRIC, help: 'What players are ranked by' },
      // Schedule — the tournament runs (and its races count) only in this window.
      { name: 'startsAt', label: 'Starts At', type: 'datetime' },
      { name: 'endsAt', label: 'Ends At', type: 'datetime', help: 'Final ranking + prizes are distributed automatically after this time' },
      // Race configuration — how this tournament's own races play (stored in gameConfig).
      { name: 'questionCount', label: 'Questions per Race', type: 'number', min: 1, max: 20, default: 5, valueFrom: (r) => r.gameConfig?.questionCount },
      { name: 'questionDifficulty', label: 'Question Difficulty', type: 'select', options: DIFFICULTY, placeholder: 'All difficulties', valueFrom: (r) => r.gameConfig?.difficulty ?? '' },
      { name: 'questionCategories', label: 'Question Categories', type: 'text', placeholder: 'e.g. SDLC Fundamentals, Racing Knowledge', help: 'Comma-separated; blank = the whole question bank', valueFrom: (r) => (r.gameConfig?.categories ?? []).join(', ') },
      { name: 'timerSec', label: 'Race Timer (sec)', type: 'number', min: 30, max: 1800, default: 180, valueFrom: (r) => r.gameConfig?.timerSec },
      { name: 'laneCount', label: 'Answer Lanes', type: 'number', min: 2, max: 4, default: 3, valueFrom: (r) => r.gameConfig?.laneCount },
      { name: 'xpPerQuestion', label: 'XP per Question', type: 'number', min: 0, max: 200, default: 20, valueFrom: (r) => r.gameConfig?.xpPerQuestion },
      // Prize pool — paid automatically to the top 3 when the tournament ends.
      { name: 'place1Xp', label: '🥇 1st Place — XP', type: 'number', min: 0, default: 500, valueFrom: (r) => r.rewardConfig?.['1']?.xp },
      { name: 'place1Coins', label: '🥇 1st Place — Coins', type: 'number', min: 0, default: 200, valueFrom: (r) => r.rewardConfig?.['1']?.coins },
      { name: 'place1Stars', label: '🥇 1st Place — Stars', type: 'number', min: 0, default: 0, valueFrom: (r) => r.rewardConfig?.['1']?.stars },
      { name: 'place2Xp', label: '🥈 2nd Place — XP', type: 'number', min: 0, default: 300, valueFrom: (r) => r.rewardConfig?.['2']?.xp },
      { name: 'place2Coins', label: '🥈 2nd Place — Coins', type: 'number', min: 0, default: 100, valueFrom: (r) => r.rewardConfig?.['2']?.coins },
      { name: 'place2Stars', label: '🥈 2nd Place — Stars', type: 'number', min: 0, default: 0, valueFrom: (r) => r.rewardConfig?.['2']?.stars },
      { name: 'place3Xp', label: '🥉 3rd Place — XP', type: 'number', min: 0, default: 150, valueFrom: (r) => r.rewardConfig?.['3']?.xp },
      { name: 'place3Coins', label: '🥉 3rd Place — Coins', type: 'number', min: 0, default: 50, valueFrom: (r) => r.rewardConfig?.['3']?.coins },
      { name: 'place3Stars', label: '🥉 3rd Place — Stars', type: 'number', min: 0, default: 0, valueFrom: (r) => r.rewardConfig?.['3']?.stars },
      { name: 'starReward', label: 'Winner Star Bonus', type: 'number', min: 0, default: 1, help: 'Extra stars for #1, on top of the prize pool' },
      { name: 'maxStars', label: 'Max Stars', type: 'number', min: 0, default: 3 },
      descField,
    ],
  },

  leaderboards: {
    resourceKey: 'leaderboards',
    title: 'Leaderboards',
    icon: 'rank',
    singular: 'Leaderboard',
    subtitle: 'Standings surfaces across metrics and scopes',
    columns: [
      { key: 'name', label: 'Name', className: 'text-white font-medium', render: (v, r) => v || r.title || '—' },
      { key: 'metric', label: 'Metric', className: 'text-white/60' },
      { key: 'scope', label: 'Scope', className: 'text-white/60' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'metric', label: 'Metric', type: 'select', options: METRIC },
      { name: 'scope', label: 'Scope', type: 'select', options: LEADERBOARD_SCOPE, help: 'Standings audience' },
      { name: 'period', label: 'Period', type: 'select', options: LEADERBOARD_PERIOD, default: 'ALL_TIME' },
    ],
  },

  campaigns: {
    resourceKey: 'campaigns',
    title: 'Campaigns',
    icon: 'megaphone',
    singular: 'Campaign',
    subtitle: 'CRM messages delivered to players',
    columns: [
      { key: 'name', label: 'Name', className: 'text-white font-medium', render: (v, r) => v || r.title || '—' },
      { key: 'channel', label: 'Channel', className: 'text-white/60' },
      { key: 'status', label: 'Status', render: (v) => <StatusPill value={v} /> },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      descField,
      { name: 'channel', label: 'Channel', type: 'select', options: CAMPAIGN_CHANNEL, help: 'Delivery surface' },
      { name: 'status', label: 'Status', type: 'select', options: CAMPAIGN_STATUS, default: 'DRAFT' },
      { name: 'content', label: 'Content', type: 'json', colSpan: 2, help: 'optional JSON {title,body,cta}' },
    ],
  },

  notifications: {
    resourceKey: 'notifications',
    title: 'Notifications',
    icon: 'bell',
    singular: 'Notification',
    subtitle: 'System messages surfaced to players',
    columns: [
      { key: 'title', label: 'Title', className: 'text-white font-medium' },
      { key: 'channel', label: 'Channel', className: 'text-white/60' },
    ],
    fields: [
      { name: 'userId', label: 'User', type: 'reference', resource: 'users', optionLabel: userLabel, required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'body', label: 'Body', type: 'textarea', colSpan: 2 },
      { name: 'channel', label: 'Channel', type: 'select', options: CAMPAIGN_CHANNEL, default: 'IN_APP' },
      { name: 'campaignId', label: 'Campaign', type: 'reference', resource: 'campaigns', optionLabel: 'name', help: 'Optional' },
    ],
  },

  'certificate-templates': {
    resourceKey: 'certificateTemplates',
    title: 'Certificate Templates',
    icon: 'certificate',
    singular: 'Certificate Template',
    subtitle: 'Designs issued on course / path completion',
    columns: [nameCol],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'backgroundUrl', label: 'Background URL', type: 'text' },
      { name: 'layout', label: 'Layout', type: 'json', colSpan: 2, help: 'JSON layout; leave blank for default' },
    ],
  },

  organizations: {
    resourceKey: 'organizations',
    title: 'Organizations',
    icon: 'building',
    singular: 'Organization',
    subtitle: 'Tenants on the platform (super-admin only)',
    columns: [
      nameCol,
      slugCol,
      { key: 'status', label: 'Status', render: (v) => <StatusPill value={v || 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      slugField,
      { name: 'status', label: 'Status', type: 'select', options: ORG_STATUS, default: 'ACTIVE' },
      descField,
    ],
  },
};

export { formatCell };
