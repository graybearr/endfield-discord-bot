import axios from 'axios';
import crypto from 'crypto';
import { logger } from './logger';

export interface AttendanceResult {
    ok: boolean;
    msg: string;
    rewardName?: string;
    rewardCount?: string;
    rewardIcon?: string;
}

interface Credentials {
    cred: string;
    sessionToken: string;
}

const BASE_URL = Buffer.from("aHR0cHM6Ly96b25haS5za3BvcnQuY29tL3dlYi92MQ==", 'base64').toString();
const AUTH_URL = Buffer.from("aHR0cHM6Ly9hcy5ncnlwaGxpbmUuY29t", 'base64').toString();

export class AttendanceClient {
    private userConfig: any;
    private gameRoleKey: string;

    constructor(userConfig: any) {
        this.userConfig = userConfig;
        try {
            this.userConfig.accountToken = decodeURIComponent(this.userConfig.accountToken);
        } catch (e) {}
        this.gameRoleKey = "3_" + this.userConfig.skGameRole + "_" + (this.userConfig.serverId || "2");
    }

    private async fetchCredentials(accountToken: string): Promise<Credentials> {
        // 토큰 유효성 확인
        const userInfoRes = await axios.get(
            AUTH_URL + "/user/info/v1/basic?token=" + encodeURIComponent(accountToken),
            { validateStatus: () => true }
        );
        if (userInfoRes.data.status !== 0) throw new Error("토큰 오류");

        // OAuth2 인증 코드 발급
        const oauthRes = await axios.post(AUTH_URL + "/user/oauth2/v2/grant", {
            token: accountToken,
            appCode: "6eb76d4e13aa36e6",
            type: 0
        }, {
            headers: { "Content-Type": "application/json" },
            validateStatus: () => true
        });
        if (oauthRes.data.status !== 0) throw new Error("인증 실패 (OAuth2)");

        // 인증 코드로 cred 및 세션 토큰 발급
        const credRes = await axios.post(BASE_URL + "/user/auth/generate_cred_by_code", {
            code: oauthRes.data.data.code,
            kind: 1
        }, {
            headers: { "Content-Type": "application/json", "platform": "3" },
            validateStatus: () => true
        });
        if (credRes.data.code !== 0) throw new Error("인증 실패 (cred)");

        return {
            cred: credRes.data.data.cred,
            sessionToken: credRes.data.data.token
        };
    }

    private buildCredSign(timestamp: string, cred: string): string {
        return crypto.createHash('md5')
            .update("timestamp=" + timestamp + "&cred=" + cred)
            .digest('hex');
    }

    private buildSessionSign(apiPath: string, timestamp: string, sessionToken: string): string {
        const payload = apiPath + timestamp + JSON.stringify({
            platform: "3",
            timestamp: timestamp,
            dId: "",
            vName: "1.0.0"
        });

        const hmacHex = Array.from(
            crypto.createHmac('sha256', sessionToken).update(payload).digest()
        ).map((b: number) => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

        return crypto.createHash('md5').update(hmacHex).digest('hex');
    }

    private extractRewardFromResponse(responseData: any, message: string): AttendanceResult {
        let rewardName = "알 수 없음", rewardCount = "0", rewardIcon = "";

        if (responseData.code === 0 && responseData.data?.calendar) {
            const lastCompletedDay = responseData.data.calendar.filter((day: any) => day.done).pop();
            if (lastCompletedDay) {
                const rewardInfo = responseData.data.resourceInfoMap[lastCompletedDay.awardId];
                if (rewardInfo) {
                    rewardName = rewardInfo.name;
                    rewardCount = rewardInfo.count;
                    rewardIcon = rewardInfo.icon;
                }
            }
        }

        return { ok: true, msg: message, rewardName, rewardCount, rewardIcon };
    }

    async run(): Promise<AttendanceResult> {
        try {
            const credentials = await this.fetchCredentials(this.userConfig.accountToken);
            const timestamp = Math.floor(Date.now() / 1e3).toString();

            const headers: any = {
                "cred": credentials.cred,
                "sk-game-role": this.gameRoleKey,
                "platform": "3",
                "sk-language": "ko",
                "timestamp": timestamp,
                "vname": "1.0.0",
                "User-Agent": "Skport/0.7.0 (com.gryphline.skport; build:700089; Android 33; ) Okhttp/5.1.0"
            };

            const attendanceUrl = BASE_URL + "/game/endfield/attendance";

            // GET - 오늘 이미 출석했는지 확인
            headers["sign"] = this.buildCredSign(timestamp, credentials.cred);
            const checkRes = await axios.get(attendanceUrl, { headers, validateStatus: () => true });

            if (checkRes.data.code === 0 && checkRes.data.data?.hasToday) {
                return this.extractRewardFromResponse(checkRes.data, "이미 출석 완료");
            }

            // POST - 출석 체크 및 보상 수령
            headers["sign"] = credentials.sessionToken
                ? this.buildSessionSign("/web/v1/game/endfield/attendance", timestamp, credentials.sessionToken)
                : this.buildCredSign(timestamp, credentials.cred);

            const checkInRes = await axios.post(attendanceUrl, null, { headers, validateStatus: () => true });

            if (checkInRes.data.code !== 0) {
                return { ok: false, msg: "요청 실패 (코드: " + checkInRes.data.code + ")" };
            }

            await new Promise(resolve => setTimeout(resolve, 1500));

            // GET - 최종 보상 확인
            headers["sign"] = this.buildCredSign(timestamp, credentials.cred);
            const finalRes = await axios.get(attendanceUrl, { headers, validateStatus: () => true });

            return this.extractRewardFromResponse(finalRes.data, "출석 성공 (보상 수령됨)");

        } catch (error: any) {
            logger.error("SYSTEM", `통신 중 오류: ${error.message}`);
            return { ok: false, msg: "오류: " + error.message };
        }
    }
}

export async function doAttendance(user: any): Promise<AttendanceResult> {
    const client = new AttendanceClient({
        accountToken: user.accountToken,
        accountName: user.accountName,
        skGameRole: user.skGameRole,
        serverId: user.serverId
    });

    return await client.run();
}