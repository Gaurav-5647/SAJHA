// ===== CACHING LAYER =====
// Implements cache-aside pattern for expensive queries
// TTL values tuned to data freshness requirements

const cache = new Map();

export const withCache = async (key, ttl = 300, fn) => {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }
  
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttl * 1000 });
  return value;
};

export const clearCache = (pattern) => {
  if (pattern) {
    const regex = new RegExp(pattern);
    for (const key of cache.keys()) {
      if (regex.test(key)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
};

// Dashboard: refresh every 30 seconds when actively used, 5 min otherwise
export const getDashboardCache = (fresh) => withCache(
  'dashboard',
  fresh ? 30 : 300,
  async () => {
    // Will be populated by app.js with actual implementation
    return {};
  }
);

// Analytics: aggressive caching (5 min) - expensive query
export const getAnalyticsCache = () => withCache(
  'analytics',
  300, // 5 minutes
  async () => ({})
);

// Worker list for matching: refresh frequently (1 min) since availability changes
export const getWorkerListCache = (district, skill) => withCache(
  `workers:${district}:${skill}`,
  60, // 1 minute for availability freshness
  async () => []
);

// Service list: long TTL (30 min) - rarely changes
export const getServiceListCache = () => withCache(
  'services:enabled',
  1800, // 30 minutes
  async () => []
);

// Notifications: user-specific, short TTL (1 min)
export const getUserNotificationsCache = (userId) => withCache(
  `notifications:${userId}`,
  60,
  async () => []
);

export default { withCache, clearCache };
