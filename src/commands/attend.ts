import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import db from '../utils/db';
import { doAttendance } from '../utils/attendance';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('attend')
    .setDescription('수동으로 엔드필드 출석체크를 해요.');

export async function execute(interaction: ChatInputCommandInteraction) {
    const user = db.getUser(interaction.user.id);
    if (!user) return interaction.reply({ content: '⚠️ 등록된 계정이 없어요. `/register`를 먼저 입력해보세요.' });

    await interaction.deferReply();

    try {
        const res = await doAttendance(user);

        const embed = new EmbedBuilder()
            .setTitle(res.ok ? '✅ 출석 성공' : '❌ 출석 실패')
            .setColor(res.ok ? 'Green' : 'Red')
            .setDescription(res.msg)
            .setTimestamp();

        if (res.ok) {
            if (res.rewardName && res.rewardName !== "알 수 없음") {
                embed.addFields({ name: '획득한 보상', value: `${res.rewardName} (x${res.rewardCount})`, inline: true });
            }
            if (res.rewardIcon) embed.setThumbnail(res.rewardIcon);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error: any) {
        logger.error("COMMAND", `/attend 실행 중 오류: ${error.message}`);
        await interaction.editReply({ content: '⚠️ 데이터를 불러오던 중 오류가 발생했어요.' });
    }
}