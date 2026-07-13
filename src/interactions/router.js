const { MessageFlags } = require('discord.js');
const { logInteractionDebug } = require('../utils/logging');
const { handleHelp } = require('../command-handlers/help');
const { handleManualLog } = require('../command-handlers/log');
const { handleTestPrompt } = require('../command-handlers/test');
const { handleReport } = require('../command-handlers/report');
const { handleVacation } = require('../command-handlers/vacation');
const { handleButtonInteraction } = require('./buttons');
const { handleSelectMenuInteraction } = require('./selects');

// ─── Handle all interactions ────────────────────────────────────────────────
async function router(interaction) {
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
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }

    // ── Button clicks ───────────────────────────────────────────────────────
    if (!interaction.isButton()) return;
    await handleButtonInteraction(interaction);
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
}

module.exports = { router };
