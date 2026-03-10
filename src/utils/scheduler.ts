import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import cron from 'node-cron';
import db from './db';
import { doAttendance } from './attendance';
import { logger } from './logger';

export function initScheduler(client: Client) {
    cron.schedule('0 1 * * *', () => runDailyAttendance(client), { timezone: "Asia/Seoul" });
    logger.success('SCHEDULER', '자동 출석 스케줄러 등록 완료 (매일 01:00)');
}

export async function runDailyAttendance(client: Client) {
    logger.info('SCHEDULER', '일일 자동 출석 작업 중...');
    
    const users = db.getAllUsers();
    const settings = db.getSettings();
    
    if (users.length === 0) return logger.warn('SCHEDULER', '출석할 유저가 없습니다.');

    const successList: string[] = [];
    const failList: string[] = [];
    let lastIcon: string | null = null;

    for (const user of users) {
        try {
            const res = await doAttendance(user);
            const line = `<@${user.discordId}> (\`${user.accountName}\`)`;
            
            if (res.ok) {
                if (res.msg === "이미 출석 완료") {
                    successList.push(`⚠️ ${line} - 이미 출석됨`);
                } else {
                    const rewardText = res.rewardName && res.rewardName !== "알 수 없음"
                        ? ` - **${res.rewardName}** x${res.rewardCount}`
                        : ` - ${res.msg}`;
                    successList.push(`✅ ${line}${rewardText}`);
                    if (res.rewardIcon) lastIcon = res.rewardIcon;
                }
            }
        } catch (err: any) {
            failList.push(`❌ **${user.accountName}** (\`${user.skGameRole}\`)`);
            logger.error('SCHEDULER', `${user.accountName} (${user.skGameRole}) 처리 중 오류: ${err.message}`);
        }
        
        await new Promise(r => setTimeout(r, 2000));
    }

    const embed = new EmbedBuilder()
        .setTitle('🛰️ 엔드필드 자동 출석 보고서')
        .setColor('Blue')
        .setTimestamp()

    // null 체크 후에만 setThumbnail 호출
    if (lastIcon) embed.setThumbnail(lastIcon);

    let description = "";
    if (successList.length > 0) description += `### 출석 성공 (${successList.length}명)\n${successList.join('\n')}\n\n`;
    if (failList.length > 0) description += `### 출석 실패 (${failList.length}명)\n${failList.join('\n')}`;

    embed.setDescription(description);

    for (const config of settings) {
        try {
            const channel = await client.channels.fetch(config.channelId) as TextChannel;
            if (channel) {
                await channel.send({ embeds: [embed] });
            }
        } catch (e) {
            logger.error('SCHEDULER', `메시지 전송 실패 (채널: ${config.channelId})`);
        }
    }
    logger.success('SCHEDULER', `일일 자동 출석 작업 완료 (성공: ${successList.length}, 실패: ${failList.length})`);
}