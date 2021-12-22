import {ButtonInteraction, CommandInteraction, MessageActionRow, MessageButton, MessageEmbed} from 'discord.js';
import {ApplicationCommandTypes} from 'discord.js/typings/enums';
import {numberWithCommas} from '../../utils/embed.js';
import {CommandNames, CommandDescriptions, CommandOptions, MessageComponentIds} from '../../constants.js';
import commands from '../../commands.js';
import {findById, Item, Items} from '../../items.js';
import User, {UserInterface} from '../../database/user/index.js';
import {emoteIds, emoteStrings} from '../../utils/emotes.js';
import components from '../../components.js';
import Sentry from '../../sentry.js';

const itemDescription = (item: Item): string => `
Price: ${emoteStrings.gem} **${numberWithCommas(item.price)}**
Level: **${item.level}**
Gems per hour: **${item.gph}/h**
`;

class ItemCommand {
  constructor() {
    commands.on(CommandNames.ITEM, this.run);
    Items.forEach((item) =>
      components.on(item.id, (interaction: ButtonInteraction) => this.handleReply(interaction, item))
    );
  }

  async run(interaction: CommandInteraction): Promise<void> {
    const itemId = interaction.options.getString('item');
    const item = findById(itemId);
    this.handleReply(interaction, item);
  }

  async handleReply(interaction: CommandInteraction | ButtonInteraction, item: Item) {
    let user: UserInterface;

    try {
      user = await User.get(interaction.user, true);

      const embed = new MessageEmbed()
        .setTitle(item.name)
        .setDescription(itemDescription(item))
        .setThumbnail(item.url)
        .setFooter('Some items may leave or join the shop at any time!')
        .setColor('GREEN');

      const actionRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(MessageComponentIds.BUY)
          .setLabel(`Buy for ${numberWithCommas(item.price)}`)
          .setStyle('SUCCESS')
          .setEmoji(emoteIds.gem)
          .setDisabled(!item.buyable || item.price > user.money),
        new MessageButton()
          .setCustomId(MessageComponentIds.SELL)
          .setLabel(`Sell for ${numberWithCommas(item.price / 2)}`)
          .setEmoji(emoteIds.gem)
          .setStyle('DANGER')
          .setDisabled(!user.inventory.has(item))
      );

      interaction.reply({embeds: [embed], components: [actionRow], ephemeral: true});
    } catch (err) {
      Sentry.captureException(err);
    }
  }
}

commands.registerCommand({
  type: ApplicationCommandTypes.CHAT_INPUT,
  name: CommandNames.ITEM,
  description: CommandDescriptions[CommandNames.ITEM],
  options: CommandOptions[CommandNames.ITEM],
});

export default new ItemCommand();
