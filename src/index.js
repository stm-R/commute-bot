const {
  Client,
  GatewayIntentBits
} = require('discord.js');
const { COMMUTE_TYPES, CRON_SCHEDULE, TIMEZONE, DAYS_OFF } = require('./config');
const { router } = require('./interactions/router');
const { startScheduler } = require('./scheduler');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.on('interactionCreate', router);

// ─── Bot ready ───────────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Scheduling daily prompt: ${CRON_SCHEDULE} (${TIMEZONE})`);
  console.log(`[Bot] Configured days off: ${DAYS_OFF.length ? DAYS_OFF.join(',') : 'none'}`);
  console.log(`[Bot] Active commute types: ${COMMUTE_TYPES.map(t => `${t.id}:${t.label}`).join(', ')}`);

  startScheduler(client);

  console.log('[Bot] Ready!');
});

client.login(process.env.DISCORD_TOKEN);
