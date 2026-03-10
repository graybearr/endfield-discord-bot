import { REST, Routes } from 'discord.js';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export async function deployCommands(clientId: string, token: string) {
    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    logger.info('SYSTEM', '명령어 파일을 읽어오는 중...');

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            logger.success('SYSTEM', `성공적으로 불러옴: /${command.data.name} (${file})`)
        } else {
            logger.warn('WARNING', `${filePath} 파일에 data 또는 execute 속성이 없습니다.`);
        }
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        logger.info('SYSTEM', `${commands.length}개의 명령어를 등록 중...`);
        
        const data: any = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        
        logger.success('SYSTEM', `성공적으로 ${data.length}개의 명령어를 등록했습니다!`);
    } catch (error: any) {
        logger.error('ERROR', `명령어 등록 실패: ${error.message}`);
    }
}