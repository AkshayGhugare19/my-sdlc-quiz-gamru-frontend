# CLAUDE.md — Gamru admin console

Frontend-only admin console for staff (SUPER_ADMIN / ADMIN / TRAINER / MANAGER). React 18 + Vite 6 +
Tailwind 3 + zustand + react-router 6 + react-hook-form + framer-motion + **xlsx (SheetJS)**. No backend
of its own — it calls the Gamru API directly (sibling repo `my-sdlc-quiz-gamru-backend`,
`:4000`). Folder is `my-sdlc-quiz-gamru-frontend` but package/brand is "Gamru".

**The architecture is config-driven:** most pages are generic CRUD generated from a single config map.
Before adding a page, check whether it can just be a new `RESOURCE_CONFIGS` entry.

## Run

```bash
npm install
npm run dev       # vite on :5173
```

`.env`: `VITE_GAMRU_API_URL=http://localhost:4000` (axios appends `/api`), `VITE_APP_NAME`,
`VITE_DOCUMENTATION_URL`. Start the backend first. Demo staff login: `admin@acme.com` / `Password123!`
(or `superadmin@platform.com`).

## Key files

- **`src/config/resourceConfigs.jsx`** — the single source of truth. `RESOURCE_CONFIGS[path] =
  {resourceKey, title, filters, columns, fields, defaultsFeature?}` for every resource, plus all the
  enum option lists (ROLES, DIFFICULTY, TOURNAMENT_TYPE/STATUS, METRIC, ACCESSORY_SLOT, SHOP_KIND,
  REWARD_TYPE, …). **Adding a managed resource usually = adding an entry here.**
- **`src/components/ResourceTable.jsx`** — generic CRUD page engine (list/search/filter/paginate +
  create/edit/delete modals + "Add Default Data" seed).
- **`src/components/ResourceForm.jsx`** — react-hook-form renderer with all field widgets:
  reference / multiReference / remoteSelect / dependentReference / answerOptions / levelBands / json /
  datetime. Async widgets start `undefined` when editing so a premature save can't wipe existing links.
- **`src/services/api.js`** — the single axios client. Base `VITE_GAMRU_API_URL + /api`. Request
  interceptor injects `Authorization: Bearer ng_token` + `x-organization-id: ng_org` (super-admin
  impersonation). Response unwraps `{success,data}`; on 401 dispatches `ng:unauthorized`; rethrows
  `Error` with `.fieldErrors` + `.status` for form-level errors. `crud(resource)` factory + `endpoints`
  object (auth, analytics, all CRUD resources, `defaults.seed`, builder endpoints for
  mission/missionBundle/rank/course, insight, media).
- `src/store/authStore.js` — zustand. `token` (localStorage `ng_token`), `user` (role + `abilities`),
  `actingOrg` (localStorage `ng_org`). Selectors `isSuperAdmin()`, `can(resource, action)`.
- `src/App.jsx` — routing + RBAC + `bootstrap()` (verifies token via `/auth/me`) + `ng:unauthorized`
  listener. `src/components/nav.js` — sidebar `NAV_GROUPS`. `src/pages/` — dedicated pages/builders.

## Routing & RBAC

`/login` public; everything else under `<ProtectedRoute><Layout/></ProtectedRoute>`, each page wrapped
in `<RequireAbility resource=… action="view">`. **Dedicated pages** (missions, questions,
mission-bundles, ranks, users, system-users, team-structure, tournaments, leaderboards, media) have
bespoke components; every other `RESOURCE_CONFIGS` key is auto-mounted as a `<ResourceTable/>`.

**GOTCHA — two different keys:** RBAC `can()` uses the **kebab route path** (via the `resource` prop +
`PAGE_RESOURCE` remap, e.g. system-users→users), while the API layer uses the **camelCase
`resourceKey`** for `endpoints` lookup. Don't conflate them.

## Pages & builders (`src/pages/`)

- **Dashboard** — analytics (7 KPI cards + per-pillar table + hardest questions; `Promise.allSettled`).
- **Missions** — CRUD + **MissionBuilder** (attach/detach/pin questions, capped at `questionCount`) +
  Players modal. `questionCategory` remoteSelect auto-attaches all ACTIVE questions in the category on save.
- **MissionBundles** — CRUD + **BundleBuilder** (ordered assembly) + Leaderboard modal.
- **Questions** — CRUD (AnswerOptionsEditor) + **xlsx bulk import** (only place xlsx is used;
  template columns prompt/type/category/difficulty/points/explanation/option1-4/correct; import posts
  rows one-by-one through the normal `endpoints.questions.create()`; import-only, no export).
- **Tournaments** — CRUD; race config lives in `gameConfig`, prize pool in `rewardConfig` (nested via
  `valueFrom`) + Rankings modal.
- **Ranks** (+LevelManager), **Users** (players; EmployeeProfile modal with inline wallet edit),
  **SystemUsers** (staff; super-admin org picker), **TeamStructure** (read-only), **Media** (upload).
- Generic CRUD (via config): organizations (super-only), departments, courses, learning-paths, badges,
  accessories, avatars, reward-rules, shop-items, campaigns, notifications, certificate-templates.

## Conventions

- New managed resource → add to `RESOURCE_CONFIGS`; it auto-gets a route, sidebar entry (add to
  `nav.js`), table, and form. Only build a dedicated page when it needs a builder/insight modal.
- All backend calls go through `services/api.js` (`endpoints` / `crud`) — never call axios elsewhere.
- Gate every page with `RequireAbility` and every nav item with `can(resource,'view')`.
- Style with `index.css` classes (`.glass/.btn-*/.field/.chip`) and shared `ui.jsx`/`Modal.jsx`/
  `Icon.jsx` (inline SVG, no icon lib). Use framer-motion like existing pages.
