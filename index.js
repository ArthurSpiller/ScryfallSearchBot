// index.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Collection for commands
client.commands = new Collection();

// Read command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// When the client is ready, log to console
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Listen for interactions (slash commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing that command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
        }
    }
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
