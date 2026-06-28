const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const cron = require('node-cron');
const storage = require('./storage');
const { generateReport } = require('./report');
const { COMMUTE_TYPES, COMMUTE_EMOJI, CRON_SCHEDULE, TIMEZONE, TARGET_CHANNEL_ID } = require('./config');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function logInteractionDebug(interaction, context) {
  const values = Array.isArray(interaction.values) ? interaction.values.join(',') : 'n/a';
  console.log(
    `[Debug] ${context} | type=${interaction.type} command=${interaction.commandName || 'n/a'} customId=${interaction.customId || 'n/a'} user=${interaction.user?.id || 'n/a'} values=${values}`
  );
}

// ─── Build the daily commute question message ───────────────────────────────
function buildCommuteMessage(dateStr, opts = {}) {
  const { testMode = false } = opts;
  const customIdPrefix = testMode ? 'commute_test' : 'commute';

  const embed = new EmbedBuilder()
    .setColor(testMode ? 0xFEE75C : 0x5865F2)
    .setTitle(testMode ? '🧪 Commute Log Test' : '🚗 Daily Commute Log')
    .setDescription(testMode
      ? `Test run: pick how you would commute today.\n**${dateStr}**`
      : `How did you commute today?\n**${dateStr}**`)
    .setFooter({ text: 'Select your commute type below' })
    .setTimestamp();

  const rows = [];
  const buttons = COMMUTE_TYPES.map(type =>
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}:${dateStr}:${type.id}`)
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
      }
      return;
    }

    // ── Select menus ────────────────────────────────────────────────────────
    const isStringSelect = typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu();
    const isLegacySelect = typeof interaction.isSelectMenu === 'function' && interaction.isSelectMenu();
    if (isStringSelect || isLegacySelect) {
      console.log(`[Debug] Select menu detected | string=${isStringSelect} legacy=${isLegacySelect} customId=${interaction.customId}`);
      const [prefix, action, userId] = interaction.customId.split(':');
      if (prefix === 'report' && action === 'month') {
        await handleReportMonthSelect(interaction, userId);
      }
      return;
    }

    // ── Button clicks ───────────────────────────────────────────────────────
    if (!interaction.isButton()) return;

    const [prefix, dateStr, commuteId] = interaction.customId.split(':');
    if (prefix !== 'commute' && prefix !== 'commute_test') return;

    const commuteType = COMMUTE_TYPES.find(t => t.id === commuteId);
    if (!commuteType) return;

    const isTestInteraction = prefix === 'commute_test';

    if (!isTestInteraction) {
      storage.setEntry(dateStr, commuteType.id);
    }

    // Update the message to show confirmation and remove buttons
    const embed = new EmbedBuilder()
      .setColor(isTestInteraction ? 0xFEE75C : 0x57F287)
      .setTitle(isTestInteraction ? '🧪 Test Selection Recorded' : '✅ Commute Logged')
      .setDescription(isTestInteraction
        ? `Would log:\n**${dateStr}**\n${commuteType.emoji} ${commuteType.label}`
        : `**${dateStr}**\n${commuteType.emoji} ${commuteType.label}`)
      .setFooter({ text: isTestInteraction ? 'Test mode only: no data was saved' : 'You can change this with /log' })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    if (isTestInteraction) {
      console.log(`[Bot] Test selection ${dateStr}: ${commuteType.id} (not persisted)`);
    } else {
      console.log(`[Bot] Logged ${dateStr}: ${commuteType.id}`);
    }
  } catch (err) {
    console.error('[Debug] interactionCreate handler error:', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Something went wrong while handling this interaction.', ephemeral: true });
      }
    } catch (replyErr) {
      console.error('[Debug] Failed to send error reply:', replyErr);
    }
  }
});

// ─── /test command (simulate cron prompt without persistence) ───────────────
async function handleTestPrompt(interaction) {
  const dateStr = new Date().toISOString().split('T')[0];
  const msg = buildCommuteMessage(dateStr, { testMode: true });

  await interaction.reply({
    content: '🧪 Test prompt. Your selection will not be saved.',
    embeds: msg.embeds,
    components: msg.components
  });
  console.log(`[Bot] Sent test prompt for ${dateStr} (no persistence)`);
}

// ─── /report command ─────────────────────────────────────────────────────────
async function handleReport(interaction) {
  console.log(`[Debug] /report invoked by ${interaction.user.id}`);
  const monthArg = interaction.options.getString('month'); // e.g. "2025-06"
  console.log(`[Debug] /report month argument: ${monthArg || 'none'}`);

  if (monthArg) {
    const parts = monthArg.match(/^(\d{4})-(\d{2})$/);
    if (!parts) {
      return interaction.reply({ content: '❌ Invalid month format. Use `YYYY-MM` e.g. `2025-06`', ephemeral: true });
    }

    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]) - 1; // 0-indexed
    const report = generateReport(year, month);
    const embed = buildReportEmbed(report);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const menu = buildReportMonthMenu(interaction.user.id);
  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.reply({
    content: 'Select a month from the picker below. The report is generated immediately after selection.',
    components: [row],
    ephemeral: true
  });
}

function buildReportMonthMenu(userId) {
  const now = new Date();
  const options = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${d.toLocaleString('en-US', { month: 'long' })} ${year}`;

    options.push({
      label,
      value,
      description: i === 0 ? 'Current month' : undefined
    });
  }

  return new StringSelectMenuBuilder()
    .setCustomId(`report:month:${userId}`)
    .setPlaceholder('Choose a month')
    .addOptions(options);
}

function buildReportEmbed(report) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📋 Commute Report — ${report.monthLabel}`)
    .setDescription(`\`\`\`text\n${report.lines.join('\n')}\n\`\`\``)
    .addFields(
      { name: 'Total work days', value: `${report.workDays}`, inline: true },
      { name: 'Logged days', value: `${report.loggedDays}`, inline: true },
      { name: 'Missing', value: `${report.missingDays}`, inline: true }
    )
    .setFooter({ text: 'Weekends shown as "Weekend" unless overridden with /log' });

  if (Object.keys(report.summary).length > 0) {
    const summaryLines = Object.entries(report.summary)
      .map(([id, count]) => {
        const type = COMMUTE_TYPES.find(t => t.id === id);
        return `${type ? type.emoji : ''} ${type ? type.label : id}: **${count}**`;
      })
      .join('\n');
    embed.addFields({ name: 'Summary', value: summaryLines });
  }

  return embed;
}

async function handleReportMonthSelect(interaction, expectedUserId) {
  logInteractionDebug(interaction, 'Handling report month select');
  console.log(`[Debug] Expected user for picker: ${expectedUserId}`);
  if (interaction.user.id !== expectedUserId) {
    await interaction.reply({
      content: '❌ This month picker belongs to another user. Run /report to open your own picker.',
      ephemeral: true
    });
    return;
  }

  const monthArg = interaction.values[0];
  console.log(`[Debug] Selected month value: ${monthArg}`);
  const parts = monthArg.match(/^(\d{4})-(\d{2})$/);
  if (!parts) {
    await interaction.update({
      content: '❌ Could not parse selected month. Please run /report again.',
      components: []
    });
    return;
  }

  const year = parseInt(parts[1]);
  const month = parseInt(parts[2]) - 1;

  const report = generateReport(year, month);
  const embed = buildReportEmbed(report);
  await interaction.update({
    content: `Selected month: **${monthArg}**`,
    embeds: [embed],
    components: []
  });
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
        value: 'Generate a monthly commute report.\nIf `month` is omitted, you can choose a month from a picker.\nOptional `month` format: `YYYY-MM` (example: `/report month:2025-06`).'
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
        name: '/test',
        value: 'Send a test prompt that behaves like the daily cron message, but does not persist any selection.'
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
client.once('clientReady', () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Scheduling daily prompt: ${CRON_SCHEDULE} (${TIMEZONE})`);

  // Schedule daily prompt on weekdays
  cron.schedule(CRON_SCHEDULE, sendDailyPrompt, { timezone: TIMEZONE });

  console.log('[Bot] Ready!');
});

client.login(process.env.DISCORD_TOKEN);
