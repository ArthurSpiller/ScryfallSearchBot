// commands/card.js
const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
// If you're on Node 18+, the global fetch API is available; otherwise, uncomment the next line.
// const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('card')
        .setDescription('Search for a Magic card using Scryfall')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The search query for the card')
                .setRequired(true)
        ),
    async execute(interaction) {
        const query = interaction.options.getString('query');

        // Defer reply if you expect the API call to take a moment.
        await interaction.deferReply();

        try {
            // Call the Scryfall API with the search query.
            const url = `https://api.scryfall.com/cards/search?q=game:paper -t:contraption -t:attraction ${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();

            // Check if the API returned an error or no results.
            if (data.object === 'error' || !data.data || data.data.length === 0) {
                await interaction.editReply('No cards found matching your search.');
                return;
            }

            // Save the list of cards from the API.
            const cards = data.data;
            let currentIndex = 0;

            // A helper function to generate an embed for a given card index.
            function generateEmbed(index) {
                const card = cards[index];
                return {
                    title: card.name,
                    description: card.oracle_text || 'No description available.',
                    fields: [
                        { name: 'Mana Cost', value: card.mana_cost || 'N/A', inline: true },
                        { name: 'Type', value: card.type_line || 'N/A', inline: true },
                        { name: 'Set', value: card.set_name || 'N/A', inline: true },
                    ],
                    image: {
                        url: card.image_uris?.normal ||
                            (card.card_faces && card.card_faces[0].image_uris.normal) ||
                            ''
                    },
                    footer: { text: `Card ${index + 1} of ${cards.length} • Data provided by Scryfall` }
                };
            }

            // Create buttons for pagination.
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Primary)
            );

            // Send the initial embed along with the buttons.
            const message = await interaction.editReply({ 
                embeds: [generateEmbed(currentIndex)], 
                components: [row] 
            });

            // Create a message component collector that listens for button interactions.
            const collector = message.createMessageComponentCollector({
                // Only allow interactions from the user who initiated the command.
                filter: i => i.user.id === interaction.user.id,
                time: 60000 // Collector will listen for 60 seconds.
            });

            collector.on('collect', async i => {
                // Check which button was pressed and update the index accordingly.
                if (i.customId === 'prev') {
                    currentIndex = (currentIndex === 0) ? cards.length - 1 : currentIndex - 1;
                } else if (i.customId === 'next') {
                    currentIndex = (currentIndex === cards.length - 1) ? 0 : currentIndex + 1;
                }
                // Update the message with the new embed.
                await i.update({ embeds: [generateEmbed(currentIndex)] });
            });

            collector.on('end', async () => {
                // Optionally disable the buttons after the collector expires.
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('⬅️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );
                await interaction.editReply({ components: [disabledRow] });
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error fetching the card details.');
        }
    },
};
