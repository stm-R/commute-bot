// ─── Commute types ───────────────────────────────────────────────────────────
// Add or remove types here as needed
const COMMUTE_TYPES = [
  { id: 'car',         label: 'Car',             emoji: '🚗' },
  { id: 'carpool',     label: 'Carpool',          emoji: '🚙' },
  { id: 'bike',        label: 'Bike',             emoji: '🚲' },
  { id: 'ebike',       label: 'E-Bike',           emoji: '⚡' },
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

// ─── Discord channel ─────────────────────────────────────────────────────────
const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
if (!TARGET_CHANNEL_ID) {
  console.error('[Config] DISCORD_CHANNEL_ID is not set!');
  process.exit(1);
}

module.exports = { COMMUTE_TYPES, COMMUTE_EMOJI, CRON_SCHEDULE, TIMEZONE, TARGET_CHANNEL_ID };
