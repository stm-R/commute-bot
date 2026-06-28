// ─── Commute types ───────────────────────────────────────────────────────────
// Add or remove types here as needed
const COMMUTE_TYPES = [
  { id: 'car',         label: 'Car',             emoji: '🚗' },
  { id: 'motorcycle',  label: 'Motorcycle',       emoji: '🏍️' },
  { id: 'bike',        label: 'Bike',             emoji: '🚲' },
  { id: 'public',      label: 'Public Transport', emoji: '🚌' },
  { id: 'walk',        label: 'Walking',          emoji: '🚶' },
  { id: 'wfh',         label: 'Work From Home',   emoji: '🏠' },
  { id: 'leave',       label: 'Day Off / Leave',  emoji: '🌴' },
];

const COMMUTE_EMOJI = Object.fromEntries(COMMUTE_TYPES.map(t => [t.id, t.emoji]));

// ─── Schedule ─────────────────────────────────────────────────────────────────
// Default: every weekday at 08:00. Override with env CRON_SCHEDULE.
// Format: second minute hour day month weekday
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * 1-5';

// Timezone for cron scheduling. Override with env TIMEZONE.
const TIMEZONE = process.env.TIMEZONE || 'Europe/Amsterdam';

// Optional regular days off (skip sending prompt), comma-separated.
// Accepted values per item: 0-6 (Sun=0), or names like mon,tue,wed,thu,fri,sat,sun.
const WEEKDAY_NAME_TO_INDEX = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

function parseDaysOff(rawDaysOff) {
  if (!rawDaysOff || !rawDaysOff.trim()) return [];

  const parsed = [];
  const parts = rawDaysOff.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);

  for (const part of parts) {
    if (/^[0-6]$/.test(part)) {
      parsed.push(parseInt(part, 10));
      continue;
    }

    const fromName = WEEKDAY_NAME_TO_INDEX[part.slice(0, 3)];
    if (fromName !== undefined) {
      parsed.push(fromName);
      continue;
    }

    console.warn(`[Config] Ignoring invalid DAYS_OFF value: ${part}`);
  }

  return [...new Set(parsed)];
}

const DAYS_OFF = parseDaysOff(process.env.DAYS_OFF || '');

// ─── Discord channel ─────────────────────────────────────────────────────────
const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
if (!TARGET_CHANNEL_ID) {
  console.error('[Config] DISCORD_CHANNEL_ID is not set!');
  process.exit(1);
}

module.exports = { COMMUTE_TYPES, COMMUTE_EMOJI, CRON_SCHEDULE, TIMEZONE, DAYS_OFF, TARGET_CHANNEL_ID };
