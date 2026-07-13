const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { COMMUTE_TYPES } = require('../config');

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

module.exports = { buildCommuteMessage };
