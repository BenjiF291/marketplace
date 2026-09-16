function normalizeSellPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeScheduleDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getListingStatus(listing, now = new Date()) {
  if (!listing) return 'inactive';
  const current = now instanceof Date ? now : new Date(now);
  const scheduledAt = normalizeScheduleDate(listing.scheduledAt);
  const expiresAt = normalizeScheduleDate(listing.expiresAt);

  if (scheduledAt && current.getTime() < scheduledAt.getTime()) return 'scheduled';
  if (expiresAt && current.getTime() >= expiresAt.getTime()) return 'expired';
  if (scheduledAt && current.getTime() >= scheduledAt.getTime()) return 'active';
  return 'active';
}

function vipPercent(value) {
  const percent=Number(value||0);
  return Number.isInteger(percent)&&percent>=0&&percent<=99?percent:0;
}
function vipPrice(price,percent,currency='footy') {
  const amount=Number(price)*(100-vipPercent(percent))/100;
  return Math.min(Number(price),currency==='footy'?Math.max(.01,Math.round(amount*100)/100):Math.max(1,Math.ceil(amount)));
}

module.exports = {
  vipPercent, vipPrice,
  normalizeSellPrice,
  normalizeScheduleDate,
  getListingStatus
};
