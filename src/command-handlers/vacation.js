const { getVacationEndDate, saveVacationEndDate } = require('../storage');

// ─── /vacation command (set vacation period) ────────────────────────────────
async function handleVacation(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'status') {
    const currentEndDate = await getVacationEndDate();

    if (!currentEndDate) {
      return interaction.reply({
        content: '🏖️ You are not currently in vacation mode.',
        ephemeral: true
      });
    }

    const endDate = new Date(currentEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < today) {
      return interaction.reply({
        content: `⏳ Your vacation period ended on ${currentEndDate}.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `🏝️ You are in vacation mode until ${currentEndDate}.`,
      ephemeral: true
    });
  } else if (subcommand === 'off') {
    const currentEndDate = await getVacationEndDate();

    if (!currentEndDate) {
      return interaction.reply({
        content: '❌ You don\'t currently have an active vacation period.',
        ephemeral: true
      });
    }

    try {
      await saveVacationEndDate(null);
      return interaction.reply({
        content: '✅ Vacation mode turned off. You will now receive commute prompts as normal.',
        ephemeral: true
      });
    } catch (error) {
      console.error('Error turning off vacation:', error);
      return interaction.reply({
        content: '❌ There was an error turning off your vacation mode.',
        ephemeral: true
      });
    }
  } else if (subcommand === 'set') {
    // Try to get the date from either the end_date parameter or the first free text argument
    let endDateStr = interaction.options.getString('end_date');

    // If not found in options, check if it was provided as a free text argument
    if (!endDateStr) {
      const commandArgs = interaction.options._hoistedOptions;
      const dateArg = commandArgs.find(arg => arg.name === 'action' && arg.value === 'set') ?
                     commandArgs.slice(1).find(arg => !arg.name) : null;
      if (dateArg) {
        endDateStr = dateArg.value;
      }
    }

    if (!endDateStr) {
      return interaction.reply({
        content: '❌ Please provide an end date in YYYY-MM-DD format (e.g., 2026-08-08).',
        ephemeral: true
      });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      return interaction.reply({
        content: '❌ Please use the format YYYY-MM-DD for the date (e.g., 2026-08-08).',
        ephemeral: true
      });
    }

    // Parse and validate the date
    const endDate = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(endDate.getTime())) {
      return interaction.reply({
        content: '❌ Invalid date. Please use the format YYYY-MM-DD (e.g., 2026-08-08).',
        ephemeral: true
      });
    }

    if (endDate < today) {
      return interaction.reply({
        content: '❌ Vacation end date must be in the future.',
        ephemeral: true
      });
    }

    // Save to file
    try {
      await saveVacationEndDate(endDateStr);
      await interaction.reply({
        content: `✅ Vacation mode set! You won't receive commute prompts until ${endDateStr}.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error saving vacation date:', error);
      await interaction.reply({
        content: '❌ There was an error saving your vacation date.',
        ephemeral: true
      });
    }
  }
}

module.exports = { handleVacation };
