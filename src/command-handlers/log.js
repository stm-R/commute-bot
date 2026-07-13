const { EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../storage');
const { COMMUTE_TYPES } = require('../config');

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

module.exports = { handleManualLog };
