const { buildCommuteMessage } = require('../messages/commute-prompt');

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

module.exports = { handleTestPrompt };
