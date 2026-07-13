const { ActionRowBuilder, MessageFlags } = require('discord.js');
const { generateReport } = require('../report');
const { logInteractionDebug } = require('../utils/logging');
const { buildReportEmbed, buildReportMonthMenu } = require('../messages/report-embed');

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

module.exports = { handleReport, handleReportMonthSelect };
