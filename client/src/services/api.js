// services/api.js
export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').replace(/\/$/, '');
export function assetUrl(u){ if(!u) return u; return /^https?:\/\//.test(u) ? u : API_BASE + u; }

let TOKEN = localStorage.getItem('token') || '';
export function setToken(t) { TOKEN = t; localStorage.setItem('token', t); }
export function getToken() { return TOKEN; }
export function clearToken() { TOKEN = ''; localStorage.removeItem('token'); }

async function request(path, method = 'GET', body) {
  const LOCAL_TOKEN = TOKEN || localStorage.getItem('token') || '';
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(LOCAL_TOKEN ? { 'Authorization': 'Bearer ' + LOCAL_TOKEN } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

async function upload(path, fileField, file) {
  const LOCAL_TOKEN = TOKEN || localStorage.getItem('token') || '';
  const form = new FormData();
  form.append(fileField, file);
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: LOCAL_TOKEN ? { 'Authorization': 'Bearer ' + LOCAL_TOKEN } : undefined,
    body: form
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export const api = {
  // --- Auth ---
  login: ({ email, password }) => request('/auth/login', 'POST', { email, password }),
  register: ({ email, password, name }) => request('/auth/register', 'POST', { email, password, name }),

  // --- Me / Users ---
  me: () => request('/users/me'),
  userById: (id) => request('/users/' + id),
  updateMe: (patch) => request('/users/me', 'PUT', patch),
  users: (q='') => request('/users/list?q=' + encodeURIComponent(q)),
  searchUsers: (q) => request('/users/list?q=' + encodeURIComponent(q || '')),
  uploadAvatar: (file) => upload('/upload/avatar', 'file', file),
  uploadMedia: (file) => upload('/upload/media', 'file', file),

  assetUrl: (u) => assetUrl(u),

  // --- Projects ---
  projects: (opts = {}) => {
    if (!opts || typeof opts !== 'object') return request('/projects');
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.tech) params.set('tech', opts.tech);
    if (opts.difficulty) params.set('difficulty', opts.difficulty);
    if (opts.mentorship) params.set('mentorship', opts.mentorship); // expects '1'
    const qs = params.toString();
    return request('/projects' + (qs ? `?${qs}` : ''));
  },
  project: (id) => request('/projects/' + id),
  getProject: (id) => request('/projects/' + id), // alias kept
  createProject: (data) => request('/projects', 'POST', data),
  addTask: (projectId, task) => request(`/projects/${projectId}/tasks`, 'POST', task),
  updateTask: (projectId, taskId, patch) => request(`/projects/${projectId}/tasks/${taskId}`, 'PUT', patch),
  joinProject: (projectId) => request(`/projects/${projectId}/join`, 'POST'),
  leaveProject: (projectId) => request(`/projects/${projectId}/leave`, 'POST'),

  // --- Community ---
  categories: () => request('/community/categories'),
  threads: (categoryId) => request('/community/threads?categoryId=' + encodeURIComponent(categoryId)),
  createThread: (data) => request('/community/threads', 'POST', data),
  deleteThread: (threadId) => request('/community/threads/' + threadId, 'DELETE'),
  createPost: (threadId, payload) => request(`/community/threads/${threadId}/posts`, 'POST', payload),
  deletePost: (threadId, postId) => request(`/community/threads/${threadId}/posts/${postId}`, 'DELETE'),

  // --- Jobs ---
  jobs: () => request('/jobs'),
  createJob: (data) => request('/jobs', 'POST', data),
  postJob: (data) => request('/jobs', 'POST', data),
  reportJob: (jobId, reason) => request(`/jobs/${jobId}/report`, 'POST', { reason }),

  // --- Hackathons ---
  hackathons: () => request('/hackathons'),
  createHackathon: (data) => request('/hackathons', 'POST', data),
  getHackathon: (id) => request('/hackathons/' + id),
  voteHackathon: (id) => request('/hackathons/' + id + '/vote', 'POST'),

  // --- Search ---
  searchAll: (q) => request('/search/all?q=' + encodeURIComponent(q || '')),

  // --- Admin ---
  adminDeleteFeedComment: (id) => request('/admin/feed-comments/' + id, 'DELETE'),
  adminDeleteFeedPost: (id) => request('/admin/feed/' + id, 'DELETE'),
  adminUsers: () => request('/admin/users'),
  adminUpdateUser: (userId, patch) => request(`/admin/users/${userId}`, 'PUT', patch),
  adminReports: () => request('/admin/reports'),
  adminDeleteThread: (threadId) => request('/admin/threads/' + threadId, 'DELETE'),
  adminDeleteProject: (projectId) => request('/admin/projects/' + projectId, 'DELETE'),
  adminFeatureProject: (projectId, featured) =>
    featured ? request(`/admin/projects/${projectId}/feature`, 'POST')
             : request(`/admin/projects/${projectId}/unfeature`, 'POST'),
  adminDeleteJob: (jobId) => request('/admin/jobs/' + jobId, 'DELETE'),
  adminFeatureJob: (jobId, featured) =>
    featured ? request(`/admin/jobs/${jobId}/feature`, 'POST')
             : request(`/admin/jobs/${jobId}/unfeature`, 'POST'),

  // --- Social / Friends / Follow / Block ---
  listFriends: () => request('/social/friends'),
  listFriendRequests: () => request('/social/friends/requests'),
  requestFriend: (toUserId) => request('/social/friends/request', 'POST', { toUserId }),
  respondFriend: (requestId, action) => request('/social/friends/respond', 'POST', { requestId, action }),
  removeFriend: (friendUserId) => request('/social/friends/' + friendUserId, 'DELETE'),
  follow: (userId) => request('/social/follow', 'POST', { userId }),
  unfollow: (userId) => request('/social/unfollow', 'POST', { userId }),
  listFollowers: () => request('/social/followers'),
  listFollowing: () => request('/social/following'),
  listBlocked: () => request('/social/blocked'),
  block: (userId) => request('/social/block', 'POST', { userId }),
  unblock: (userId) => request('/social/unblock', 'POST', { userId }),
  feed: (page=1) => request('/social/feed?page=' + page),
  createStatus: (content, media=[]) => request('/social/status', 'POST', { content, media }),
  editStatus: (id, content) => request('/social/status/' + id, 'PUT', { content }),
  deleteStatus: (id) => request('/social/status/' + id, 'DELETE'),
  getPost: (id) => request('/social/status/' + id),
  likeStatus: (id) => request('/social/status/' + id + '/like', 'POST'),
  unlikeStatus: (id) => request('/social/status/' + id + '/like', 'DELETE'),
  comments: (postId) => request('/social/status/' + postId + '/comments'),
  addComment: (postId, content) => request('/social/status/' + postId + '/comments', 'POST', { content }),
  editComment: (postId, commentId, content) => request('/social/status/' + postId + '/comments/' + commentId, 'PUT', { content }),
  deleteComment: (postId, commentId) => request('/social/status/' + postId + '/comments/' + commentId, 'DELETE'),
  reportPost: (postId, reason) => request('/social/status/' + postId + '/report', 'POST', { reason }),
  reportComment: (postId, commentId, reason) =>
    request(`/social/status/${postId}/comments/${commentId}/report`, 'POST', { reason }),

  // --- Ads / Metrics ---
  metrics: () => request('/admin/metrics'),
  ads: () => fetch(API_BASE + '/ads').then(r=>r.json()),
  adImpression: (adId) => request('/ads/impression', 'POST', { adId }),
  adClick: (adId) => request('/ads/click', 'POST', { adId }),

  // --- Comment likes ---
  commentLike: (postId, commentId) =>
    request(`/social/status/${postId}/comments/${commentId}/like`, 'POST'),
  commentUnlike: (postId, commentId) =>
    request(`/social/status/${postId}/comments/${commentId}/like`, 'DELETE'),

  // --- DMs ---
  dmRequest: (toUserId, message) => request('/dm/request', 'POST', { toUserId, message }),
  dmRequests: () => request('/dm/requests'),

  dmRespondRequest: (requestId, action) =>
    request('/dm/requests/respond', 'POST', { requestId, action }),

  // Start conversation — supports both server styles:
  //   A) POST /dm/start   { userId }
  //   B) POST /dm/start/:userId   (fallback if A isn’t present)
  dmStart: async (userId) => {
    try {
      return await request('/dm/start', 'POST', { userId });
    } catch (e) {
      if (e?.status === 404) {
        // fallback to :param style if server exposes that
        return request(`/dm/start/${encodeURIComponent(userId)}`, 'POST');
      }
      throw e;
    }
  },

  dmConversations: () => request('/dm/conversations'),
  dmMessages: (conversationId) => request(`/dm/${conversationId}/messages`),

  // Send: accepts string or object { content, media }
  dmSend: (conversationId, payload) => {
    const body = (typeof payload === 'string') ? { content: payload } : payload;
    return request(`/dm/${conversationId}/messages`, 'POST', body);
  },

  // Edit with PATCH first; auto-fallback to PUT if server uses it
  dmEditMessage: async (convoId, msgId, patch) => {
    try {
      return await request(`/dm/${convoId}/messages/${msgId}`, 'PATCH', patch);
    } catch (e) {
      if (e?.status === 404 || e?.status === 405) {
        return request(`/dm/${convoId}/messages/${msgId}`, 'PUT', patch);
      }
      throw e;
    }
  },

  dmDeleteMessage: (convoId, msgId) => request(`/dm/${convoId}/messages/${msgId}`, 'DELETE'),
  dmDeleteConversation: (convoId) => request(`/dm/${convoId}`, 'DELETE'),

  // --- Notifications ---
  notifications: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  markNotificationsRead: (ids, all=false) => request('/notifications/mark-read', 'POST', { ids, all }),

  // Community likes
  threadLike: (threadId) => request(`/community/${threadId}/like`, 'POST'),
  threadPostLike: (threadId, postId) => request(`/community/${threadId}/posts/${postId}/like`, 'POST'),
  threadReplyLike: (threadId, postId, replyId) => request(`/community/${threadId}/posts/${postId}/replies/${replyId}/like`, 'POST'),
};
