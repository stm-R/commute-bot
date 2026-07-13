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

module.exports = { logInteractionDebug };
