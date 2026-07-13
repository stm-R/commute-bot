const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional: for guild-scoped (instant) registration

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

const { COMMUTE_TYPES } = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Generate your monthly commute report')
    .addStringOption(opt =>
      opt.setName('month')
        .setDescription('Month to report (YYYY-MM). Defaults to current month.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Manually log or override a commute entry (also for weekend days)')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Commute type')
        .setRequired(true)
        .addChoices(...COMMUTE_TYPES.map(t => ({ name: `${t.emoji} ${t.label}`, value: t.id })))
    )
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date to log (YYYY-MM-DD). Defaults to today.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help for commute bot commands'),

  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Send a test commute prompt without persisting any selected result'),

  new SlashCommandBuilder()
  .setName('vacation')
  .setDescription('Manage your vacation status')
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('View your current vacation status'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set a new vacation period')
      .addStringOption(option =>
        option.setName('end_date')
          .setDescription('End date of your vacation (YYYY-MM-DD)')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('off')
      .setDescription('Turn off vacation mode early')),   

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering slash commands...');

    let data;
    if (guildId) {
      // Guild-scoped: registers instantly (good for testing)
      data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered ${data.length} guild commands for guild ${guildId}`);
    } else {
      // Global: can take up to 1 hour to propagate
      data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered ${data.length} global commands`);
    }
  } catch (err) {
    console.error(err);
  }
})();
