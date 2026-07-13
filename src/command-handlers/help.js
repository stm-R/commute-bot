const { EmbedBuilder, MessageFlags } = require('discord.js');
const { COMMUTE_TYPES } = require('../config');

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

module.exports = { handleHelp };
