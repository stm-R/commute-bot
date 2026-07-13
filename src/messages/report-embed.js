const { EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { COMMUTE_TYPES } = require('../config');

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

module.exports = { buildReportEmbed, buildReportMonthMenu };
