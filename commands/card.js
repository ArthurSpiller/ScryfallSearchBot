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

        await interaction.deferReply();

        try {
            const url = `https://api.scryfall.com/cards/search?q=game:paper -t:contraption -t:attraction ${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.object === 'error' || !data.data || data.data.length === 0) {
                await interaction.editReply('No cards found matching your search.');
                return;
            }

            const cards = data.data;
            let currentIndex = 0;

            async function generateEmbed(index) {
                const card = cards[index];

                let description = card.oracle_text;
                let mana_cost = card.mana_cost;

                if (card.card_faces) {
                    description =
                        card.card_faces[0].oracle_text +
                        "\n=====================================\n" +
                        card.card_faces[1].oracle_text;

                    mana_cost = card.card_faces[1].mana_cost
                        ? card.card_faces[0].mana_cost + " // " + card.card_faces[1].mana_cost
                        : card.card_faces[0].mana_cost;
                }

                const legalityEmojis = {
                    legal: "🟢",
                    banned: "🔴",
                    not_legal: "⚪",
                    restricted: "🟠"
                };

                const legalities = card.legalities;
                const formattedLegalities = Object.entries(legalities)
                    .map(([format, status]) => `**${format.charAt(0).toUpperCase() + format.slice(1)}**: ${legalityEmojis[status] || "❓"}`)
                    .join("\n") || "No legalities available";

                // const CMId = card.cardmarket_id;
                // const CMUrl = `https://api.cardmarket.com/ws/v2.0/products/${CMId}`;

                const CMUrl = card.purchase_uris.cardmarket;

                return {
                    title: card.name,
                    description: description || "No description available.",
                    fields: [
                        { name: "Mana Cost", value: mana_cost || "N/A", inline: true },
                        { name: "Type", value: card.type_line || "N/A", inline: true },
                        { name: "Set", value: card.set_name || "N/A", inline: true },
                        { name: "Legalities", value: formattedLegalities, inline: false },
                        { name: "CardMarket Value", value: `[View on Cardmarket](${CMUrl})`, inline: true }
                    ],
                    thumbnail: {
                        url: card.card_faces?.[1]?.image_uris?.normal || ""
                    },
                    image: {
                        url: card.image_uris?.normal ||
                            (card.card_faces && card.card_faces[0].image_uris.normal) ||
                            ""
                    },
                    footer: {
                        text: `Card ${index + 1} of ${cards.length} • Data provided by Scryfall\nQuery: ${query}`
                    }
                };
            }

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

            const message = await interaction.editReply({
                embeds: [await generateEmbed(currentIndex)],
                components: [row]
            });

            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 600000
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev') {
                    currentIndex = (currentIndex === 0) ? cards.length - 1 : currentIndex - 1;
                } else if (i.customId === 'next') {
                    currentIndex = (currentIndex === cards.length - 1) ? 0 : currentIndex + 1;
                }
                await i.update({ embeds: [await generateEmbed(currentIndex)] });
            });

            collector.on('end', async () => {
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
