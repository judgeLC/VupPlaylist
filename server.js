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
            return JSON.parse(data);
        } catch (error) {
            console.error(`读取文件失败 ${filePath}:`, error);
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
    static DEFAULT_PASSWORD = 'Admin@123456';

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

    // 验证登录
    static async verifyLogin(password) {
        const authData = await this.getAuthData();
        const clientIp = '127.0.0.1'; // 简化处理，实际应该从请求中获取

        // 检查是否被锁定
        if (this.isLockedOut(authData, clientIp)) {
            throw new Error('账户已被锁定，请稍后再试');
        }

        // 首次设置
        if (!authData.isSetup) {
            if (password !== this.DEFAULT_PASSWORD) {
                this.recordFailedAttempt(authData, clientIp);
                await this.saveAuthData(authData);
                throw new Error('首次登录请使用默认密码：Admin@123456');
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

        authData.sessions[sessionId] = {
            token,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时
            clientIp
        };

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
            throw new Error('首次设置请先输入默认密码：Admin@123456');
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

    // 验证token
    static async verifyToken(token) {
        const authData = await this.getAuthData();

        // 查找匹配的会话
        for (const [sessionId, session] of Object.entries(authData.sessions)) {
            if (session.token === token) {
                // 检查是否过期
                if (new Date() > new Date(session.expiresAt)) {
                    delete authData.sessions[sessionId];
                    await this.saveAuthData(authData);
                    return false;
                }
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
            if (session.token === token) {
                delete authData.sessions[sessionId];
                break;
            }
        }

        await this.saveAuthData(authData);
        return true;
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
        res.status(statusCode).json({
            success: false,
            message,
            error: error?.message || null,
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

// 数据验证中间件
const validateSong = (req, res, next) => {
    const { title, artist } = req.body;

    if (!title || !title.trim()) {
        return ResponseHelper.error(res, '歌曲标题不能为空');
    }

    if (!artist || !artist.trim()) {
        return ResponseHelper.error(res, '艺术家不能为空');
    }

    // 清理数据
    req.body.title = title.trim();
    req.body.artist = artist.trim();
    req.body.genre = req.body.genre?.trim() || '';
    req.body.note = req.body.note?.trim() || '';

    next();
};

// 改进的认证中间件
const authenticateToken = async (req, res, next) => {
    // 对于GET请求（读取操作），可以不需要认证
    if (req.method === 'GET' && (req.path.startsWith('/api/songs') || req.path.startsWith('/api/profile') || req.path.startsWith('/api/stats') || req.path.startsWith('/api/settings'))) {
        return next();
    }

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

        req.user = { authenticated: true, token };
        next();
    } catch (error) {
        console.error('认证令牌验证失败:', error);
        return ResponseHelper.unauthorized(res, '认证令牌验证失败');
    }
};

// 中间件配置
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// CORS支持 - 更安全的配置
app.use((req, res, next) => {
    // 在生产环境中应该设置具体的域名
    const allowedOrigins = process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',') :
        ['http://localhost:8000', 'http://127.0.0.1:8000'];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || !origin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 根据上传类型选择目录
        const type = req.query.type || 'avatars';  // 默认为头像
        const dir = path.join(__dirname, 'images', type);
        
        // 确保目录存在
        if (!fsSync.existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }
        
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // 生成文件名：时间戳 + 原始扩展名
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}${ext}`);
    }
});

// 改进的文件过滤器
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

    // 检查MIME类型和文件扩展名
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
        // 检查文件名安全性
        const filename = file.originalname;
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            cb(new Error('文件名包含非法字符！'), false);
            return;
        }
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件（jpg, png, gif, webp, ico）！'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024  // 限制5MB
    }
});

// 提供静态文件服务（HTML, CSS, JS等）
app.use(express.static(path.join(__dirname)));

// ==================== API 路由 ====================

// 认证 API
// 检查是否为首次设置
app.get('/api/auth/status', async (req, res) => {
    try {
        const isFirstTime = await AuthManager.isFirstTimeSetup();
        ResponseHelper.success(res, {
            isFirstTime,
            defaultPassword: isFirstTime ? AuthManager.DEFAULT_PASSWORD : null
        });
    } catch (error) {
        console.error('获取认证状态失败:', error);
        ResponseHelper.error(res, '获取认证状态失败', 500, error);
    }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return ResponseHelper.error(res, '请输入密码', 400);
        }

        const result = await AuthManager.verifyLogin(password);

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
        console.error('登录失败:', error);
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
            const loginResult = await AuthManager.verifyLogin(newPassword);
            ResponseHelper.success(res, {
                message: '密码设置成功',
                token: loginResult.token,
                sessionId: loginResult.sessionId
            });
        } else {
            ResponseHelper.success(res, { message: '密码修改成功，请重新登录' });
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
        ResponseHelper.error(res, '登出失败', 500, error);
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

// 重置密码到默认状态（危险操作，仅用于开发/测试）
app.post('/api/auth/reset', async (req, res) => {
    try {
        // 这个API应该有额外的安全验证，这里简化处理
        await AuthManager.resetToDefault();
        ResponseHelper.success(res, { message: '密码已重置到默认状态' });
    } catch (error) {
        console.error('重置密码失败:', error);
        ResponseHelper.error(res, '重置密码失败', 500, error);
    }
});

// 歌曲管理 API
// 获取所有歌曲
app.get('/api/songs', async (req, res) => {
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

// 获取单个歌曲
app.get('/api/songs/:id', async (req, res) => {
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
app.post('/api/songs', authenticateToken, validateSong, async (req, res) => {
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
// 获取个人资料
app.get('/api/profile', async (req, res) => {
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

// 获取设置信息
app.get('/api/settings', async (req, res) => {
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
// 获取所有风格
app.get('/api/genres', async (req, res) => {
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

// 获取风格名称映射
app.post('/api/genre-names', async (req, res) => {
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

// 调试API：获取风格映射信息
app.get('/api/debug/genres', async (req, res) => {
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

// 数据统计 API
app.get('/api/stats', async (req, res) => {
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
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return ResponseHelper.error(res, '没有收到文件');
        }

        // 返回文件的相对路径
        const relativePath = path.join('images', req.query.type || 'avatars', req.file.filename)
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
        console.error('文件上传失败:', error);
        ResponseHelper.error(res, '文件上传失败', 500, error);
    }
});

// 获取图片列表接口
app.get('/api/images', async (req, res) => {
    try {
        const type = req.query.type || 'avatars';  // 默认为头像
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

// 404 处理
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        ResponseHelper.notFound(res, 'API接口');
    } else {
        next();
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer错误处理
        if (err.code === 'LIMIT_FILE_SIZE') {
            return ResponseHelper.error(res, '文件大小不能超过5MB');
        }
        return ResponseHelper.error(res, '文件上传错误: ' + err.message);
    }

    // 其他错误
    console.error('服务器错误:', err);
    ResponseHelper.error(res, '服务器内部错误', 500, err);
});

// 初始化数据文件
async function initializeData() {
    try {
        // 确保数据文件存在
        await DataManager.getSongs();
        await DataManager.getProfile();

        console.log('✅ 数据文件初始化完成');
    } catch (error) {
        console.error('❌ 数据文件初始化失败:', error);
    }
}

// 启动服务器
async function startServer() {
    try {
        await initializeData();

        // 启动时更新data.js文件
        await updateDataJsFile();

        app.listen(PORT, () => {
            console.log(`
    ================================================
    🚀 虚拟主播歌单系统 - API服务器已启动！

    📍 服务器地址: http://localhost:${PORT}

    🎵 前端页面:
    - 主页 (观众访问): http://localhost:${PORT}
    - 后台 (主播管理): http://localhost:${PORT}/admin.html
    - 登录页面: http://localhost:${PORT}/login.html

    🔌 API接口:
    - 歌曲管理: http://localhost:${PORT}/api/songs
    - 个人资料: http://localhost:${PORT}/api/profile
    - 数据统计: http://localhost:${PORT}/api/stats
    - 文件上传: http://localhost:${PORT}/api/upload

    📁 数据存储: ./data/ 目录

    ================================================
            `);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();