/**
 * 虚拟主播歌单系统 - 安全认证模块
 * 
 * 主要功能：
 * - 密码验证和管理
 * - 会话管理
 * - 防爆破保护
 * - 安全日志记录
 * 
 * 安全特性：
 * - SHA-256 密码哈希
 * - 随机盐值
 * - 恒定时间比较
 * - 会话超时控制
 */

class AuthManager {
    /**
     * 初始化认证管理器
     * @constructor
     */
    constructor() {
        // 安全配置参数
        this.maxAttempts = 5;                    // 最大尝试次数
        this.lockoutDuration = 15 * 60 * 1000;   // 锁定时间：15分钟
        this.sessionDuration = 24 * 60 * 60 * 1000; // 会话持续时间：24小时
        this.sessionTimeout = 2 * 60 * 60 * 1000;   // 无操作超时：2小时
        
        this.init();
    }

    /**
     * 系统初始化
     * 加载主题、绑定事件、检查锁定状态
     */
    init() {
        this.loadTheme();
        this.bindEvents();
        this.checkLockoutStatus();
        this.initPasswordStrengthCheck();

        // 只在登录页面检查登录状态并跳转
        if (window.location.pathname.includes('login.html') && this.isLoggedIn()) {
            window.location.href = 'admin.html';
            return;
        }

        // 在管理页面检查是否需要登录
        if (window.location.pathname.includes('admin.html') && !this.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
    }

    // 加载主题
    loadTheme() {
        const savedTheme = localStorage.getItem('vtuber_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // 绑定事件
    bindEvents() {
        const loginForm = document.getElementById('loginForm');
        const passwordToggle = document.getElementById('passwordToggle');
        const passwordInput = document.getElementById('password');

        // 只有在登录页面才绑定登录相关事件
        if (loginForm) {
            // 登录表单提交
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (passwordToggle) {
            // 密码显示/隐藏切换
            passwordToggle.addEventListener('click', () => {
                this.togglePasswordVisibility();
            });
        }

        if (passwordInput) {
            // 实时密码强度检查
            passwordInput.addEventListener('input', () => {
                this.checkPasswordStrength();
            });

            // 防止复制粘贴（增强安全性）
            passwordInput.addEventListener('paste', (e) => {
                // 允许粘贴，但记录尝试
                console.warn('Password paste detected');
            });
        }

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            // 防止F12开发者工具（基本防护）
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
                this.showWarning('开发者工具已禁用');
            }
        });

        // 防止右键菜单
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // 处理登录
    async handleLogin() {
        const passwordInput = document.getElementById('password');
        if (!passwordInput) return;

        const password = passwordInput.value.trim();

        if (!password) {
            this.showError('请输入密码');
            return;
        }

        // 检查是否被锁定
        if (this.isLockedOut()) {
            this.showLockoutMessage();
            return;
        }

        // 显示加载状态
        this.setLoading(true);

        try {
            // 模拟网络延迟（防止时序攻击）
            await this.delay(300 + Math.random() * 200);

            if (await this.verifyPassword(password)) {
                // 登录成功
                this.onLoginSuccess();
            } else {
                // 登录失败
                this.onLoginFailure();
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('登录过程中发生错误，请重试');
        } finally {
            this.setLoading(false);
            passwordInput.value = '';
        }
    }

    /**
     * 密码验证
     * @param {string} password - 待验证的密码
     * @returns {Promise<boolean>} 验证结果
     */
    async verifyPassword(password) {
        const storedHash = this.getStoredPasswordHash();
        
        if (!storedHash) {
            // 首次设置密码
            if (await this.isFirstTimeSetup()) {
                return await this.setupInitialPassword(password);
            }
            return false;
        }

        // 验证密码
        const inputHash = await this.hashPassword(password);
        return this.compareHashes(storedHash, inputHash);
    }

    // 检查是否是首次设置
    async isFirstTimeSetup() {
        return !localStorage.getItem('vtuber_admin_setup');
    }

    // 设置初始密码
    async setupInitialPassword(password) {
        if (!this.validatePasswordStrength(password)) {
            this.showError('密码强度不足，请使用包含大小写字母、数字和特殊字符的8位以上密码');
            return false;
        }

        const passwordHash = await this.hashPassword(password);
        localStorage.setItem('vtuber_admin_password', passwordHash);
        localStorage.setItem('vtuber_admin_setup', 'completed');
        
        this.showNotification('初始密码设置成功！正在跳转...', 'success');
        return true;
    }

    /**
     * 密码哈希处理
     * @param {string} password - 原始密码
     * @returns {Promise<string>} 哈希后的密码
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + this.getSalt());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 获取盐值（用于增强安全性）
    getSalt() {
        let salt = localStorage.getItem('vtuber_admin_salt');
        if (!salt) {
            salt = this.generateSalt();
            localStorage.setItem('vtuber_admin_salt', salt);
        }
        return salt;
    }

    // 生成随机盐值
    generateSalt() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // 获取存储的密码哈希
    getStoredPasswordHash() {
        return localStorage.getItem('vtuber_admin_password');
    }

    // 比较哈希值
    compareHashes(hash1, hash2) {
        if (hash1.length !== hash2.length) {
            return false;
        }
        
        // 使用恒定时间比较防止时序攻击
        let result = 0;
        for (let i = 0; i < hash1.length; i++) {
            result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
        }
        return result === 0;
    }

    // 验证密码强度
    validatePasswordStrength(password) {
        if (password.length < 8) return false;
        
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password);
        
        return hasUpper && hasLower && hasNumber && hasSpecial;
    }

    // 检查密码强度（实时）
    checkPasswordStrength() {
        // 可以在这里添加实时密码强度指示器
    }

    // 初始化密码强度检查
    initPasswordStrengthCheck() {
        // 可以添加密码强度指示器UI
    }

    // 登录成功处理
    onLoginSuccess() {
        // 清除失败记录
        this.clearFailedAttempts();
        
        // 创建会话
        this.createSession();
        
        // 记录登录日志
        this.logLoginAttempt(true);
        
        // 显示成功消息并跳转
        this.showNotification('登录成功！正在跳转到管理界面...', 'success');
        
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1500);
    }

    // 登录失败处理
    onLoginFailure() {
        // 记录失败尝试
        this.recordFailedAttempt();
        
        // 记录登录日志
        this.logLoginAttempt(false);
        
        const attempts = this.getFailedAttempts();
        const remaining = this.maxAttempts - attempts.count;

        if (remaining <= 0) {
            // 触发锁定
            this.lockAccount();
            this.showLockoutMessage();
        } else {
            // 显示剩余尝试次数
            this.showError(`密码错误，还有 ${remaining} 次尝试机会`);
            
            if (remaining <= 2) {
                this.showWarning(`注意：连续失败将锁定账户 ${this.lockoutDuration / 60000} 分钟`);
            }
        }
    }

    // 记录失败尝试
    recordFailedAttempt() {
        const attempts = this.getFailedAttempts();
        attempts.count++;
        attempts.lastAttempt = Date.now();
        localStorage.setItem('vtuber_admin_attempts', JSON.stringify(attempts));
    }

    // 获取失败尝试记录
    getFailedAttempts() {
        const stored = localStorage.getItem('vtuber_admin_attempts');
        if (stored) {
            return JSON.parse(stored);
        }
        return { count: 0, lastAttempt: 0 };
    }

    // 清除失败记录
    clearFailedAttempts() {
        localStorage.removeItem('vtuber_admin_attempts');
        localStorage.removeItem('vtuber_admin_lockout');
    }

    // 锁定账户
    lockAccount() {
        const lockout = {
            lockedAt: Date.now(),
            unlockAt: Date.now() + this.lockoutDuration
        };
        localStorage.setItem('vtuber_admin_lockout', JSON.stringify(lockout));
    }

    // 检查是否被锁定
    isLockedOut() {
        const lockout = this.getLockoutInfo();
        if (!lockout) return false;
        
        if (Date.now() >= lockout.unlockAt) {
            // 锁定期已过，清除锁定
            this.clearLockout();
            return false;
        }
        
        return true;
    }

    // 获取锁定信息
    getLockoutInfo() {
        const stored = localStorage.getItem('vtuber_admin_lockout');
        return stored ? JSON.parse(stored) : null;
    }

    // 清除锁定
    clearLockout() {
        localStorage.removeItem('vtuber_admin_lockout');
        this.clearFailedAttempts();
    }

    // 检查锁定状态
    checkLockoutStatus() {
        if (this.isLockedOut()) {
            this.showLockoutMessage();
            this.startLockoutTimer();
        }
    }

    // 显示锁定消息
    showLockoutMessage() {
        const lockout = this.getLockoutInfo();
        if (!lockout) return;

        const remaining = Math.ceil((lockout.unlockAt - Date.now()) / 1000);
        this.showWarning(`账户已锁定，剩余时间：${this.formatTime(remaining)}`);
        
        // 禁用登录按钮
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.disabled = true;
        }
        
        this.startLockoutTimer();
    }

    // 开始锁定倒计时
    startLockoutTimer() {
        const timerElement = document.getElementById('lockoutTimer');
        const timerValue = document.getElementById('timerValue');

        if (!timerElement || !timerValue) return;

        timerElement.style.display = 'block';

        const updateTimer = () => {
            const lockout = this.getLockoutInfo();
            if (!lockout) {
                timerElement.style.display = 'none';
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) {
                    loginBtn.disabled = false;
                }
                return;
            }

            const remaining = Math.ceil((lockout.unlockAt - Date.now()) / 1000);
            
            if (remaining <= 0) {
                this.clearLockout();
                timerElement.style.display = 'none';
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) {
                    loginBtn.disabled = false;
                }
                this.hideMessages();
                return;
            }

            timerValue.textContent = remaining;
            setTimeout(updateTimer, 1000);
        };

        updateTimer();
    }

    // 格式化时间
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}分${secs}秒`;
    }

    // 创建会话
    createSession() {
        const session = {
            token: this.generateSessionToken(),
            createdAt: Date.now(),
            expiresAt: Date.now() + this.sessionDuration,
            lastActivity: Date.now()
        };
        
        localStorage.setItem('vtuber_admin_session', JSON.stringify(session));
        
        // 定期更新活动时间
        setInterval(() => {
            this.updateSessionActivity();
        }, 60000); // 每分钟更新一次
    }

    // 生成会话令牌
    generateSessionToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // 更新会话活动时间
    updateSessionActivity() {
        const session = this.getSession();
        if (session) {
            session.lastActivity = Date.now();
            localStorage.setItem('vtuber_admin_session', JSON.stringify(session));
        }
    }

    // 获取会话信息
    getSession() {
        const stored = localStorage.getItem('vtuber_admin_session');
        return stored ? JSON.parse(stored) : null;
    }

    // 检查是否已登录
    isLoggedIn() {
        const session = this.getSession();
        if (!session) return false;

        const now = Date.now();
        
        // 检查会话是否过期
        if (now >= session.expiresAt) {
            this.logout();
            return false;
        }

        // 检查是否超时（无操作）
        if (now - session.lastActivity >= this.sessionTimeout) {
            this.logout();
            return false;
        }

        return true;
    }

    // 登出
    logout() {
        localStorage.removeItem('vtuber_admin_session');
        window.location.href = 'login.html';
    }

    // 记录登录日志
    logLoginAttempt(success) {
        const logs = this.getLoginLogs();
        const logEntry = {
            timestamp: Date.now(),
            success: success,
            ip: 'unknown', // 前端无法获取真实IP
            userAgent: navigator.userAgent
        };
        
        logs.push(logEntry);
        
        // 只保留最近50条记录
        if (logs.length > 50) {
            logs.splice(0, logs.length - 50);
        }
        
        localStorage.setItem('vtuber_admin_logs', JSON.stringify(logs));
    }

    // 获取登录日志
    getLoginLogs() {
        const stored = localStorage.getItem('vtuber_admin_logs');
        return stored ? JSON.parse(stored) : [];
    }

    // 切换密码显示/隐藏
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const passwordToggle = document.getElementById('passwordToggle');

        if (!passwordInput || !passwordToggle) return;

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            passwordToggle.textContent = '隐藏';
        } else {
            passwordInput.type = 'password';
            passwordToggle.textContent = '显示';
        }
    }

    // 设置加载状态
    setLoading(loading) {
        const loginBtn = document.getElementById('loginBtn');
        if (!loginBtn) return;

        const btnText = loginBtn.querySelector('span');
        if (!btnText) return;

        if (loading) {
            loginBtn.disabled = true;
            btnText.textContent = '验证中...';
        } else {
            loginBtn.disabled = false;
            btnText.textContent = '登录管理后台';
        }
    }

    // 显示错误消息
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (!errorElement) return;

        errorElement.textContent = message;
        errorElement.classList.add('show');

        setTimeout(() => {
            errorElement.classList.remove('show');
        }, 5000);
    }

    // 显示警告消息
    showWarning(message) {
        const warningElement = document.getElementById('warningMessage');
        if (!warningElement) return;

        warningElement.textContent = message;
        warningElement.classList.add('show');

        setTimeout(() => {
            warningElement.classList.remove('show');
        }, 8000);
    }

    // 隐藏所有消息
    hideMessages() {
        const errorElement = document.getElementById('errorMessage');
        const warningElement = document.getElementById('warningMessage');

        if (errorElement) {
            errorElement.classList.remove('show');
        }
        if (warningElement) {
            warningElement.classList.remove('show');
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 16px 20px;
            color: var(--text-primary);
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 安全检查（基础）
    performSecurityCheck() {
        // 检查是否在iframe中运行
        if (window.self !== window.top) {
            this.showWarning('检测到异常运行环境');
            return false;
        }

        // 检查本地存储是否可用
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
        } catch (e) {
            this.showError('本地存储不可用，请检查浏览器设置');
            return false;
        }

        return true;
    }

    // 清空所有登录相关的数据
    clearLoginData() {
        localStorage.removeItem('vtuber_admin_password');
        localStorage.removeItem('vtuber_admin_salt');
        localStorage.removeItem('vtuber_admin_setup');
        localStorage.removeItem('vtuber_admin_lockout');
        localStorage.removeItem('vtuber_admin_session');
        localStorage.removeItem('vtuber_admin_attempts');
        localStorage.removeItem('vtuber_admin_logs');
    }

    // 重置密码到初始状态
    resetPassword() {
        this.clearLoginData();
        this.showNotification('密码已重置到初始状态，请刷新页面重新设置密码', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// 导出到全局作用域
window.AuthManager = AuthManager; 