// Centralized storage access for Ledger.
//
// Wraps the underlying `window.storage` shim (currently localStorage-backed
// via src/storage-shim.js). All values round-trip through JSON. Errors are
// intentionally silent: `load` falls back to the caller-supplied default and
// `save`/`remove` are fire-and-forget. Callers should not depend on storage
// being durable in the failure case.
//
// This module is the seam Phase 2 will replace with a Supabase-backed
// implementation; keeping the surface narrow and async makes that swap
// non-disruptive to App.jsx.

export const SCHEMA_VERSION = 7;

const KEY_PREFIX = "coach:";

export async function load(key, defaultValue) {
  try {
    const res = await window.storage.get(key);
    return res && res.value ? JSON.parse(res.value) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function save(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch {}
}

export async function remove(key) {
  try {
    await window.storage.delete(key);
  } catch {}
}

export async function exportAll() {
  try {
    const listing = await window.storage.list(KEY_PREFIX);
    const keys = listing?.keys || [];
    const snapshot = {};
    await Promise.all(
      keys.map(async (k) => {
        const res = await window.storage.get(k);
        if (res && res.value) {
          try {
            snapshot[k] = JSON.parse(res.value);
          } catch {}
        }
      })
    );
    return snapshot;
  } catch {
    return {};
  }
}

export async function importAll(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  try {
    const listing = await window.storage.list(KEY_PREFIX);
    const existing = listing?.keys || [];
    await Promise.all(existing.map((k) => window.storage.delete(k)));
  } catch {}
  await Promise.all(
    Object.entries(snapshot).map(([k, v]) => save(k, v))
  );
}
