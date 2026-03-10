import Database from 'better-sqlite3';
import path from 'path';
import { logger } from './logger';

// 프로젝트 루트 경로에 database.db 생성
const dbPath = path.resolve(process.cwd(), 'database.db');
const _db = new Database(dbPath);

// 데이터베이스 초기화
try {
    _db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        discordId TEXT PRIMARY KEY,
        accountName TEXT,
        accountToken TEXT,
        skGameRole TEXT,
        serverId TEXT DEFAULT '2'
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        guildId TEXT PRIMARY KEY,
        channelId TEXT
      );
    `);
    logger.success('DATABASE', '데이터베이스 테이블 초기화 완료');
} catch (err: any) {
    logger.error('DATABASE', `테이블 초기화 실패: ${err.message}`);
}

const db = {
    // 유저 정보 조회
    getUser: (discordId: string) => {
        try {
            return _db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId) as any;
        } catch (err: any) {
            logger.error('DATABASE', `유저 (${discordId}) 조회 중 오류: ${err.message}`);
            return undefined;
        }
    },

    // 모든 등록 유저 가져오기
    getAllUsers: () => {
        try {
            return _db.prepare('SELECT * FROM users').all() as any[];
        } catch (err: any) {
            logger.error('DATABASE', `전체 유저 로드 실패: ${err.message}`);
            return [];
        }
    },

    // 유저 등록 및 업데이트
    addUser: (discordId: string,  accountName: string, accountToken: string, skGameRole: string, serverId?: string ) => {
        try {
            const stmt = _db.prepare(`
                INSERT INTO users (discordId, accountName, accountToken, skGameRole, serverId) 
                VALUES (?, ?, ?, ?, ?) 
                ON CONFLICT(discordId) DO UPDATE SET 
                    accountName = excluded.accountName,
                    accountToken = excluded.accountToken,
                    skGameRole = excluded.skGameRole,
                    serverId = excluded.serverId
            `);
            const info = stmt.run(discordId, accountName, accountToken, skGameRole, serverId || '2');
            logger.success('DATABASE', `유저 정보 저장 완료: ${accountName} (@${discordId})`);
            return info;
        } catch (err: any) {
            logger.error('DATABASE', `유저 등록 실패 (@${discordId}): ${err.message}`);
            throw err;
        }
    },

    // 유저 데이터 삭제
    removeUser: (discordId: string) => {
        try {
            const stmt = _db.prepare('DELETE FROM users WHERE discordId = ?');
            const result = stmt.run(discordId);
            if (result.changes > 0) {
                logger.warn('DATABASE', `유저 정보 삭제 완료: ${discordId}`);
                return true;
            }
            return false;
        } catch (err: any) {
            logger.error('DATABASE', `유저 삭제 중 오류: ${err.message}`);
            return false;
        }
    },

    // 알림 채널 설정 저장
    setChannel: (guildId: string, channelId: string) => {
        try {
            const stmt = _db.prepare(`
                INSERT INTO settings (guildId, channelId) 
                VALUES (?, ?) 
                ON CONFLICT(guildId) DO UPDATE SET channelId = excluded.channelId
            `);
            stmt.run(guildId, channelId);
            logger.success('DATABASE', `채널 설정 완료: Guild ${guildId} -> Channel ${channelId}`);
            return true;
        } catch (err: any) {
            logger.error('DATABASE', `채널 설정 실패: ${err.message}`);
            return false;
        }
    },

    removeChannel: (guildId: string) => {
        try {
            const stmt = _db.prepare('DELETE FROM settings WHERE guildId = ?');
            const result = stmt.run(guildId);
            if (result.changes > 0) {
                logger.warn('DATABASE', `채널 삭제 완료: ${guildId}`);
                return true;
            }
            return false;
        } catch (err: any) {
            logger.error('DATABASE', `채널 삭제 중 오류: ${err.message}`);
            return false;
        }
    },

    // 모든 서버 설정 로드
    getSettings: () => {
        try {
            return _db.prepare('SELECT * FROM settings').all() as any[];
        } catch (err: any) {
            logger.error('DATABASE', `설정 데이터 로드 실패: ${err.message}`);
            return [];
        }
    }
};

export default db;