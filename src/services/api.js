// ============================================================================
// The SINGLE place the Gamru  Admin Console talks to the Gamru  REST API.
// There is no admin backend — every endpoint below is served by the Gamru 
// API (VITE_GAMRU_API_URL). This file owns: the axios instance, the auth
// token plumbing (localStorage `ng_token`), the { success, message, data }
// envelope unwrapping, and a single `endpoints` object grouping every call.
// ============================================================================
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_GAMRU_API_URL || 'http://localhost:4000';

export const TOKEN_KEY = 'ng_token';
export const ORG_KEY = 'ng_org'; // super-admin "act as tenant" org id

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getActingOrg() {
  return localStorage.getItem(ORG_KEY);
}
export function setActingOrg(orgId) {
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
  else localStorage.removeItem(ORG_KEY);
}

const http = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 25000 });

// Request interceptor: attach bearer token + optional super-admin org header.
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const org = getActingOrg();
  if (org) config.headers['x-organization-id'] = org;
  return config;
});

// Response interceptor: unwrap the { success, message, data } envelope; on 401
// clear the token so the app kicks back to /login. Surface a clean Error.
http.interceptors.response.use(
  (res) => (res.data && Object.prototype.hasOwnProperty.call(res.data, 'data') ? res.data.data : res.data),
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      // Let route guards react on next render.
      window.dispatchEvent(new Event('ng:unauthorized'));
    }
    const message =
      err.response?.data?.message || err.response?.data?.error || err.message || 'Request failed';
    // Preserve the backend's structured detail so forms can surface field-level
    // messages (e.g. 422/409 → { errors: { slug: 'slug already exists' } }).
    const e = new Error(message);
    e.fieldErrors = err.response?.data?.errors;
    e.status = err.response?.status;
    return Promise.reject(e);
  },
);

// Generic CRUD factory — every list resource shares this shape.
const crud = (resource) => ({
  list: (params) => http.get(`/${resource}`, { params }),
  get: (id) => http.get(`/${resource}/${id}`),
  create: (payload) => http.post(`/${resource}`, payload),
  update: (id, payload) => http.put(`/${resource}/${id}`, payload),
  remove: (id) => http.delete(`/${resource}/${id}`),
});

export const endpoints = {
  baseUrl: BASE_URL,
  http,

  // ── Auth ──
  auth: {
    login: (email, password) => http.post('/auth/login', { email, password }),
    me: () => http.get('/auth/me'),
  },

  // ── Analytics ──
  analytics: {
    overview: () => http.get('/analytics/overview'),
    pillars: () => http.get('/analytics/pillars'),
    hardestQuestions: () => http.get('/analytics/questions/hardest'),
  },

  // ── Generic CRUD resources ──
  organizations: crud('organizations'),
  departments: crud('departments'),
  users: crud('users'),
  courses: crud('courses'),
  contentBlocks: crud('content-blocks'),
  learningPaths: crud('learning-paths'),
  missionBundles: crud('mission-bundles'),
  missions: crud('missions'),
  // Questions + the distinct-categories helper that powers the mission category picker.
  questions: { ...crud('questions'), categories: () => http.get('/questions/categories') },
  questionOptions: crud('question-options'),
  ranks: crud('ranks'),
  badges: crud('badges'),
  achievements: crud('achievements'),
  rewardRules: crud('reward-rules'),
  avatars: crud('avatars'),
  accessories: crud('accessories'),
  shopItems: crud('shop-items'),
  leaderboards: crud('leaderboards'),
  tournaments: crud('tournaments'),
  campaigns: crud('campaigns'),
  notifications: crud('notifications'),
  certificateTemplates: crud('certificate-templates'),

  // ── Per-feature default data (idempotent: existing records are skipped) ──
  defaults: {
    seed: (feature) => http.post(`/defaults/${feature}`),
  },

  // ── Accessory unlock wiring (which mission drops it) ──
  accessory: {
    rewardMission: (id) => http.get(`/accessories/${id}/reward-mission`),
  },

  // ── Course roadmap builder (a course SELECTS existing missions/bundles/tournaments) ──
  course: {
    missions: (id) => http.get(`/courses/${id}/missions`),
    bundles: (id) => http.get(`/courses/${id}/bundles`),
    tournaments: (id) => http.get(`/courses/${id}/tournaments`),
  },

  // ── Mission builder extras ──
  mission: {
    questions: (missionId) => http.get(`/missions/${missionId}/questions`),
    attachQuestion: (missionId, payload) => http.post(`/missions/${missionId}/questions`, payload),
    detachQuestion: (missionId, questionId) =>
      http.delete(`/missions/${missionId}/questions/${questionId}`),
  },

  // ── Mission-bundle builder (assemble already-created missions into a bundle) ──
  missionBundle: {
    missions: (id) => http.get(`/mission-bundles/${id}/missions`),
    available: (id) => http.get(`/mission-bundles/${id}/available-missions`),
    attach: (id, missionId, orderIndex) =>
      http.post(`/mission-bundles/${id}/missions`, { missionId, orderIndex }),
    reorder: (id, missionId, orderIndex) =>
      http.put(`/mission-bundles/${id}/missions/${missionId}`, { orderIndex }),
    detach: (id, missionId) => http.delete(`/mission-bundles/${id}/missions/${missionId}`),
    progress: (id) => http.get(`/mission-bundles/${id}/progress`),
  },

  // ── Rank → levels builder (levels live inside a rank as XP bands) ──
  rank: {
    levels: (rankId) => http.get(`/ranks/${rankId}/levels`),
    addLevel: (rankId, payload) => http.post(`/ranks/${rankId}/levels`, payload),
    updateLevel: (rankId, levelId, payload) => http.put(`/ranks/${rankId}/levels/${levelId}`, payload),
    deleteLevel: (rankId, levelId) => http.delete(`/ranks/${rankId}/levels/${levelId}`),
  },

  // ── Admin insight: participation, standings & employee profile ──
  insight: {
    missionPlayers: (id) => http.get(`/missions/${id}/players`),
    bundleLeaderboard: (id) => http.get(`/mission-bundles/${id}/leaderboard`),
    userProgress: (id) => http.get(`/users/${id}/progress`),
    structure: () => http.get('/users/structure'),
  },

  // ── Media library ──
  media: {
    list: (params) => http.get('/media', { params }),
    upload: (formData) =>
      http.post('/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    remove: (id) => http.delete(`/media/${id}`),
  },

  // ── Competition rankings ──
  leaderboardRankings: (id) => http.get(`/leaderboards/${id}/rankings`),
  tournamentRankings: (id) => http.get(`/tournaments/${id}/rankings`),
};

// Resolve a crud group by kebab/camel resource key (used by the generic pages).
export function resourceApi(key) {
  return endpoints[key];
}

export default endpoints;
