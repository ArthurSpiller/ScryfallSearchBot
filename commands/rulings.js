// commands/rulings.js
const {SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().
        setName('rulings').
        setDescription("Search for a Magic card's rulings using Scryfall").
        addStringOption(
            option => option.setName('query').
                setDescription('The search query for the card').
                setRequired(true)
        ),
    async execute(interaction) {
        const query = "game:paper -t:contraption -t:attraction " + interaction.options.getString('query');

        await interaction.deferReply();

        try {
            const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
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
                const rulingUrl = `https://api.scryfall.com/cards/${card.set}/${card.collector_number}/rulings`;
                const rulingResponse = await fetch(rulingUrl);
                const rulingData = await rulingResponse.json();
                
                let rulings = rulingData.data.map(ruling => `- ${ruling.published_at}: ${ruling.comment}`);

                const embed = new EmbedBuilder()
                      .setTitle(card.name)
                      // .setDescription(card.oracle_text || "No description available.")
                      // .addFields(
                      //     { name: "Mana Cost", value: card.mana_cost || "N/A", inline: true },
                      //     { name: "Type", value: card.type_line || "N/A", inline: true },
                      //     { name: "Set", value: card.set_name || "N/A", inline: true }
                      // )
                      .setFooter({ text: `Card ${index + 1} of ${cards.length} • Data provided by Scryfall` })
                      .setColor(0x3498db);
                const imageUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
                if (imageUrl) {
                    embed.setImage(imageUrl);
                }
                const thumbnailUrl = card.card_faces?.[1]?.image_uris?.normal;
                if (thumbnailUrl) {
                    embed.setThumbnail(thumbnailUrl);
                }

                const maxEmbedLength = 6000;
                const maxFieldLength = 1024;
                let currentEmbedLength = 0;
                let chunk = "";
                let firstChunk = true;
                rulings.forEach(ruling => {
                    if ((chunk + ruling).length > maxFieldLength) {
                        currentEmbedLength += maxFieldLength;
                        if (currentEmbedLength < maxEmbedLength) {
                            embed.addFields({ name: firstChunk ? "Rulings" : "Continued", value: chunk });
                            firstChunk = false;
                            chunk = "";
                        }
                    }
                    chunk += `${ruling}\n`;
                });
                if (firstChunk && chunk === "") {
                    embed.addFields({name: "No ruling available" , value: " "});
                    return embed;
                }
                if (currentEmbedLength > maxEmbedLength) {
                    embed.addFields({name: "There is more here:", value: rulingUrl});
                } else if (chunk)
                    embed.addFields({name: firstChunk ? "Rulings" : "Continued", value: chunk});
                return embed;
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
}
