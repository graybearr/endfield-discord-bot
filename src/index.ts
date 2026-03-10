import { Client, GatewayIntentBits, Collection, ActivityType, Partials } from 'discord.js';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { deployCommands } from './utils/deploy-commands';
import { initScheduler } from './utils/scheduler';

dotenv.config();

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message],
    presence: {
        status: 'dnd',
        activities: [{
            name: '잠시만 기다려주세요...',
            type: ActivityType.Playing,
        }]
    }
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

client.once('clientReady', async () => {
    const clientId = client.user?.id;
    const token = process.env.TOKEN;

    logger.info('SYSTEM', `봇 클라이언트에 로그인합니다: ${client.user?.tag}`);
    
    if (clientId && token) {
        await deployCommands(clientId, token);
    } else {
        logger.error('ERROR', '.env 파일 내 필수 환경변수가 존재하지 않습니다.');
    }

    initScheduler(client);

    client.user?.setPresence({
        status: 'online',
        activities: [{
            name: 'Arknights:Endfield',
            type: ActivityType.Playing
        }]
    });
    
    logger.info('SYSTEM', '이제 봇을 사용할 수 있어요.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error: any) {
        logger.error('ERROR', error.message);
        const errorMsg = { content: '⚠️ 명령어 실행 중 오류가 발생했습니다.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(errorMsg);
        else await interaction.reply(errorMsg);
    }
});

client.login(process.env.TOKEN);

declare module 'discord.js' {
    export interface Client {
        commands: Collection<unknown, any>;
    }
}