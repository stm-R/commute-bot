const { handleReportMonthSelect } = require('../command-handlers/report');

// ─── Handle select menu interactions ────────────────────────────────────────
async function handleSelectMenuInteraction(interaction) {
  console.log(`[Debug] Select menu detected | string=true customId=${interaction.customId}`);
  const [prefix, action, userId] = interaction.customId.split(':');
  if (prefix === 'report' && action === 'month') {
    await handleReportMonthSelect(interaction, userId);
  }
}

module.exports = { handleSelectMenuInteraction };
