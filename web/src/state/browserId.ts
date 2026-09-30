/**
 * An anonymous, per-browser identity for the server's fairness cap — not an account and
 * not a security boundary. A visitor who clears it just draws from a fresh 40-unit ration;
 * the hard site-wide cap is server-owned and never keyed by anything client-controlled, so
 * this can only ever reshuffle who spends the shared budget, never raise it.
 */

const STORAGE_KEY = 'yincol:browser-id';

export function getOrCreateBrowserId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Private browsing or blocked storage: fall back to a per-call id rather than throw.
    // Every request then draws from the shared "unknown" fairness bucket, which is safe —
    // the site-wide cap still applies regardless.
    return crypto.randomUUID();
  }
}
