const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const storage = require('./storage');
const { generateReport } = require('./report');
const { COMMUTE_TYPES, COMMUTE_EMOJI, CRON_SCHEDULE, TIMEZONE, TARGET_CHANNEL_ID } = require('./config');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ─── Build the daily commute question message ───────────────────────────────
function buildCommuteMessage(dateStr) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🚗 Daily Commute Log')
    .setDescription(`How did you commute today?\n**${dateStr}**`)
    .setFooter({ text: 'Select your commute type below' })
    .setTimestamp();

  const rows = [];
  const buttons = COMMUTE_TYPES.map(type =>
    new ButtonBuilder()
      .setCustomId(`commute:${dateStr}:${type.id}`)
      .setLabel(type.label)
      .setEmoji(type.emoji)
      .setStyle(ButtonStyle.Primary)
  );

  // Split buttons into rows of max 5
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  return { embeds: [embed], components: rows };
}

// ─── Send the daily prompt ──────────────────────────────────────────────────
async function sendDailyPrompt() {
  const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error(`[Bot] Could not find channel ${TARGET_CHANNEL_ID}`);
    return;
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const existing = storage.getEntry(today);
  if (existing) {
    console.log(`[Bot] Already have entry for ${today}: ${existing}`);
    return;
  }

  const msg = buildCommuteMessage(today);
  await channel.send(msg);
  console.log(`[Bot] Sent daily prompt for ${today}`);
}

// ─── Handle button interactions ─────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  // ── Slash commands ────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'report') {
      await handleReport(interaction);
    } else if (interaction.commandName === 'log') {
      await handleManualLog(interaction);
    } else if (interaction.commandName === 'help') {
      await handleHelp(interaction);
    }
    return;
  }

  // ── Button clicks ─────────────────────────────────────────────────────────
  if (!interaction.isButton()) return;

  const [prefix, dateStr, commuteId] = interaction.customId.split(':');
  if (prefix !== 'commute') return;

  const commuteType = COMMUTE_TYPES.find(t => t.id === commuteId);
  if (!commuteType) return;

  storage.setEntry(dateStr, commuteType.id);

  // Update the message to show confirmation and remove buttons
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Commute Logged')
    .setDescription(`**${dateStr}**\n${commuteType.emoji} ${commuteType.label}`)
    .setFooter({ text: 'You can change this with /log' })
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });
  console.log(`[Bot] Logged ${dateStr}: ${commuteType.id}`);
});

// ─── /report command ─────────────────────────────────────────────────────────
async function handleReport(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const monthArg = interaction.options.getString('month'); // e.g. "2025-06"
  let year, month;

  if (monthArg) {
    const parts = monthArg.match(/^(\d{4})-(\d{2})$/);
    if (!parts) {
      return interaction.editReply('❌ Invalid month format. Use `YYYY-MM` e.g. `2025-06`');
    }
    year = parseInt(parts[1]);
    month = parseInt(parts[2]) - 1; // 0-indexed
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const report = generateReport(year, month);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📋 Commute Report — ${report.monthLabel}`)
    .setDescription(report.lines.join('\n'))
    .addFields(
      { name: 'Total work days', value: `${report.workDays}`, inline: true },
      { name: 'Logged days', value: `${report.loggedDays}`, inline: true },
      { name: 'Missing', value: `${report.missingDays}`, inline: true }
    )
    .setFooter({ text: 'Weekends shown as "Weekend" unless overridden with /log' });

  // Summary by type
  if (Object.keys(report.summary).length > 0) {
    const summaryLines = Object.entries(report.summary)
      .map(([id, count]) => {
        const type = COMMUTE_TYPES.find(t => t.id === id);
        return `${type ? type.emoji : ''} ${type ? type.label : id}: **${count}**`;
      })
      .join('\n');
    embed.addFields({ name: 'Summary', value: summaryLines });
  }

  await interaction.editReply({ embeds: [embed] });
}

// ─── /log command (manual entry / weekend override) ─────────────────────────
async function handleManualLog(interaction) {
  const dateArg = interaction.options.getString('date'); // YYYY-MM-DD
  const commuteId = interaction.options.getString('type');

  let dateStr;
  if (dateArg) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
      return interaction.reply({ content: '❌ Invalid date format. Use `YYYY-MM-DD`', ephemeral: true });
    }
    dateStr = dateArg;
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  const commuteType = COMMUTE_TYPES.find(t => t.id === commuteId);
  if (!commuteType) {
    return interaction.reply({ content: '❌ Unknown commute type.', ephemeral: true });
  }

  storage.setEntry(dateStr, commuteId);

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Commute Logged')
    .setDescription(`**${dateStr}**\n${commuteType.emoji} ${commuteType.label}`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
  console.log(`[Bot] Manual log ${dateStr}: ${commuteId}`);
}

// ─── /help command ───────────────────────────────────────────────────────────
async function handleHelp(interaction) {
  const typeList = COMMUTE_TYPES.map(t => `${t.emoji} \`${t.id}\` — ${t.label}`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('📖 Commute Bot — Help')
    .addFields(
      {
        name: '🔔 Daily Prompt',
        value: 'Every weekday morning the bot sends a message with buttons to log your commute. Just click the button!'
      },
      {
        name: '/report [month]',
        value: 'Generate a monthly commute report.\n`month` is optional, format `YYYY-MM` (defaults to current month).\nExample: `/report month:2025-06`'
      },
      {
        name: '/log [date] <type>',
        value: 'Manually log or correct a commute entry.\n`date` is optional, format `YYYY-MM-DD` (defaults to today).\nUse this to log **weekend commutes** or fix mistakes.\nExample: `/log date:2025-06-07 type:car`'
      },
      {
        name: '/help',
        value: 'Show this help message.'
      },
      {
        name: '🚌 Commute Types',
        value: typeList
      }
    )
    .setFooter({ text: 'Weekend days appear as "Weekend" in reports unless you log them with /log' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── Bot ready ───────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Scheduling daily prompt: ${CRON_SCHEDULE} (${TIMEZONE})`);

  // Schedule daily prompt on weekdays
  cron.schedule(CRON_SCHEDULE, sendDailyPrompt, { timezone: TIMEZONE });

  console.log('[Bot] Ready!');
});

client.login(process.env.DISCORD_TOKEN);
