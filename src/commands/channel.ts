import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../utils/db';

export const data = new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('자동 출석 보고서를 받을 채널을 설정해요.')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('텍스트 채널 (미입력시 등록을 해제해요.)')
            .addChannelTypes(
                ChannelType.GuildText,
                ChannelType.PublicThread,
                ChannelType.PrivateThread,
                ChannelType.AnnouncementThread
            )
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel');
    if (!interaction.guildId) return;

    if (!channel) {
        const existing = db.getSettings().find((s: any) => s.guildId === interaction.guildId);
        if (!existing) {
            await interaction.reply({ content: '⚠️ 등록할 채널을 입력해주세요. (예: `/setchannel [#텍스트 채널]`)', ephemeral: true });
            return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('confirm').setLabel('해제').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel').setLabel('취소').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({ content: '⚠️ 등록된 채널을 해제할까요?', components: [row], ephemeral: true });

        try {
            const confirmation = await response.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 15_000 });
            if (confirmation.customId === 'confirm') {
                db.removeChannel(interaction.guildId!);
                await confirmation.update({ content: '✅ 등록된 채널을 해제했어요.', components: [] });
            } else {
                await confirmation.update({ content: '❌ 해제를 취소했어요.', components: [] });
            }
        } catch (e) {
            await interaction.editReply({ content: '❌ 시간이 초과되어 취소했어요.', components: [] });
        }
        return;
    }

    db.setChannel(interaction.guildId, channel.id);
    await interaction.reply({ content: `✅ 앞으로 자동 출석 보고서를 <#${channel.id}> 채널로 보낼게요.` });
}