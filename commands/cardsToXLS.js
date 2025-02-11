// commands/cardsToXLS.js
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const ExcelJS = require('exceljs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cardstoxls')
        .setDescription('Search for Magic cards using Scryfall and export results as an XLS file')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The search query for the cards')
                .setRequired(true)
        ),
    async execute(interaction) {
        let query = interaction.options.getString('query');
        await interaction.deferReply(); // Allow extra time for processing

        try {
            // Collect all card results by paginating through the Scryfall API.
            let cards = [];
            query = "game:paper -t:contraption -t:attraction " + query;
            let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;

            // Optional: You might want to limit the total pages to avoid huge datasets.
            while (url) {
                const response = await fetch(url);
                const data = await response.json();

                if (data.object === 'error' || !data.data) {
                    break;
                }
                cards = cards.concat(data.data);
                if (data.has_more && data.next_page) {
                    url = data.next_page;
                } else {
                    url = null;
                }
            }

            if (cards.length === 0) {
                await interaction.editReply('No cards found matching your search.');
                return;
            }

            // Create a new Excel workbook and worksheet.
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Cards');

            // Define columns. Two new columns have been added:
            // - 'P/T or Loyalty' for creature/vehicle power/toughness or planeswalker loyalty.
            // - 'Battle' for indicating if the card is a battle.
            worksheet.columns = [
                { header: 'Name', key: 'name', width: 30 },
                { header: 'Mana Cost', key: 'mana_cost', width: 15 },
                { header: 'Type', key: 'type_line', width: 30 },
                { header: 'Rarity', key: 'rarity', width: 20 },
                { header: 'Oracle Text', key: 'oracle_text', width: 50 },
                { header: 'P/T or Loyalty or Defense', key: 'pt_loyalty_defense', width: 15 }
            ];

            // For each card, calculate the P/T or Loyalty and the Battle status.
            cards.forEach(card => {
                let ptLoyalty = '';
                const typeLine = card.type_line ? card.type_line.toLowerCase() : '';

                if (typeLine.includes('creature') || typeLine.includes('vehicle')) {
                    // If power or toughness is missing, substitute "N/A"
                    const power = card.power ? card.power : 'N/A';
                    const toughness = card.toughness ? card.toughness : 'N/A';
                    ptLoyaltyDefense = `${power}/${toughness}`;
                } else if (typeLine.includes('planeswalker')) {
                    ptLoyaltyDefense = card.loyalty ? card.loyalty : 'N/A';
                } else if (typeLine.includes('battle')) {
                    ptLoyaltyDefense = card.defense ? card.defense : 'N/A';
                } else {
                    ptLoyaltyDefense = '';
                }

                let battle = 'None';
                // Check if the card type mentions "Battle".
                if (typeLine.includes('battle')) {
                    battle = 'Yes';
                }

                worksheet.addRow({
                    name: card.name,
                    mana_cost: card.mana_cost || '',
                    type_line: card.type_line || '',
                    rarity: card.rarity || '',
                    oracle_text: card.oracle_text || '',
                    pt_loyalty_defense: ptLoyaltyDefense || ''
                });
            });

            // Generate the XLSX file as a buffer.
            const buffer = await workbook.xlsx.writeBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'cards.xlsx' });

            await interaction.editReply({
                content: `Found **${cards.length}** cards matching \"${query}\". Here is your XLS file:`,
                files: [attachment]
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error processing your request.');
        }
    },
};
