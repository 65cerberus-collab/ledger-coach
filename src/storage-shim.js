// Shim window.storage to use localStorage — so the app runs outside Claude artifacts
// The app already uses window.storage.get/set/delete/list; this preserves that API.

if (typeof window !== 'undefined' && !window.storage) {
  const PREFIX = 'ledger:';

  window.storage = {
    async get(key) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return null;
        return { key, value: raw, shared: false };
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, value);
        return { key, value, shared: false };
      } catch {
        return null;
      }
    },
    async delete(key) {
      try {
        localStorage.removeItem(PREFIX + key);
        return { key, deleted: true, shared: false };
      } catch {
        return null;
      }
    },
    async list(prefix = '') {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX + prefix)) {
            keys.push(k.slice(PREFIX.length));
          }
        }
        return { keys, prefix, shared: false };
      } catch {
        return null;
      }
    }
  };
}
