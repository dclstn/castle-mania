import {CommandInteraction} from 'discord.js';
import {ApplicationCommandTypes} from 'discord.js/typings/enums';
import {CommandNames, CommandDescriptions, CommandOptions, GroupSubCommandNames} from '../../constants.js';
import commands from '../../commands.js';
import {create, deposit} from './actions.js';

class Group {
  constructor() {
    commands.on(CommandNames.GROUP, this.run);
  }

  run(interaction: CommandInteraction): void {
    switch (interaction.options.getSubcommand()) {
      case GroupSubCommandNames.DEPOSIT:
        deposit(interaction);
        break;
      case GroupSubCommandNames.CREATE:
      default:
        create(interaction);
        break;
    }
  }
}

commands.registerCommand({
  type: ApplicationCommandTypes.CHAT_INPUT,
  name: CommandNames.GROUP,
  description: CommandDescriptions[CommandNames.GROUP],
  options: CommandOptions[CommandNames.GROUP],
});

export default new Group();