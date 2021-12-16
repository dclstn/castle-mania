import {CommandInteraction, MessageEmbed} from 'discord.js';
import {ApplicationCommandOptionTypes, ApplicationCommandTypes} from 'discord.js/typings/enums';
import User from '../../database/user/index.js';
import commands from '../../commands.js';
import {Command, CommandOption} from '../../types/command';

async function run(interaction: CommandInteraction) {
  const user = await User.get(interaction.options.getUser('user') || interaction.user);

  const embed: MessageEmbed = new MessageEmbed()
    .setAuthor(user.username)
    .setDescription(`Gold: ${user.gold}`)
    .setThumbnail(user.avatar)
    .setColor('BLURPLE');

  interaction.reply({embeds: [embed], ephemeral: true});
}

class ContextMenuProfile implements Command {
  type: number;
  name: string;

  constructor() {
    this.type = ApplicationCommandTypes.USER;
    this.name = 'Inspect';
    commands.on(this.name, this.run);
  }

  async run(interaction: CommandInteraction): Promise<void> {
    run(interaction);
  }
}

class SlashCommandProfile implements Command {
  type: number;
  name: string;
  description: string;
  options?: CommandOption[];

  constructor() {
    this.type = ApplicationCommandTypes.CHAT_INPUT;
    this.name = 'profile';
    this.description = "🔎 Return a user's profile.";
    this.options = [
      {
        name: 'user',
        description: "Inspect a selected user's profile",
        type: ApplicationCommandOptionTypes.USER,
      },
    ];

    commands.on(this.name, this.run);
  }

  async run(interaction: CommandInteraction): Promise<void> {
    run(interaction);
  }
}

commands.registerCommand(new ContextMenuProfile());
commands.registerCommand(new SlashCommandProfile());
