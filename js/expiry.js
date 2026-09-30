/**
 * StockEx — Expiry Engine
 * Implements PRD Section 9 exactly:
 *   > 30 days   -> Safe
 *   8–30 days   -> Expiring soon
 *   1–7 days    -> Urgent
 *   0 days      -> Expires today
 *   < 0 days    -> Expired
 *
 * Status is never stored — it is always recalculated from expiry_date at
 * read time (PRD Section 7). This module is the ONLY place that math lives,
 * so every page (Dashboard, Inventory, Add Product, Reports) stays consistent.
 * Thresholds are read from THRESHOLDS below so Settings -> Expiry Thresholds
 * (Phase 3) can later override them without touching this logic.
 */

const THRESHOLDS = {
  urgentMax: 7,   // 1–7 days = Urgent
  expiringMax: 30 // 8–30 days = Expiring soon
};

const TIER_META = {
  safe:     { label: 'Safe',           badgeClass: 'badge--safe' },
  expiring: { label: 'Expiring soon',  badgeClass: 'badge--expiring' },
  urgent:   { label: 'Urgent',         badgeClass: 'badge--urgent' },
  today:    { label: 'Expires today',  badgeClass: 'badge--today' },
  expired:  { label: 'Expired',        badgeClass: 'badge--expired' }
};

function daysUntil(expiryDateStr, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(expiryDateStr + 'T00:00:00');
  return Math.round((end - start) / 86400000);
}

function getTier(diffDays) {
  if (diffDays < 0) return 'expired';
  if (diffDays === 0) return 'today';
  if (diffDays <= THRESHOLDS.urgentMax) return 'urgent';
  if (diffDays <= THRESHOLDS.expiringMax) return 'expiring';
  return 'safe';
}

function calculateExpiryStatus(expiryDateStr, today = new Date()) {
  const diffDays = daysUntil(expiryDateStr, today);
  const tier = getTier(diffDays);
  const meta = TIER_META[tier];

  let detail;
  if (tier === 'expired') detail = `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
  else if (tier === 'today') detail = 'today';
  else detail = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;

  return { tier, diffDays, label: meta.label, badgeClass: meta.badgeClass, detail };
}

// Exposed for use by page-level scripts (no bundler in this static build)
window.StockExExpiry = { THRESHOLDS, TIER_META, daysUntil, getTier, calculateExpiryStatus };
