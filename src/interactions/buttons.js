const { EmbedBuilder } = require('discord.js');
const storage = require('../storage');
const { COMMUTE_TYPES } = require('../config');

// ─── Handle commute button clicks ───────────────────────────────────────────
async function handleButtonInteraction(interaction) {
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
}

module.exports = { handleButtonInteraction };
