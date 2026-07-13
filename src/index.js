const {
  Client,
  GatewayIntentBits,
  MessageFlags
} = require('discord.js');
const cron = require('node-cron');
const storage = require('./storage');
const { handleVacation, isUserOnVacation } = require('./command-handlers/vacation');
const { COMMUTE_TYPES, COMMUTE_EMOJI, CRON_SCHEDULE, TIMEZONE, DAYS_OFF, TARGET_CHANNEL_ID } = require('./config');
const { getNowInTimezoneParts } = require('./utils/time');
const { logInteractionDebug } = require('./utils/logging');
const { buildCommuteMessage } = require('./messages/commute-prompt');
const { handleHelp } = require('./command-handlers/help');
const { handleManualLog } = require('./command-handlers/log');
const { handleTestPrompt } = require('./command-handlers/test');
const { handleReport } = require('./command-handlers/report');
const { handleButtonInteraction } = require('./interactions/buttons');
const { handleSelectMenuInteraction } = require('./interactions/selects');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ─── Send the daily prompt ──────────────────────────────────────────────────
async function sendDailyPrompt() {
  try {
    const nowTz = getNowInTimezoneParts(TIMEZONE);
    const weekdayAbbrev = nowTz.weekdayAbbrev;
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = weekdayMap[weekdayAbbrev];

    console.log(`[Bot] Cron tick at ${nowTz.dateStr} ${nowTz.timeStr} (${TIMEZONE}), weekday=${weekday}`);

    if (isUserOnVacation) {
      console.log(`[Bot] Skipping daily prompt because user is on vacation`);
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
}

// ─── Handle button interactions ─────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  try {
    logInteractionDebug(interaction, 'Received interaction');

    // ── Slash commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'report') {
        await handleReport(interaction);
      } else if (interaction.commandName === 'log') {
        await handleManualLog(interaction);
      } else if (interaction.commandName === 'test') {
        await handleTestPrompt(interaction);
      } else if (interaction.commandName === 'help') {
        await handleHelp(interaction);
      } else if (interaction.commandName === 'vacation') {
        await handleVacation(interaction);
      }
      return;
    }

    // ── Select menus ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }

    // ── Button clicks ───────────────────────────────────────────────────────
    if (!interaction.isButton()) return;
    await handleButtonInteraction(interaction);
  } catch (err) {
    console.error('[Debug] interactionCreate handler error:', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Something went wrong while handling this interaction.', flags: MessageFlags.Ephemeral });
      }
    } catch (replyErr) {
      console.error('[Debug] Failed to send error reply:', replyErr);
    }
  }
});


// ─── Bot ready ───────────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Scheduling daily prompt: ${CRON_SCHEDULE} (${TIMEZONE})`);
  console.log(`[Bot] Configured days off: ${DAYS_OFF.length ? DAYS_OFF.join(',') : 'none'}`);
  console.log(`[Bot] Active commute types: ${COMMUTE_TYPES.map(t => `${t.id}:${t.label}`).join(', ')}`);

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[Bot] Invalid CRON_SCHEDULE: ${CRON_SCHEDULE}`);
    return;
  }

  // Schedule daily prompt on weekdays
  cron.schedule(CRON_SCHEDULE, sendDailyPrompt, { timezone: TIMEZONE });
  console.log('[Bot] Daily prompt scheduler registered');

  console.log('[Bot] Ready!');
});

client.login(process.env.DISCORD_TOKEN);
