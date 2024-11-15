import {ButtonInteraction, CommandInteraction, MessageActionRow, MessageEmbed} from 'discord.js';
import Mongoose from 'mongoose';
import {createAcceptButton} from '../../utils/buttons.js';
import {Roles} from '../../utils/enums.js';
import {success, warning} from '../../utils/embed.js';
import User from '../../database/user/index.js';
import Sentry from '../../lib/sentry.js';
import ResponseError from '../../utils/error.js';
import type {GroupInterface} from '../../types/group.js';
import components from '../../interactions/components.js';
import {MessageComponentIds} from '../../lib/constants.js';
import Group from '../../database/group/index.js';
import Invite from '../../database/invite/index.js';
import redlock, {userLock, groupLock} from '../../redis/locks.js';

const inviteEmbed = (group: GroupInterface) =>
  new MessageEmbed().setColor('GOLD').setTitle(group.name).setDescription('Has invited you to their group!');

const acceptEmbed = (group: GroupInterface) =>
  new MessageEmbed().setColor('GREEN').setTitle(group.name).setDescription('You have joined!');

const denyEmbed = (group: GroupInterface) =>
  new MessageEmbed().setColor('RED').setTitle(group.name).setDescription('Invalid invite');

export default async function invite(interaction: CommandInteraction) {
  let message;

  try {
    const discordInvitee = interaction.options.getUser('user');

    if (discordInvitee.id === interaction.user.id) {
      throw new ResponseError('You cannot invite yourself!');
    }

    const id = interaction.user.id as unknown as Mongoose.Schema.Types.Long;
    const inviter = await User.findOne({discordId: id}).populate('group');
    const invitee = await User.get(discordInvitee);

    if (inviter == null || inviter.group == null) {
      throw new ResponseError('You do not belong to a group');
    }

    // TODO: make func for this
    if (![Roles.MODERATOR, Roles.OWNER].includes(inviter.group.users.find(({user}) => user.equals(inviter._id)).role)) {
      throw new ResponseError('Invalid permissions in group to perform this action');
    }

    if (invitee.group != null) {
      throw new ResponseError("The user you're trying to invite belongs to a group");
    }

    if (inviter.group.users.find(({user}) => user._id.equals(invitee._id))) {
      throw new ResponseError('This user is in your group');
    }

    const inviteOptions = {
      group: inviter.group.id,
      target: invitee.id,
    };

    if (await Invite.exists(inviteOptions)) {
      throw new ResponseError('This user already has a pending invite to this group');
    }

    const actionRow = new MessageActionRow().addComponents(createAcceptButton(inviter.group));

    interaction.reply({
      embeds: [success(`Sent invite to **${discordInvitee.username}**!`)],
      ephemeral: true,
    });

    try {
      message = await discordInvitee.send({embeds: [inviteEmbed(inviter.group)], components: [actionRow]});
    } catch (err) {
      throw new ResponseError('Unable to send direct message to user');
    }

    await Invite.create({referer: invitee.id, ...inviteOptions});
  } catch (err) {
    if (err instanceof ResponseError) {
      interaction.reply({embeds: [warning(err.message)], ephemeral: true});
      return;
    }

    if (message != null) {
      await message.delete();
    }

    Sentry.captureException(err);
  }
}

components.on(MessageComponentIds.ACCEPT_INVITE, async (interaction: ButtonInteraction, groupId: string) => {
  const lock = await redlock.acquire([userLock(interaction.user)], 1000);
  const lockGroup = await redlock.acquire([groupLock(groupId)], 1000);

  try {
    const [group, user] = await Promise.all([Group.findById(groupId), User.get(interaction.user)]);

    const inviteOptions = {
      group: group?.id,
      target: user.id,
    };

    if (group == null || !(await Invite.exists(inviteOptions))) {
      await interaction.update({
        embeds: [denyEmbed(group)],
        components: [],
      });

      throw new ResponseError('Invalid invite');
    }

    group.add(user);

    await interaction.update({
      embeds: [acceptEmbed(group)],
      components: [],
    });

    await Promise.all([group.save(), user.save(), Invite.findOneAndDelete(inviteOptions)]);
  } catch (err) {
    if (err instanceof ResponseError) {
      interaction.reply({embeds: [warning(err.message)], ephemeral: true});
      return;
    }

    Sentry.captureException(err);
  } finally {
    lock.release();
    lockGroup.release();
  }
});
