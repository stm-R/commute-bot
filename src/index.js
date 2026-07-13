const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const cron = require('node-cron');
const storage = require('./storage');
const { generateReport } = require('./report');
const { handleVacation, isUserOnVacation } = require('./command-handlers/vacation');
const { COMMUTE_TYPES, COMMUTE_EMOJI, CRON_SCHEDULE, TIMEZONE, DAYS_OFF, TARGET_CHANNEL_ID } = require('./config');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function logInteractionDebug(interaction, context) {
  const kind = interaction.isChatInputCommand()
    ? 'chat-input'
    : interaction.isButton()
      ? 'button'
      : interaction.isStringSelectMenu()
        ? 'string-select'
        : `type-${interaction.type}`;

  const target = interaction.isChatInputCommand()
    ? interaction.commandName
    : (interaction.customId || '-');

  const values = Array.isArray(interaction.values) ? interaction.values.join(',') : 'n/a';
  console.log(
    `[Debug] ${context} | kind=${kind} target=${target} user=${interaction.user?.id || '-'} values=${values}`
  );
}

function getNowInTimezoneParts(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const timeStr = `${get('hour')}:${get('minute')}:${get('second')}`;

  return {
    weekdayAbbrev: get('weekday'),
    dateStr,
    timeStr
  };
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
    const isStringSelect = interaction.isStringSelectMenu();
    if (isStringSelect) {
      console.log(`[Debug] Select menu detected | string=${isStringSelect} customId=${interaction.customId}`);
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

    // ── Handle modal submission ──────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'vacationModal') {
        const endDate = interaction.fields.getTextInputValue('endDate');

        // Validate the date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          return interaction.reply({
            content: 'Please use the format YYYY-MM-DD for the date.',
            ephemeral: true
          });
        }

        // Save the vacation end date to your database
        // await saveVacationEndDate(interaction.user.id, endDate);

        await interaction.reply({
          content: `Vacation mode set! You won't receive commute prompts until ${endDate}.`,
          ephemeral: true
        });
      }
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
        await interaction.reply({ content: '❌ Something went wrong while handling this interaction.', flags: MessageFlags.Ephemeral });
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
      return interaction.reply({ content: '❌ Invalid month format. Use `YYYY-MM` e.g. `2025-06`', flags: MessageFlags.Ephemeral });
    }

    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]) - 1; // 0-indexed
    const report = generateReport(year, month);
    const embed = buildReportEmbed(report);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const menu = buildReportMonthMenu(interaction.user.id);
  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.reply({
    content: 'Select a month from the picker below. The report is generated immediately after selection.',
    components: [row],
    flags: MessageFlags.Ephemeral
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
    .setFooter({ text: 'Weekends are shown. Configured day-off weekdays appear as blank unless overridden with /log' });

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
      flags: MessageFlags.Ephemeral
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
      return interaction.reply({ content: '❌ Invalid date format. Use `YYYY-MM-DD`', flags: MessageFlags.Ephemeral });
    }
    dateStr = dateArg;
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  const commuteType = COMMUTE_TYPES.find(t => t.id === commuteId);
  if (!commuteType) {
    return interaction.reply({ content: '❌ Unknown commute type.', flags: MessageFlags.Ephemeral });
  }

  storage.setEntry(dateStr, commuteId);

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Commute Logged')
    .setDescription(`**${dateStr}**\n${commuteType.emoji} ${commuteType.label}`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

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
