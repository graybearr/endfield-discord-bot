import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../utils/db';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('register')
    .setDescription('엔드필드 자동 출석체크에 등록하거나 탈퇴해요.');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const user = db.getUser(interaction.user.id);

    // 이미 가입된 경우
    if (user) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('confirm').setLabel('탈퇴').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel').setLabel('취소').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.editReply({ content: '⚠️ 이미 계정이 등록되어 있어요. 등록된 계정을 탈퇴할까요?', components: [row] });

        try {
            const confirmation = await response.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 15_000 });
            if (confirmation.customId === 'confirm') {
                db.removeUser(interaction.user.id);
                await confirmation.update({ content: '✅ 성공적으로 탈퇴했어요.', components: [] });
            } else {
                await confirmation.update({ content: '❌ 탈퇴를 취소했어요.', components: [] });
            }
        } catch (e) {
            await interaction.editReply({ content: '❌ 시간이 초과되어 취소했어요.', components: [] });
        }
        return;
    }

    // 미가입 상태
    try {
        const dmChannel = await interaction.user.createDM();
        const dm = await dmChannel.send(`
## ⚠️ 엔드필드 계정 등록 방법

### STEP 1. 데이터 추출하기
1. PC 브라우저로 [엔드필드 웹 출석 페이지](<https://game.skport.com/endfield/sign-in>)에 로그인합니다.
2. \`F12\`를 눌러 **개발자 도구**를 실행하고 **Console** 탭을 엽니다.
3. 하단의 **추출용 코드**를 복사하고, 콘솔에 붙여넣은 후 엔터를 누릅니다.
4. 콘솔에 출력된 텍스트를 복사 후, 채팅창에 붙여넣기만 하고 다음 단계로 넘어갑니다. __**(아직 전송하지 마세요!)**__

### STEP 2. 토큰 가져오기
1. 개발자 도구에서 **Application** 탭을 엽니다.
2. 좌측 메뉴에서 **Storage > Cookies > <https://game.skport.com>** 을 선택합니다.
3. Name이 \`ACCOUNT_TOKEN\`인 항목의 Value를 복사합니다.
    - __만약 ACCOUNT_TOKEN이 보이지 않는다면__, \`F5\`를 눌러 페이지를 새로고침 해보세요.

### STEP 3. 데이터 전송하기
1. 앞서 채팅창에 붙여넣어둔 텍스트의 \`여기에_토큰_붙여넣기\` 부분을 방금 복사한 **실제 토큰**으로 교체합니다.
2. 완성된 텍스트를 그대로 전송해주세요.

- **추출용 코드 (복사 후 콘솔에 붙여넣기)**
\`\`\`js
(async()=>{const e=await(await fetch(location.href)).text(),t=document.createElement("iframe");t.style.display="none",window.addEventListener("message",(e=>{"G"===e.data?.t&&(e.data.d.n&&(console.clear(),console.log("%c⬇️ [데이터 추출 성공!] 아래 텍스트를 복사하세요. ⬇️","font-size:16px; font-weight:bold;"),console.log(\`%c여기에_토큰_붙여넣기,\${e.data.d.n},\${e.data.d.i},\${e.data.d.s}\`,"font-weight:bold; font-size:20px;"),console.log("%c⬆️ ⚠️ 중요: '여기에_토큰_붙여넣기' 부분은 실제 토큰으로 직접 교체해주세요. ⬆️","color:#ff0000; font-size:14px; font-weight:bold;"),t.remove()))})),document.body.appendChild(t),t.contentDocument.write(e.replace(/<head[^>]*>/i,(e=>e+\`<script>const originFetch=window.fetch;window.fetch=async(e,t)=>{const n=await originFetch(e,t);if(e.toString().includes("binding_list"))try{const e=await n.clone().json(),t=e?.data?.list?.[0]?.bindingList?.[0]?.roles?.[0];t&&parent.postMessage({t:"G",d:{n:t.nickName,i:t.roleId,s:t.serverId}},"*")}catch(e){}return n};<\/script>\`))),t.contentDocument.close()})();
\`\`\`
__*(이 세션은 5분 후에 만료됩니다.)*__
`);
        await interaction.editReply({ content: '✅ DM으로 등록 방법을 보냈어요.' });

        try {
            const collected = await dmChannel.awaitMessages({ max: 1, time: 300000, errors: ['time'] });
            const msg = collected.first();
            if (!msg) return;

            const parts = msg.content.trim().split(',').map(p => p.trim());

            if (parts.length < 3) {
                return await dm.edit("⚠️ 잘못된 형식이에요. 다시 `/register` 명령어를 사용해주세요.");
            }

            const [token, nickname, uid, sid] = parts;

            if (/[ㄱ-ㅎ가-힣]/.test(token) || token.length < 20) {
                return await dm.edit("⚠️ 올바른 토큰이 아니에요. 다시 `/register` 명령어를 사용해주세요.");
            }

            db.addUser(interaction.user.id, nickname, token, uid, sid);

            await dm.edit(`✅ 계정을 등록했어요! 이제 매일 자동으로 출석체크를 할게요.\n\`\`\`\n닉네임: ${nickname}\nUID: ${uid}\n\`\`\``);
        } catch (error: any) {
            await dm.edit(`⚠️ 제한시간이 초과되었거나 오류가 발생했어요.`);
        }
    } catch (error: any) {
        await interaction.editReply({ content: '⚠️ 오류가 발생했어요. DM이 차단되어 있지 않은지 확인해주세요.' });
    }
}