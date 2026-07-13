const cron = require('node-cron');
const storage = require('./storage');
const { isUserOnVacation } = require('./vacation-storage');
const { CRON_SCHEDULE, TIMEZONE, DAYS_OFF, TARGET_CHANNEL_ID } = require('./config');
const { getNowInTimezoneParts } = require('./utils/time');
const { buildCommuteMessage } = require('./messages/commute-prompt');

// ─── Send the daily prompt ──────────────────────────────────────────────────
function makeSendDailyPrompt(client) {
  return async function sendDailyPrompt() {
    try {
      const nowTz = getNowInTimezoneParts(TIMEZONE);
      const weekdayAbbrev = nowTz.weekdayAbbrev;
      const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const weekday = weekdayMap[weekdayAbbrev];

      console.log(`[Bot] Cron tick at ${nowTz.dateStr} ${nowTz.timeStr} (${TIMEZONE}), weekday=${weekday}`);

      if (await isUserOnVacation()) {
        console.log(`[Bot] Skipping daily prompt because vacation mode is active`);
        return;
      }

      if (DAYS_OFF.includes(weekday)) {
        console.log(`[Bot] Skipping daily prompt for configured day off (weekday=${weekday})`);
        return;
      }

      let channel = null;
      try {
        channel = await client.channels.fetch(TARGET_CHANNEL_ID);
      } catch (err) {
        console.error(`[Bot] Failed to fetch channel ${TARGET_CHANNEL_ID}:`, err?.message || err);
        return;
      }

      if (!channel) {
        console.error(`[Bot] Could not find channel ${TARGET_CHANNEL_ID}`);
        return;
      }

      if (!channel.isTextBased()) {
        console.error(`[Bot] Channel ${TARGET_CHANNEL_ID} is not text-based (type=${channel.type})`);
        return;
      }

      const perms = channel.permissionsFor(client.user);
      if (!perms) {
        console.error(`[Bot] Could not resolve bot permissions in channel ${TARGET_CHANNEL_ID}`);
        return;
      }

      const canView = perms.has('ViewChannel');
      const canSend = perms.has('SendMessages');
      const canEmbed = perms.has('EmbedLinks');

      if (!canView || !canSend || !canEmbed) {
        console.error(
          `[Bot] Missing channel permissions for scheduled prompt in ${TARGET_CHANNEL_ID}: ` +
          `ViewChannel=${canView} SendMessages=${canSend} EmbedLinks=${canEmbed}`
        );
        return;
      }

      console.log(`[Bot] Resolved target channel ${channel.id} (${channel.name || 'unknown-name'})`);

      const today = nowTz.dateStr; // YYYY-MM-DD in configured timezone
      const existing = storage.getEntry(today);
      if (existing) {
        console.log(`[Bot] Already have entry for ${today}: ${existing}`);
        return;
      }

      console.log(`[Bot] No existing entry for ${today}, sending prompt...`);
      const msg = buildCommuteMessage(today);
      await channel.send(msg);
      console.log(`[Bot] Sent daily prompt for ${today}`);
    } catch (err) {
      if (err && Number(err.code) === 50001) {
        console.error(
          `[Bot] Missing Access when sending to channel ${TARGET_CHANNEL_ID}. ` +
          'Check bot membership in the server and channel permissions: View Channel, Send Messages, Embed Links.'
        );
        return;
      }
      console.error('[Bot] Unexpected error in sendDailyPrompt:', err);
    }
  };
}

function startScheduler(client) {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[Bot] Invalid CRON_SCHEDULE: ${CRON_SCHEDULE}`);
    return;
  }

  cron.schedule(CRON_SCHEDULE, makeSendDailyPrompt(client), { timezone: TIMEZONE });
  console.log('[Bot] Daily prompt scheduler registered');
}

module.exports = { startScheduler };
