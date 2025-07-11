/**
 * 虚拟主播歌单系统 - 后端服务器
 * 版本: v2.0 (前后端分离架构)
 *
 * 核心功能：
 * - RESTful API 服务
 * - 歌曲数据管理 (CRUD)
 * - 个人资料管理
 * - 系统设置管理
 * - 风格分类管理
 * - 服务器端认证系统
 * - 文件上传处理
 * - 静态文件服务
 *
 * 技术栈：
 * - Express.js 框架
 * - JSON 文件数据存储
 * - Multer 文件上传
 * - PBKDF2 密码哈希
 * - JWT Token 认证
 */

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8000;

// 数据文件路径配置
const DATA_DIR = path.join(__dirname, 'data');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const GENRES_FILE = path.join(DATA_DIR, 'genres.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

// 确保数据目录存在
if (!fsSync.existsSync(DATA_DIR)) {
    fsSync.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 数据管理工具类
 * 提供JSON文件的读写操作和数据管理功能
 */
class DataManager {
    /**
     * 读取JSON文件
     * 如果文件不存在则创建默认文件
     * @param {string} filePath - 文件路径
     * @param {Object} defaultData - 默认数据
     * @returns {Promise<Object>} 文件内容对象
     */
    static async readJsonFile(filePath, defaultData = {}) {
        try {
            if (!fsSync.existsSync(filePath)) {
                await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
                return defaultData;
            }
            const data = await fs.readFile(filePath, 'utf8');

            // 安全的JSON解析
            if (!data || data.trim().length === 0) {
                return defaultData;
            }

            // 检查JSON大小限制（防止DoS攻击）
            if (data.length > 10 * 1024 * 1024) { // 10MB限制
                throw new Error('JSON文件过大');
            }

            return JSON.parse(data);
        } catch (error) {
            SecurityUtils.secureError(`读取文件失败 ${filePath}:`, error.message);
            return defaultData;
        }
    }

    /**
     * 写入JSON文件
     * 将数据对象写入指定的JSON文件
     * @param {string} filePath - 文件路径
     * @param {Object} data - 要写入的数据
     * @returns {Promise<boolean>} 是否写入成功
     */
    static async writeJsonFile(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`写入文件失败 ${filePath}:`, error);
            return false;
        }
    }

    // 获取歌曲数据
    static async getSongs() {
        const defaultSongs = {
            songs: [],
            customGenres: [],
            metadata: {
                version: '1.0',
                lastModified: new Date().toISOString(),
                totalCount: 0
            }
        };
        const data = await this.readJsonFile(SONGS_FILE, defaultSongs);

        // 确保customGenres字段存在
        if (!data.customGenres) {
            data.customGenres = [];
        }

        return data;
    }

    // 保存歌曲数据
    static async saveSongs(songsData) {
        songsData.metadata = {
            ...songsData.metadata,
            lastModified: new Date().toISOString(),
            totalCount: songsData.songs.length
        };
        return await this.writeJsonFile(SONGS_FILE, songsData);
    }

    // 获取个人资料
    static async getProfile() {
        const defaultProfile = {
            profile: {
                websiteTitle: '',
                vtuberName: '虚拟主播',
                vtuberUid: 'VT-001',
                vtuberBirthday: '01/01',
                liveRoomUrl: '',
                vtuberDesc: '欢迎来到我的歌单空间！',
                avatar: '',
                background: ''
            },
            metadata: {
                version: '1.0',
                lastModified: new Date().toISOString()
            }
        };
        return await this.readJsonFile(PROFILE_FILE, defaultProfile);
    }

    // 保存个人资料
    static async saveProfile(profileData) {
        profileData.metadata = {
            ...profileData.metadata,
            lastModified: new Date().toISOString()
        };
        return await this.writeJsonFile(PROFILE_FILE, profileData);
    }

    // 获取风格数据
    static async getGenres() {
        const defaultGenres = {
            genres: [
                { id: 'pop', name: '流行', builtIn: true, createdAt: new Date().toISOString() },
                { id: 'rock', name: '摇滚', builtIn: true, createdAt: new Date().toISOString() },
                { id: 'folk', name: '民谣', builtIn: true, createdAt: new Date().toISOString() },
                { id: 'classical', name: '古典', builtIn: true, createdAt: new Date().toISOString() },
                { id: 'electronic', name: '电子', builtIn: true, createdAt: new Date().toISOString() }
            ],
            metadata: {
                version: '1.0',
                lastModified: new Date().toISOString(),
                description: '风格数据文件',
                totalCount: 5
            }
        };
        return await this.readJsonFile(GENRES_FILE, defaultGenres);
    }

    // 保存风格数据
    static async saveGenres(genresData) {
        genresData.metadata = {
            ...genresData.metadata,
            lastModified: new Date().toISOString(),
            totalCount: genresData.genres.length
        };
        return await this.writeJsonFile(GENRES_FILE, genresData);
    }

    // 生成唯一ID
    static generateId() {
        return crypto.randomBytes(16).toString('hex');
    }
}

// 认证管理类
class AuthManager {
    // 默认管理员密码
    static DEFAULT_PASSWORD = 'DEFAULT_ADMIN_PASSWORD';

    // 获取认证数据
    static async getAuthData() {
        const defaultAuth = {
            passwordHash: null,
            salt: null,
            isSetup: false,
            sessions: {},
            loginAttempts: {},
            lockouts: {}
        };
        return await DataManager.readJsonFile(AUTH_FILE, defaultAuth);
    }

    // 保存认证数据
    static async saveAuthData(authData) {
        return await DataManager.writeJsonFile(AUTH_FILE, authData);
    }

    // 生成密码哈希
    static hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    }

    // 生成盐值
    static generateSalt() {
        return crypto.randomBytes(32).toString('hex');
    }

    // 生成会话token
    static generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // 生成加密密钥（基于服务器启动时间和随机数）
    static getEncryptionKey() {
        if (!this._encryptionKey) {
            const serverStartTime = process.hrtime.bigint().toString();
            const randomData = crypto.randomBytes(16).toString('hex');
            this._encryptionKey = crypto.createHash('sha256')
                .update(serverStartTime + randomData + 'vupplaylist_secret')
                .digest();
        }
        return this._encryptionKey;
    }

    // 加密敏感数据
    static encryptSensitiveData(data) {
        try {
            const key = this.getEncryptionKey();
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', key);

            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');

            return {
                encrypted: encrypted,
                iv: iv.toString('hex')
            };
        } catch (error) {
            SecurityUtils.secureError('加密数据失败:', error.message);
            return data; // 加密失败时返回原数据
        }
    }

    // 解密敏感数据
    static decryptSensitiveData(encryptedData) {
        try {
            if (!encryptedData.encrypted || !encryptedData.iv) {
                return encryptedData; // 不是加密数据，直接返回
            }

            const key = this.getEncryptionKey();
            const decipher = crypto.createDecipher('aes-256-cbc', key);

            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            // 安全的JSON解析
            if (!decrypted || decrypted.trim().length === 0) {
                return encryptedData;
            }

            // 检查解密后数据大小
            if (decrypted.length > 1024 * 1024) { // 1MB限制
                throw new Error('解密后数据过大');
            }

            return JSON.parse(decrypted);
        } catch (error) {
            SecurityUtils.secureError('解密数据失败:', error.message);
            return encryptedData; // 解密失败时返回原数据
        }
    }

    // 验证密码强度
    static validatePasswordStrength(password) {
        if (password.length < 8) return false;
        if (!/[a-z]/.test(password)) return false;
        if (!/[A-Z]/.test(password)) return false;
        if (!/\d/.test(password)) return false;
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
        return true;
    }

    // 检查是否为首次设置
    static async isFirstTimeSetup() {
        const authData = await this.getAuthData();
        return !authData.isSetup;
    }

    // 强制首次设置检查 - 如果检测到默认配置则强制重置
    static async forceFirstTimeSetupIfNeeded() {
        const authData = await this.getAuthData();

        // 检测是否使用了不安全的默认配置
        const isUnsafeDefault = (
            !authData.isSetup ||
            authData.salt === 'password' ||
            authData.passwordHash === '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'
        );

        if (isUnsafeDefault) {
            SecurityUtils.secureWarn('🚨 检测到不安全的默认配置，强制重置认证系统');
            await this.resetToDefault();
            return true;
        }

        return false;
    }

    // 获取客户端真实IP地址
    static getClientIp(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.ip ||
               '127.0.0.1';
    }

    // 验证登录
    static async verifyLogin(password, req) {
        const authData = await this.getAuthData();
        const clientIp = this.getClientIp(req);

        // 检查是否被锁定
        if (this.isLockedOut(authData, clientIp)) {
            throw new Error('账户已被锁定，请稍后再试');
        }

        // 首次设置
        if (!authData.isSetup) {
            if (password !== this.DEFAULT_PASSWORD) {
                this.recordFailedAttempt(authData, clientIp);
                await this.saveAuthData(authData);
                throw new Error('首次登录失败，请查看FIRST_LOGIN.md文档获取初始密码');
            }
            // 首次登录成功，但需要修改密码
            return { firstTime: true, token: null };
        }

        // 验证密码
        const inputHash = this.hashPassword(password, authData.salt);
        if (inputHash !== authData.passwordHash) {
            this.recordFailedAttempt(authData, clientIp);
            await this.saveAuthData(authData);
            throw new Error('密码错误');
        }

        // 登录成功，生成token
        const token = this.generateToken();
        const sessionId = crypto.randomUUID();

        // 限制并发会话
        await this.limitConcurrentSessions(clientIp);

        // 创建会话数据（敏感信息将被加密）
        const sessionData = {
            token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时
            lastActivity: new Date().toISOString(),
            clientIp
        };

        // 加密敏感的token信息
        const encryptedSession = {
            ...sessionData,
            token: this.encryptSensitiveData({ token }).encrypted || token
        };

        authData.sessions[sessionId] = encryptedSession;

        // 清除失败记录
        delete authData.loginAttempts[clientIp];
        delete authData.lockouts[clientIp];

        await this.saveAuthData(authData);

        return { firstTime: false, token, sessionId };
    }

    // 设置新密码（首次设置或修改密码）
    static async setPassword(newPassword, currentPassword = null) {
        const authData = await this.getAuthData();

        // 验证密码强度
        if (!this.validatePasswordStrength(newPassword)) {
            throw new Error('密码强度不足，请使用包含大小写字母、数字和特殊字符的8位以上密码');
        }

        // 如果不是首次设置，需要验证当前密码
        if (authData.isSetup && currentPassword) {
            const currentHash = this.hashPassword(currentPassword, authData.salt);
            if (currentHash !== authData.passwordHash) {
                throw new Error('当前密码错误');
            }
        }

        // 首次设置时验证默认密码
        if (!authData.isSetup && currentPassword !== this.DEFAULT_PASSWORD) {
            throw new Error('首次设置失败，请查看FIRST_LOGIN.md文档获取初始密码');
        }

        // 不能设置为默认密码
        if (newPassword === this.DEFAULT_PASSWORD) {
            throw new Error('新密码不能与默认密码相同');
        }

        // 生成新的盐值和密码哈希
        const salt = this.generateSalt();
        const passwordHash = this.hashPassword(newPassword, salt);

        authData.passwordHash = passwordHash;
        authData.salt = salt;
        authData.isSetup = true;

        // 清除所有现有会话
        authData.sessions = {};

        await this.saveAuthData(authData);

        return true;
    }

    // 清理过期会话
    static async cleanupExpiredSessions() {
        const authData = await this.getAuthData();
        const now = new Date();
        let hasChanges = false;

        for (const [sessionId, session] of Object.entries(authData.sessions)) {
            if (now > new Date(session.expiresAt)) {
                delete authData.sessions[sessionId];
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await this.saveAuthData(authData);
            SecurityUtils.secureLog(`清理了过期会话，当前活跃会话数: ${Object.keys(authData.sessions).length}`);
        }
    }

    // 限制并发会话数量
    static async limitConcurrentSessions(clientIp, maxSessions = 3) {
        const authData = await this.getAuthData();
        const userSessions = Object.entries(authData.sessions)
            .filter(([_, session]) => session.clientIp === clientIp)
            .sort(([_, a], [__, b]) => new Date(b.createdAt) - new Date(a.createdAt));

        if (userSessions.length >= maxSessions) {
            // 删除最旧的会话
            const sessionsToRemove = userSessions.slice(maxSessions - 1);
            for (const [sessionId] of sessionsToRemove) {
                delete authData.sessions[sessionId];
            }
            await this.saveAuthData(authData);
        }
    }

    // 验证token
    static async verifyToken(token) {
        const authData = await this.getAuthData();

        // 查找匹配的会话
        for (const [sessionId, session] of Object.entries(authData.sessions)) {
            let sessionToken = session.token;

            // 如果token是加密的，尝试解密
            if (typeof sessionToken === 'string' && sessionToken.length > 64) {
                try {
                    const decryptedData = this.decryptSensitiveData({ encrypted: sessionToken });
                    sessionToken = decryptedData.token || sessionToken;
                } catch (error) {
                    // 解密失败，使用原始token
                    SecurityUtils.secureError('Token解密失败:', error.message);
                }
            }

            if (sessionToken === token) {
                // 检查是否过期
                if (new Date() > new Date(session.expiresAt)) {
                    delete authData.sessions[sessionId];
                    await this.saveAuthData(authData);
                    return false;
                }

                // 更新最后活动时间
                session.lastActivity = new Date().toISOString();
                await this.saveAuthData(authData);
                return true;
            }
        }

        return false;
    }

    // 记录失败尝试
    static recordFailedAttempt(authData, clientIp) {
        if (!authData.loginAttempts[clientIp]) {
            authData.loginAttempts[clientIp] = [];
        }

        authData.loginAttempts[clientIp].push(new Date().toISOString());

        // 只保留最近1小时的记录
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        authData.loginAttempts[clientIp] = authData.loginAttempts[clientIp]
            .filter(time => new Date(time) > oneHourAgo);

        // 如果失败次数超过5次，锁定15分钟
        if (authData.loginAttempts[clientIp].length >= 5) {
            authData.lockouts[clientIp] = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
    }

    // 检查是否被锁定
    static isLockedOut(authData, clientIp) {
        const lockoutTime = authData.lockouts[clientIp];
        if (!lockoutTime) return false;

        if (new Date() > new Date(lockoutTime)) {
            delete authData.lockouts[clientIp];
            return false;
        }

        return true;
    }

    // 登出
    static async logout(token) {
        const authData = await this.getAuthData();

        // 删除对应的会话
        for (const [sessionId, session] of Object.entries(authData.sessions)) {
            let sessionToken = session.token;

            // 如果token是加密的，尝试解密
            if (typeof sessionToken === 'string' && sessionToken.length > 64) {
                try {
                    const decryptedData = this.decryptSensitiveData({ encrypted: sessionToken });
                    sessionToken = decryptedData.token || sessionToken;
                } catch (error) {
                    SecurityUtils.secureError('登出时Token解密失败:', error.message);
                }
            }

            if (sessionToken === token) {
                delete authData.sessions[sessionId];
                break;
            }
        }

        await this.saveAuthData(authData);
        return true;
    }

    // 强制登出所有会话（密码修改时使用）
    static async logoutAllSessions() {
        const authData = await this.getAuthData();
        authData.sessions = {};
        await this.saveAuthData(authData);
        return true;
    }

    // 检查会话是否来自可疑IP
    static async checkSuspiciousActivity(clientIp) {
        const authData = await this.getAuthData();
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        // 检查同一IP的会话数量
        const ipSessions = Object.values(authData.sessions).filter(session =>
            session.clientIp === clientIp
        );

        if (ipSessions.length > 5) {
            SecurityUtils.secureWarn(`可疑活动：IP ${clientIp} 有 ${ipSessions.length} 个活跃会话`);
            return true;
        }

        return false;
    }

    // 重置密码到初始状态
    static async resetToDefault() {
        const authData = {
            passwordHash: null,
            salt: null,
            isSetup: false,
            sessions: {},
            loginAttempts: {},
            lockouts: {}
        };

        await this.saveAuthData(authData);
        return true;
    }
}

// 响应工具函数
class ResponseHelper {
    static success(res, data = null, message = '操作成功') {
        res.json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    static error(res, message = '操作失败', statusCode = 400, error = null) {
        // 在生产环境中不暴露详细错误信息
        const isProduction = process.env.NODE_ENV === 'production';
        const errorMessage = isProduction ? message : (error?.message || message);

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: isProduction ? null : (error?.message || null),
            timestamp: new Date().toISOString()
        });
    }

    static notFound(res, resource = '资源') {
        this.error(res, `${resource}不存在`, 404);
    }

    static unauthorized(res, message = '未授权访问') {
        this.error(res, message, 401);
    }

    static forbidden(res, message = '禁止访问') {
        this.error(res, message, 403);
    }
}

// 更新 data.js 文件以保持兼容性
async function updateDataJsFile() {
    try {
        const songsData = await DataManager.getSongs();
        const profileData = await DataManager.getProfile();
        const settingsData = await DataManager.readJsonFile(SETTINGS_FILE, { settings: {} });

        const officialData = {
            profile: profileData.profile || {},
            songs: songsData.songs || [],
            settings: settingsData.settings || {}
        };

        const fileContent = `window.officialData = ${JSON.stringify(officialData, null, 2)};`;
        await fs.writeFile(path.join(__dirname, 'data.js'), fileContent, 'utf8');
        console.log('data.js 文件已更新');
    } catch (error) {
        console.error('更新 data.js 文件失败:', error);
    }
}

// 增强的数据验证中间件
const validateSong = (req, res, next) => {
    const { title, artist, genre, note } = req.body;

    // 验证必填字段
    if (!title || typeof title !== 'string' || !title.trim()) {
        return ResponseHelper.error(res, '歌曲标题不能为空', 400);
    }

    if (!artist || typeof artist !== 'string' || !artist.trim()) {
        return ResponseHelper.error(res, '艺术家不能为空', 400);
    }

    // 验证字段长度
    if (title.trim().length > 200) {
        return ResponseHelper.error(res, '歌曲标题过长（最多200字符）', 400);
    }

    if (artist.trim().length > 100) {
        return ResponseHelper.error(res, '艺术家名称过长（最多100字符）', 400);
    }

    if (genre && typeof genre === 'string' && genre.length > 50) {
        return ResponseHelper.error(res, '风格名称过长（最多50字符）', 400);
    }

    if (note && typeof note === 'string' && note.length > 500) {
        return ResponseHelper.error(res, '备注过长（最多500字符）', 400);
    }

    // 验证特殊字符
    const dangerousChars = /<script|javascript:|vbscript:|onload=|onerror=/i;
    if (dangerousChars.test(title) || dangerousChars.test(artist) ||
        (genre && dangerousChars.test(genre)) || (note && dangerousChars.test(note))) {
        return ResponseHelper.error(res, '输入包含不安全字符', 400);
    }

    // 清理和标准化数据
    req.body.title = title.trim();
    req.body.artist = artist.trim();
    req.body.genre = (genre && typeof genre === 'string') ? genre.trim() : '';
    req.body.note = (note && typeof note === 'string') ? note.trim() : '';

    next();
};

// CSRF保护中间件
const csrfProtection = (req, res, next) => {
    // 只对状态改变的请求进行CSRF保护
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
        const sessionId = req.headers['x-session-id'];

        if (!sessionId || !csrfToken) {
            return ResponseHelper.error(res, 'CSRF保护：缺少必要的安全令牌', 403);
        }

        if (!SecurityUtils.verifyCSRFToken(sessionId, csrfToken)) {
            return ResponseHelper.error(res, 'CSRF保护：安全令牌无效或已过期', 403);
        }
    }

    next();
};

// 改进的认证中间件
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return ResponseHelper.unauthorized(res, '需要登录才能执行此操作');
    }

    // 使用AuthManager验证token
    try {
        const isValid = await AuthManager.verifyToken(token);
        if (!isValid) {
            return ResponseHelper.unauthorized(res, '认证令牌无效或已过期');
        }

        // 不在req.user中存储完整token，只存储验证状态
        req.user = {
            authenticated: true,
            tokenHash: crypto.createHash('sha256').update(token).digest('hex').substring(0, 8) // 只存储token的前8位哈希用于日志
        };
        next();
    } catch (error) {
        console.error('认证令牌验证失败:', error);
        return ResponseHelper.unauthorized(res, '认证令牌验证失败');
    }
};

// 公开访问中间件（仅用于真正的公开API）
const allowPublicAccess = (req, res, next) => {
    next();
};

// 安全中间件配置
// 移除X-Powered-By头部
app.disable('x-powered-by');

// 增强的安全HTTP头部
app.use((req, res, next) => {
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');

    // 防止MIME类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // XSS保护
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 增强的内容安全策略
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "upgrade-insecure-requests;"
    );

    // 强制HTTPS（如果在HTTPS环境下）
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // 增强的安全头部
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

    // 防止缓存敏感页面
    if (req.path.includes('/admin') || req.path.includes('/login')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }

    // 隐藏服务器信息
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    next();
});

// 速率限制中间件
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    return (req, res, next) => {
        const clientIp = AuthManager.getClientIp(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // 清理过期记录
        if (rateLimitMap.has(clientIp)) {
            const requests = rateLimitMap.get(clientIp).filter(time => time > windowStart);
            rateLimitMap.set(clientIp, requests);
        }

        // 检查请求频率
        const requests = rateLimitMap.get(clientIp) || [];
        if (requests.length >= maxRequests) {
            SecurityUtils.secureWarn(`速率限制触发: ${clientIp} - ${requests.length} 请求在 ${windowMs/1000} 秒内`);
            return res.status(429).json({
                success: false,
                message: '请求过于频繁，请稍后再试',
                retryAfter: Math.ceil(windowMs / 1000),
                timestamp: new Date().toISOString()
            });
        }

        // 记录请求
        requests.push(now);
        rateLimitMap.set(clientIp, requests);
        next();
    };
};

// 应用速率限制
app.use(rateLimit(200, 15 * 60 * 1000)); // 15分钟内最多200个请求

// 清理速率限制的辅助函数（开发用）
const clearRateLimit = (ip) => {
    if (rateLimitMap.has(ip)) {
        rateLimitMap.delete(ip);
        console.log(`已清理IP ${ip} 的速率限制记录`);
    }
};

// 中间件配置
app.use(bodyParser.json({
    limit: '1mb',  // 降低到1MB
    verify: (req, res, buf) => {
        // 验证JSON格式
        try {
            if (buf.length > 0) {
                JSON.parse(buf);
            }
        } catch (error) {
            throw new Error('无效的JSON格式');
        }
    }
}));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '1mb',
    parameterLimit: 100  // 限制参数数量
}));

// CORS支持 - 严格的安全配置
app.use((req, res, next) => {
    // 严格的CORS配置
    const allowedOrigins = process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) :
        ['http://localhost:8000', 'http://127.0.0.1:8000', 'https://localhost:8000', 'https://127.0.0.1:8000'];

    const origin = req.headers.origin;

    // 只允许明确列出的来源
    if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
        // 同源请求（没有Origin头）
        res.header('Access-Control-Allow-Origin', 'null');
    } else {
        // 拒绝未授权的跨域请求
        return res.status(403).json({
            success: false,
            message: '跨域请求被拒绝',
            timestamp: new Date().toISOString()
        });
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-CSRF-Token');
    res.header('Access-Control-Max-Age', '86400'); // 预检请求缓存24小时

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 安全工具类
class SecurityUtils {
    // CSRF Token管理
    static csrfTokens = new Map();

    // 输入验证函数
    static validateInput(input, options = {}) {
        const {
            maxLength = 1000,
            minLength = 0,
            allowEmpty = true,
            type = 'string',
            pattern = null
        } = options;

        // 类型检查
        if (type === 'string' && typeof input !== 'string') {
            return { valid: false, error: '输入类型错误' };
        }

        if (type === 'number' && typeof input !== 'number') {
            return { valid: false, error: '输入必须是数字' };
        }

        if (type === 'array' && !Array.isArray(input)) {
            return { valid: false, error: '输入必须是数组' };
        }

        // 空值检查
        if (!allowEmpty && (!input || (typeof input === 'string' && !input.trim()))) {
            return { valid: false, error: '输入不能为空' };
        }

        // 长度检查
        if (typeof input === 'string') {
            if (input.length < minLength) {
                return { valid: false, error: `输入长度不能少于${minLength}字符` };
            }
            if (input.length > maxLength) {
                return { valid: false, error: `输入长度不能超过${maxLength}字符` };
            }

            // 危险字符检查
            const dangerousPatterns = [
                /<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i,
                /onclick=/i, /onmouseover=/i, /onfocus=/i, /onblur=/i,
                /<iframe/i, /<object/i, /<embed/i, /<link/i, /<meta/i
            ];

            if (dangerousPatterns.some(pattern => pattern.test(input))) {
                return { valid: false, error: '输入包含不安全字符' };
            }
        }

        // 自定义模式检查
        if (pattern && typeof input === 'string' && !pattern.test(input)) {
            return { valid: false, error: '输入格式不正确' };
        }

        return { valid: true };
    }

    // 生成CSRF Token
    static generateCSRFToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + (60 * 60 * 1000); // 1小时过期

        this.csrfTokens.set(sessionId, {
            token,
            expiresAt
        });

        // 清理过期token
        this.cleanupExpiredCSRFTokens();

        return token;
    }

    // 验证CSRF Token
    static verifyCSRFToken(sessionId, token) {
        const csrfData = this.csrfTokens.get(sessionId);
        if (!csrfData) return false;

        if (Date.now() > csrfData.expiresAt) {
            this.csrfTokens.delete(sessionId);
            return false;
        }

        return csrfData.token === token;
    }

    // 清理过期CSRF Token
    static cleanupExpiredCSRFTokens() {
        const now = Date.now();
        for (const [sessionId, data] of this.csrfTokens.entries()) {
            if (now > data.expiresAt) {
                this.csrfTokens.delete(sessionId);
            }
        }
    }

    // 清理敏感信息的日志函数
    static sanitizeForLog(data) {
        if (typeof data === 'string') {
            // 隐藏token（64位十六进制）
            data = data.replace(/\b[a-f0-9]{64}\b/gi, '[TOKEN_HIDDEN]');
            // 隐藏UUID格式的sessionId
            data = data.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[SESSION_ID_HIDDEN]');
            // 隐藏可能的密码
            data = data.replace(/(password|pwd|pass)[\s]*[:=][\s]*[^\s,}]+/gi, '$1: [PASSWORD_HIDDEN]');
        }
        return data;
    }

    // 安全的console.log
    static secureLog(...args) {
        const sanitizedArgs = args.map(arg =>
            typeof arg === 'string' ? this.sanitizeForLog(arg) : arg
        );
        console.log(...sanitizedArgs);
    }

    // 安全的console.error
    static secureError(...args) {
        const sanitizedArgs = args.map(arg =>
            typeof arg === 'string' ? this.sanitizeForLog(arg) : arg
        );
        console.error(...sanitizedArgs);
    }

    // 安全的console.warn
    static secureWarn(...args) {
        const sanitizedArgs = args.map(arg =>
            typeof arg === 'string' ? this.sanitizeForLog(arg) : arg
        );
        console.warn(...sanitizedArgs);
    }
}

// 增强的安全请求日志中间件
app.use((req, res, next) => {
    const clientIp = AuthManager.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const timestamp = new Date().toISOString();
    const contentLength = req.headers['content-length'] || 0;

    // 安全记录基本请求信息（自动过滤敏感数据）
    SecurityUtils.secureLog(`${timestamp} - ${clientIp} - ${req.method} ${req.path} - ${userAgent.substring(0, 100)} - ${contentLength}B`);

    // 检测可疑活动
    const suspiciousPatterns = [
        // 路径遍历
        /\.\./,
        // 系统文件访问
        /\/etc\/|\/proc\/|\/sys\/|\/dev\/|\/var\/|\/tmp\//,
        // SQL注入尝试
        /union.*select|select.*from|insert.*into|delete.*from|drop.*table/i,
        // 脚本注入
        /<script|javascript:|vbscript:|onload=|onerror=/i,
        // 命令注入
        /;.*ls|;.*cat|;.*wget|;.*curl|\|.*nc|\|.*bash/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(req.path + req.url))) {
        SecurityUtils.secureWarn(`🚨 可疑请求模式: ${clientIp} - ${req.method} ${req.path}`);
    }

    // 检测异常大的请求
    if (contentLength > 10 * 1024 * 1024) { // 10MB
        SecurityUtils.secureWarn(`🚨 异常大请求: ${clientIp} - ${contentLength} bytes`);
    }

    // 检测异常User-Agent
    const suspiciousUA = [
        /sqlmap|nikto|nmap|masscan|zap|burp|metasploit/i,
        /bot|crawler|spider|scraper/i
    ];

    if (suspiciousUA.some(pattern => pattern.test(userAgent))) {
        SecurityUtils.secureWarn(`🚨 可疑User-Agent: ${clientIp} - ${userAgent.substring(0, 100)}`);
    }

    // 检测缺少必要头部的请求
    if (req.method === 'POST' && !req.headers['content-type']) {
        SecurityUtils.secureWarn(`🚨 POST请求缺少Content-Type: ${clientIp} - ${req.path}`);
    }

    next();
});

// 安全的路径验证函数
function validateUploadType(type) {
    const allowedTypes = ['avatars', 'backgrounds', 'covers'];
    if (!type || typeof type !== 'string') {
        return 'avatars';
    }

    // 防止路径遍历攻击
    const sanitizedType = type.replace(/[^a-zA-Z0-9_-]/g, '');

    if (allowedTypes.includes(sanitizedType)) {
        return sanitizedType;
    }

    return 'avatars'; // 默认类型
}

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 安全验证上传类型
        const type = validateUploadType(req.query.type);
        const dir = path.join(__dirname, 'images', type);

        // 确保目录存在
        if (!fsSync.existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // 安全生成文件名：时间戳 + 随机数 + 验证过的扩展名
        const timestamp = Date.now();
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();

        // 验证扩展名安全性
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico'];
        const safeExt = allowedExtensions.includes(ext) ? ext : '.jpg';

        const filename = `${timestamp}_${randomSuffix}${safeExt}`;
        cb(null, filename);
    }
});

// 文件魔数验证
const validateFileSignature = (buffer, mimetype) => {
    const signatures = {
        'image/jpeg': [
            [0xFF, 0xD8, 0xFF],
        ],
        'image/png': [
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        ],
        'image/gif': [
            [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
            [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
        ],
        'image/webp': [
            [0x52, 0x49, 0x46, 0x46] // RIFF
        ]
    };

    const fileSignatures = signatures[mimetype];
    if (!fileSignatures) return false;

    return fileSignatures.some(signature => {
        if (buffer.length < signature.length) return false;
        return signature.every((byte, index) => buffer[index] === byte);
    });
};

// 增强的文件过滤器
const fileFilter = (req, file, cb) => {
    // 允许的图片类型
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/x-icon',
        'image/vnd.microsoft.icon'
    ];

    // 允许的文件扩展名
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // 检查文件名安全性
    const filename = file.originalname;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') ||
        filename.includes('<') || filename.includes('>') || filename.includes('|') ||
        filename.includes('&') || filename.includes(';') || filename.includes('`') ||
        filename.includes('$') || filename.includes('*') || filename.includes('?')) {
        cb(new Error('文件名包含非法字符'), false);
        return;
    }

    // 检查文件名长度
    if (filename.length > 100) {
        cb(new Error('文件名过长'), false);
        return;
    }

    // 检查是否为隐藏文件
    if (filename.startsWith('.')) {
        cb(new Error('不允许上传隐藏文件'), false);
        return;
    }

    // 检查MIME类型和文件扩展名匹配
    if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(fileExtension)) {
        cb(new Error('只允许上传图片文件（jpg, png, gif, webp, ico）'), false);
        return;
    }

    // 额外的MIME类型验证
    const mimeExtensionMap = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'image/webp': ['.webp'],
        'image/x-icon': ['.ico'],
        'image/vnd.microsoft.icon': ['.ico']
    };

    if (!mimeExtensionMap[file.mimetype]?.includes(fileExtension)) {
        cb(new Error('文件类型与扩展名不匹配'), false);
        return;
    }

    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,  // 限制5MB
        files: 1,                   // 一次只能上传一个文件
        fields: 10,                 // 限制表单字段数量
        fieldNameSize: 100,         // 限制字段名长度
        fieldSize: 1024             // 限制字段值大小
    }
});

// 增强的静态文件服务配置
// 阻止访问敏感文件和目录
app.use((req, res, next) => {
    const blockedPaths = [
        '/data/',
        '/node_modules/',
        '/.git/',
        '/package.json',
        '/package-lock.json',
        '/server.js',
        '/FIRST_LOGIN.md',
        '/SECURITY.md',
        '/DEPLOYMENT_GUIDE.md',
        '/API.md',
        '/README.md',
        '/.env',
        '/auth.json',
        '/.gitignore',
        '/yarn.lock',
        '/pnpm-lock.yaml'
    ];

    const blockedExtensions = ['.json', '.md', '.js', '.log', '.env', '.config'];
    const requestPath = req.path.toLowerCase();

    // 记录可疑的文件访问尝试
    if (blockedPaths.some(blocked => requestPath.startsWith(blocked))) {
        SecurityUtils.secureWarn(`🚨 尝试访问敏感路径: ${AuthManager.getClientIp(req)} - ${req.path}`);
        return res.status(404).json({
            success: false,
            message: '页面未找到',
            timestamp: new Date().toISOString()
        });
    }

    // 检查是否访问被阻止的文件扩展名（除了允许的JS文件）
    const allowedJsFiles = ['/script.js', '/admin.js', '/auth.js', '/api-client.js', '/simple-genre-manager.js', '/data.js'];
    if (blockedExtensions.some(ext => requestPath.endsWith(ext)) &&
        !allowedJsFiles.includes(requestPath)) {
        SecurityUtils.secureWarn(`🚨 尝试访问敏感文件: ${AuthManager.getClientIp(req)} - ${req.path}`);
        return res.status(404).json({
            success: false,
            message: '页面未找到',
            timestamp: new Date().toISOString()
        });
    }

    // 防止路径遍历攻击
    if (requestPath.includes('../') || requestPath.includes('..\\') ||
        requestPath.includes('%2e%2e') || requestPath.includes('%2f') ||
        requestPath.includes('%5c')) {
        SecurityUtils.secureWarn(`🚨 路径遍历攻击尝试: ${AuthManager.getClientIp(req)} - ${req.path}`);
        return res.status(403).json({
            success: false,
            message: '禁止访问',
            timestamp: new Date().toISOString()
        });
    }

    next();
});

// 提供静态文件服务（仅限安全的文件）
app.use(express.static(path.join(__dirname), {
    dotfiles: 'deny', // 拒绝访问点文件
    index: ['index.html'], // 默认首页
    setHeaders: (res, path) => {
        // 为静态文件设置缓存头
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (path.match(/\.(jpg|jpeg|png|gif|ico|webp)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

// ==================== API 路由 ====================

// 认证 API
// 检查是否为首次设置
app.get('/api/auth/status', async (req, res) => {
    try {
        // 强制检查并重置不安全的默认配置
        const wasReset = await AuthManager.forceFirstTimeSetupIfNeeded();
        const isFirstTime = await AuthManager.isFirstTimeSetup();

        let message = '系统已初始化';
        if (isFirstTime) {
            message = '系统需要初始化，请使用默认密码登录并立即修改密码';
        } else if (wasReset) {
            message = '检测到不安全配置已重置，请使用默认密码重新设置';
        }

        ResponseHelper.success(res, {
            isFirstTime: isFirstTime || wasReset,
            message,
            securityNotice: '为了安全，请立即修改默认密码'
        });
    } catch (error) {
        console.error('获取认证状态失败:', error);
        ResponseHelper.error(res, '获取认证状态失败', 500);
    }
});

// 登录 - 适度的速率限制（开发友好）
app.post('/api/auth/login', rateLimit(30, 5 * 60 * 1000), async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return ResponseHelper.error(res, '请输入密码', 400);
        }

        const result = await AuthManager.verifyLogin(password, req);

        if (result.firstTime) {
            // 首次登录，需要修改密码
            ResponseHelper.success(res, {
                firstTime: true,
                message: '首次登录成功，请设置新密码'
            });
        } else {
            // 正常登录成功
            ResponseHelper.success(res, {
                firstTime: false,
                token: result.token,
                sessionId: result.sessionId,
                message: '登录成功'
            });
        }
    } catch (error) {
        SecurityUtils.secureError('登录失败:', error.message);
        ResponseHelper.error(res, error.message || '登录失败', 401);
    }
});

// 设置密码（首次设置或修改密码）
app.post('/api/auth/set-password', async (req, res) => {
    try {
        const { newPassword, currentPassword } = req.body;

        if (!newPassword) {
            return ResponseHelper.error(res, '请输入新密码', 400);
        }

        await AuthManager.setPassword(newPassword, currentPassword);

        // 设置密码成功后，如果是首次设置，需要重新登录获取token
        const isFirstTime = !currentPassword || currentPassword === AuthManager.DEFAULT_PASSWORD;
        if (isFirstTime) {
            const loginResult = await AuthManager.verifyLogin(newPassword, req);
            ResponseHelper.success(res, {
                message: '密码设置成功',
                token: loginResult.token,
                sessionId: loginResult.sessionId
            });
        } else {
            // 密码修改成功，强制登出所有会话
            await AuthManager.logoutAllSessions();
            ResponseHelper.success(res, { message: '密码修改成功，所有会话已失效，请重新登录' });
        }
    } catch (error) {
        console.error('设置密码失败:', error);
        ResponseHelper.error(res, error.message || '设置密码失败', 400);
    }
});

// 登出
app.post('/api/auth/logout', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            await AuthManager.logout(token);
        }

        ResponseHelper.success(res, { message: '登出成功' });
    } catch (error) {
        console.error('登出失败:', error);
        ResponseHelper.error(res, '登出失败', 500);
    }
});

// 验证token
app.get('/api/auth/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return ResponseHelper.error(res, '未提供认证令牌', 401);
        }

        const isValid = await AuthManager.verifyToken(token);

        if (isValid) {
            ResponseHelper.success(res, { valid: true, message: '令牌有效' });
        } else {
            ResponseHelper.error(res, '令牌无效或已过期', 401);
        }
    } catch (error) {
        console.error('验证令牌失败:', error);
        ResponseHelper.error(res, '验证令牌失败', 500, error);
    }
});

// 获取CSRF Token
app.get('/api/auth/csrf-token', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            return ResponseHelper.error(res, '缺少会话ID', 400);
        }

        const csrfToken = SecurityUtils.generateCSRFToken(sessionId);
        ResponseHelper.success(res, { csrfToken });
    } catch (error) {
        SecurityUtils.secureError('生成CSRF Token失败:', error);
        ResponseHelper.error(res, '生成CSRF Token失败', 500);
    }
});

// 密码重置API已移除 - 安全考虑
// 如需重置密码，请手动删除 data/auth.json 文件并重启服务器

// 歌曲管理 API
// 获取所有歌曲 - 公开访问（观众查看歌单）
app.get('/api/songs', allowPublicAccess, async (req, res) => {
    try {
        const { page = 1, limit = 50, genre, search } = req.query;
        const songsData = await DataManager.getSongs();
        let songs = songsData.songs;

        // 筛选
        if (genre && genre !== 'all') {
            songs = songs.filter(song => song.genre === genre);
        }

        // 搜索
        if (search) {
            const searchTerm = search.toLowerCase();
            songs = songs.filter(song =>
                song.title.toLowerCase().includes(searchTerm) ||
                song.artist.toLowerCase().includes(searchTerm)
            );
        }

        // 分页
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedSongs = songs.slice(startIndex, endIndex);

        ResponseHelper.success(res, {
            songs: paginatedSongs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: songs.length,
                totalPages: Math.ceil(songs.length / limit)
            },
            metadata: songsData.metadata
        });
    } catch (error) {
        console.error('获取歌曲列表失败:', error);
        ResponseHelper.error(res, '获取歌曲列表失败', 500, error);
    }
});

// 获取单个歌曲 - 公开访问
app.get('/api/songs/:id', allowPublicAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const songsData = await DataManager.getSongs();
        const song = songsData.songs.find(s => s.id === id);

        if (!song) {
            return ResponseHelper.notFound(res, '歌曲');
        }

        ResponseHelper.success(res, song);
    } catch (error) {
        console.error('获取歌曲失败:', error);
        ResponseHelper.error(res, '获取歌曲失败', 500, error);
    }
});

// 添加歌曲
app.post('/api/songs', authenticateToken, csrfProtection, validateSong, async (req, res) => {
    try {
        const songsData = await DataManager.getSongs();
        const newSong = {
            id: DataManager.generateId(),
            title: req.body.title,
            artist: req.body.artist,
            genre: req.body.genre || '',
            note: req.body.note || '',
            addedDate: new Date().toISOString()
        };

        songsData.songs.push(newSong);
        const success = await DataManager.saveSongs(songsData);

        if (success) {
            ResponseHelper.success(res, newSong, '歌曲添加成功');
        } else {
            ResponseHelper.error(res, '保存歌曲失败', 500);
        }
    } catch (error) {
        console.error('添加歌曲失败:', error);
        ResponseHelper.error(res, '添加歌曲失败', 500, error);
    }
});

// 更新歌曲
app.put('/api/songs/:id', authenticateToken, validateSong, async (req, res) => {
    try {
        const { id } = req.params;
        const songsData = await DataManager.getSongs();
        const songIndex = songsData.songs.findIndex(s => s.id === id);

        if (songIndex === -1) {
            return ResponseHelper.notFound(res, '歌曲');
        }

        // 更新歌曲信息
        songsData.songs[songIndex] = {
            ...songsData.songs[songIndex],
            title: req.body.title,
            artist: req.body.artist,
            genre: req.body.genre || '',
            note: req.body.note || '',
            updatedDate: new Date().toISOString()
        };

        const success = await DataManager.saveSongs(songsData);

        if (success) {
            ResponseHelper.success(res, songsData.songs[songIndex], '歌曲更新成功');
        } else {
            ResponseHelper.error(res, '保存歌曲失败', 500);
        }
    } catch (error) {
        console.error('更新歌曲失败:', error);
        ResponseHelper.error(res, '更新歌曲失败', 500, error);
    }
});

// 删除歌曲
app.delete('/api/songs/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const songsData = await DataManager.getSongs();
        const songIndex = songsData.songs.findIndex(s => s.id === id);

        if (songIndex === -1) {
            return ResponseHelper.notFound(res, '歌曲');
        }

        const deletedSong = songsData.songs.splice(songIndex, 1)[0];
        const success = await DataManager.saveSongs(songsData);

        if (success) {
            ResponseHelper.success(res, deletedSong, '歌曲删除成功');
        } else {
            ResponseHelper.error(res, '保存数据失败', 500);
        }
    } catch (error) {
        console.error('删除歌曲失败:', error);
        ResponseHelper.error(res, '删除歌曲失败', 500, error);
    }
});

// 批量删除歌曲
app.delete('/api/songs', authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return ResponseHelper.error(res, '请提供要删除的歌曲ID列表');
        }

        const songsData = await DataManager.getSongs();
        const deletedSongs = [];

        // 从后往前删除，避免索引问题
        for (let i = songsData.songs.length - 1; i >= 0; i--) {
            if (ids.includes(songsData.songs[i].id)) {
                deletedSongs.push(songsData.songs.splice(i, 1)[0]);
            }
        }

        const success = await DataManager.saveSongs(songsData);

        if (success) {
            ResponseHelper.success(res, {
                deletedCount: deletedSongs.length,
                deletedSongs: deletedSongs.reverse()
            }, `成功删除 ${deletedSongs.length} 首歌曲`);
        } else {
            ResponseHelper.error(res, '保存数据失败', 500);
        }
    } catch (error) {
        console.error('批量删除歌曲失败:', error);
        ResponseHelper.error(res, '批量删除歌曲失败', 500, error);
    }
});

// 个人资料管理 API
// 获取个人资料 - 公开访问（显示主播信息）
app.get('/api/profile', allowPublicAccess, async (req, res) => {
    try {
        const profileData = await DataManager.getProfile();
        ResponseHelper.success(res, profileData);
    } catch (error) {
        console.error('获取个人资料失败:', error);
        ResponseHelper.error(res, '获取个人资料失败', 500, error);
    }
});

// 更新个人资料
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const profileData = await DataManager.getProfile();

        // 更新资料信息
        profileData.profile = {
            ...profileData.profile,
            ...req.body
        };

        const success = await DataManager.saveProfile(profileData);

        if (success) {
            ResponseHelper.success(res, profileData.profile, '个人资料更新成功');
        } else {
            ResponseHelper.error(res, '保存个人资料失败', 500);
        }
    } catch (error) {
        console.error('更新个人资料失败:', error);
        ResponseHelper.error(res, '更新个人资料失败', 500, error);
    }
});

// 获取设置信息 - 公开访问（前端需要点歌指令格式）
app.get('/api/settings', allowPublicAccess, async (req, res) => {
    try {
        const settings = await DataManager.readJsonFile(SETTINGS_FILE, {
            settings: {
                commandPrefix: '/点歌',
                commandSuffix: '',
                theme: 'light',
                autoSave: true,
                backupEnabled: true,
                maxSongsPerPage: 50,
                allowGuestView: true,
                enableSearch: true,
                enableFilter: true
            }
        });

        ResponseHelper.success(res, { settings: settings.settings });
    } catch (error) {
        console.error('获取设置失败:', error);
        ResponseHelper.error(res, '获取设置失败', 500, error);
    }
});

// 新的风格管理 API
// 获取所有风格 - 公开访问（前端筛选需要）
app.get('/api/genres', allowPublicAccess, async (req, res) => {
    try {
        const genresData = await DataManager.getGenres();
        ResponseHelper.success(res, genresData.genres || []);
    } catch (error) {
        console.error('获取风格数据失败:', error);
        ResponseHelper.error(res, '获取风格数据失败', 500, error);
    }
});

// 添加新风格
app.post('/api/genres', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return ResponseHelper.error(res, '风格名称不能为空', 400);
        }

        const genresData = await DataManager.getGenres();
        const genres = genresData.genres || [];

        // 检查是否已存在
        if (genres.some(g => g.name === name.trim())) {
            return ResponseHelper.error(res, '该风格已存在', 400);
        }

        // 添加新风格
        const newGenre = {
            id: 'custom_' + Date.now(),
            name: name.trim(),
            builtIn: false,
            createdAt: new Date().toISOString()
        };

        genres.push(newGenre);

        // 保存数据
        const updatedData = {
            ...genresData,
            genres: genres,
            metadata: {
                ...genresData.metadata,
                lastModified: new Date().toISOString(),
                totalCount: genres.length
            }
        };

        const saved = await DataManager.saveGenres(updatedData);
        if (saved) {
            ResponseHelper.success(res, newGenre, '风格添加成功');
        } else {
            ResponseHelper.error(res, '保存失败', 500);
        }
    } catch (error) {
        console.error('添加风格失败:', error);
        ResponseHelper.error(res, '添加风格失败', 500, error);
    }
});

// 删除风格
app.delete('/api/genres/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const genresData = await DataManager.getGenres();
        const genres = genresData.genres || [];

        const genreIndex = genres.findIndex(g => g.id === id);
        if (genreIndex === -1) {
            return ResponseHelper.error(res, '风格不存在', 404);
        }

        const genre = genres[genreIndex];
        if (genre.builtIn) {
            return ResponseHelper.error(res, '不能删除内置风格', 400);
        }

        // 删除风格
        genres.splice(genreIndex, 1);

        // 保存数据
        const updatedData = {
            ...genresData,
            genres: genres,
            metadata: {
                ...genresData.metadata,
                lastModified: new Date().toISOString(),
                totalCount: genres.length
            }
        };

        const saved = await DataManager.saveGenres(updatedData);
        if (saved) {
            ResponseHelper.success(res, null, '风格删除成功');
        } else {
            ResponseHelper.error(res, '保存失败', 500);
        }
    } catch (error) {
        console.error('删除风格失败:', error);
        ResponseHelper.error(res, '删除风格失败', 500, error);
    }
});

// 获取风格名称映射 - 需要认证
app.post('/api/genre-names', authenticateToken, async (req, res) => {
    try {
        const { genreIds } = req.body;
        if (!Array.isArray(genreIds)) {
            return ResponseHelper.error(res, '参数格式错误', 400);
        }

        const songsData = await DataManager.getSongs();
        const customGenres = songsData.customGenres || [];

        // 创建ID到名称的映射
        const nameMapping = {};
        customGenres.forEach(genre => {
            if (genreIds.includes(genre.id)) {
                nameMapping[genre.id] = genre.name;
            }
        });

        ResponseHelper.success(res, nameMapping);
    } catch (error) {
        console.error('获取风格名称失败:', error);
        ResponseHelper.error(res, '获取风格名称失败', 500, error);
    }
});

// 调试API：获取风格映射信息 - 需要认证
app.get('/api/debug/genres', authenticateToken, async (req, res) => {
    try {
        const songsData = await DataManager.getSongs();
        const songs = songsData.songs || [];

        // 统计所有使用的风格ID
        const genreStats = {};
        songs.forEach(song => {
            if (song.genre) {
                genreStats[song.genre] = (genreStats[song.genre] || 0) + 1;
            }
        });

        res.json({
            success: true,
            data: {
                genreStats,
                totalSongs: songs.length,
                sampleSongs: songs.slice(0, 5).map(s => ({
                    id: s.id,
                    title: s.title,
                    genre: s.genre
                }))
            }
        });
    } catch (error) {
        console.error('获取风格调试信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取风格调试信息失败'
        });
    }
});

// 更新设置信息
app.put('/api/settings', authenticateToken, async (req, res) => {
    try {
        const newSettings = req.body;

        if (!newSettings) {
            return ResponseHelper.error(res, '设置数据不能为空');
        }

        // 读取现有设置
        const currentData = await DataManager.readJsonFile(SETTINGS_FILE, {
            settings: {},
            metadata: {}
        });

        // 更新设置
        const updatedData = {
            settings: {
                ...currentData.settings,
                ...newSettings
            },
            metadata: {
                ...currentData.metadata,
                lastModified: new Date().toISOString()
            }
        };

        // 保存设置
        const success = await DataManager.writeJsonFile(SETTINGS_FILE, updatedData);

        if (success) {
            // 同时更新 data.js 文件以保持兼容性
            await updateDataJsFile();
            ResponseHelper.success(res, { settings: updatedData.settings }, '设置已更新');
        } else {
            ResponseHelper.error(res, '保存设置失败', 500);
        }
    } catch (error) {
        console.error('更新设置失败:', error);
        ResponseHelper.error(res, '更新设置失败', 500, error);
    }
});

// 数据统计 API - 需要认证
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const songsData = await DataManager.getSongs();
        const songs = songsData.songs;

        // 统计各种类型的歌曲数量
        const genreStats = {};
        const noteStats = {};

        songs.forEach(song => {
            // 统计类型
            const genre = song.genre || '未分类';
            genreStats[genre] = (genreStats[genre] || 0) + 1;

            // 统计备注
            const note = song.note || '无备注';
            noteStats[note] = (noteStats[note] || 0) + 1;
        });

        const stats = {
            totalSongs: songs.length,
            genreStats,
            noteStats,
            recentSongs: songs
                .sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
                .slice(0, 5),
            lastUpdated: songsData.metadata.lastModified
        };

        ResponseHelper.success(res, stats);
    } catch (error) {
        console.error('获取统计数据失败:', error);
        ResponseHelper.error(res, '获取统计数据失败', 500, error);
    }
});

// 数据同步 API（兼容现有功能）
app.post('/api/update-data', authenticateToken, async (req, res) => {
    try {
        const newData = req.body;

        if (!newData || !newData.profile || !newData.songs) {
            return ResponseHelper.error(res, '数据格式无效');
        }

        // 保存到新的数据文件结构
        const songsData = {
            songs: newData.songs.map(song => ({
                ...song,
                id: song.id || DataManager.generateId()
            })),
            customGenres: newData.customGenres || [], // 保存自定义风格数据
            metadata: {
                version: '1.0',
                lastModified: new Date().toISOString(),
                totalCount: newData.songs.length
            }
        };

        const profileData = {
            profile: newData.profile,
            metadata: {
                version: '1.0',
                lastModified: new Date().toISOString()
            }
        };

        // 保存数据
        const songsSaved = await DataManager.saveSongs(songsData);
        const profileSaved = await DataManager.saveProfile(profileData);

        // 同时更新旧的 data.js 文件以保持兼容性
        const fileContent = `window.officialData = ${JSON.stringify(newData, null, 2)};`;
        await fs.writeFile(path.join(__dirname, 'data.js'), fileContent, 'utf8');

        if (songsSaved && profileSaved) {
            ResponseHelper.success(res, null, '数据已同步到官网！');
        } else {
            ResponseHelper.error(res, '部分数据保存失败', 500);
        }
    } catch (error) {
        console.error('同步数据失败:', error);
        ResponseHelper.error(res, '同步数据失败', 500, error);
    }
});

// 文件上传接口
app.post('/api/upload', authenticateToken, csrfProtection, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return ResponseHelper.error(res, '没有收到文件');
        }

        // 验证文件内容（魔数检查）
        const fileBuffer = await fs.readFile(req.file.path);
        const isValidImage = validateFileSignature(fileBuffer, req.file.mimetype);

        if (!isValidImage && !req.file.mimetype.includes('icon')) {
            // 删除无效文件
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                SecurityUtils.secureError('删除无效文件失败:', unlinkError.message);
            }
            return ResponseHelper.error(res, '文件内容验证失败，不是有效的图片文件', 400);
        }

        // 检查文件是否包含可执行代码
        const fileContent = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length));
        const suspiciousPatterns = [
            /<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i,
            /<?php/i, /<%/i, /#!/i, /eval\(/i, /exec\(/i
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(fileContent))) {
            // 删除可疑文件
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                SecurityUtils.secureError('删除可疑文件失败:', unlinkError.message);
            }
            return ResponseHelper.error(res, '文件包含可疑内容，上传被拒绝', 400);
        }

        // 安全返回文件的相对路径
        const safeType = validateUploadType(req.query.type);
        const relativePath = path.join('images', safeType, req.file.filename)
            .replace(/\\/g, '/');  // 转换为正斜杠，确保在Windows上也能正常工作

        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: relativePath,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadDate: new Date().toISOString()
        };

        ResponseHelper.success(res, fileInfo, '文件上传成功');
    } catch (error) {
        SecurityUtils.secureError('文件上传失败:', error.message);
        ResponseHelper.error(res, '文件上传失败', 500);
    }
});

// 获取图片列表接口 - 需要认证
app.get('/api/images', authenticateToken, async (req, res) => {
    try {
        const type = validateUploadType(req.query.type);  // 安全验证类型
        const imagesDir = path.join(__dirname, 'images', type);

        // 检查目录是否存在
        if (!fsSync.existsSync(imagesDir)) {
            return ResponseHelper.success(res, {
                images: [],
                count: 0,
                type
            }, '目录不存在');
        }

        // 读取目录下的所有文件
        const files = await fs.readdir(imagesDir);

        // 过滤出图片文件
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const imagePromises = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            })
            .map(async file => {
                const filePath = path.join('images', type, file).replace(/\\/g, '/');
                const fullPath = path.join(imagesDir, file);

                try {
                    const stats = await fs.stat(fullPath);
                    return {
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        modified: stats.mtime,
                        created: stats.birthtime
                    };
                } catch (err) {
                    return {
                        filename: file,
                        path: filePath,
                        size: 0,
                        modified: new Date(),
                        created: new Date()
                    };
                }
            });

        const images = await Promise.all(imagePromises);
        images.sort((a, b) => new Date(b.modified) - new Date(a.modified)); // 按修改时间倒序

        ResponseHelper.success(res, {
            images,
            count: images.length,
            type
        });
    } catch (error) {
        console.error('获取图片列表失败:', error);
        ResponseHelper.error(res, '获取图片列表失败', 500, error);
    }
});

// 404 处理 - 统一错误响应，避免信息泄露
app.use((req, res, next) => {
    const clientIp = AuthManager.getClientIp(req);

    if (req.path.startsWith('/api/')) {
        // 记录API 404请求用于安全分析
        SecurityUtils.secureWarn(`API 404请求: ${clientIp} - ${req.method} ${req.path}`);

        // 统一的API 404响应
        res.status(404).json({
            success: false,
            message: '请求的API接口不存在',
            timestamp: new Date().toISOString()
        });
    } else {
        // 记录静态文件404请求
        SecurityUtils.secureLog(`静态文件404: ${clientIp} - ${req.path}`);
        next();
    }
});

// 安全的错误处理中间件
app.use((err, req, res, next) => {
    const clientIp = AuthManager.getClientIp(req);
    const timestamp = new Date().toISOString();

    // 记录详细错误信息到服务器日志
    console.error(`${timestamp} - 错误 - ${clientIp} - ${req.method} ${req.path}:`, err.message);

    if (err instanceof multer.MulterError) {
        // Multer错误处理
        if (err.code === 'LIMIT_FILE_SIZE') {
            return ResponseHelper.error(res, '文件大小不能超过5MB', 400);
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return ResponseHelper.error(res, '文件数量超出限制', 400);
        }
        return ResponseHelper.error(res, '文件上传错误', 400);
    }

    // 其他错误 - 不暴露详细错误信息给客户端
    if (process.env.NODE_ENV === 'development') {
        ResponseHelper.error(res, `开发模式错误: ${err.message}`, 500);
    } else {
        ResponseHelper.error(res, '服务器内部错误', 500);
    }
});

// 404处理中间件
app.use((req, res) => {
    SecurityUtils.secureWarn(`404 请求: ${AuthManager.getClientIp(req)} - ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        message: '页面未找到',
        timestamp: new Date().toISOString()
    });
});

// 初始化数据文件
async function initializeData() {
    try {
        // 确保数据文件存在
        await DataManager.getSongs();
        await DataManager.getProfile();

        console.log('[完成] 数据文件初始化完成');
    } catch (error) {
        console.error('[错误] 数据文件初始化失败:', error);
    }
}

// 启动服务器
async function startServer() {
    try {
        await initializeData();

        // 启动时更新data.js文件
        await updateDataJsFile();

        // 启动时安全检查
        await AuthManager.forceFirstTimeSetupIfNeeded();

        // 启动时清理过期会话
        await AuthManager.cleanupExpiredSessions();

        // 设置定期清理任务（每小时执行一次）
        setInterval(async () => {
            try {
                await AuthManager.cleanupExpiredSessions();
                SecurityUtils.cleanupExpiredCSRFTokens();
            } catch (error) {
                SecurityUtils.secureError('定期清理任务失败:', error.message);
            }
        }, 60 * 60 * 1000); // 1小时

        // 启动HTTP服务器
        app.listen(PORT, () => {
            console.log(`
    ================================================
    虚拟主播歌单系统 - API服务器已启动！

    服务器地址: http://localhost:${PORT}

    前端页面:
    - 主页 (观众访问): http://localhost:${PORT}
    - 后台 (主播管理): http://localhost:${PORT}/admin.html
    - 登录页面: http://localhost:${PORT}/login.html

    API接口:
    - 歌曲管理: http://localhost:${PORT}/api/songs
    - 个人资料: http://localhost:${PORT}/api/profile
    - 数据统计: http://localhost:${PORT}/api/stats
    - 文件上传: http://localhost:${PORT}/api/upload

    数据存储: ./data/ 目录

    安全特性已启用:
    - 强密码策略
    - 防爆破攻击保护
    - 会话管理和清理
    - 安全HTTP头部
    - 严格CORS策略

    注意: 部署到公网时请启用HTTPS

    ================================================
            `);
        });
    } catch (error) {
        console.error('[错误] 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();