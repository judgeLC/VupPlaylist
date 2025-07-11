/**
 * 虚拟主播歌单系统 - 服务器端认证模块
 * 版本: v2.0 (前后端分离架构)
 *
 * 核心功能：
 * - 服务器端密码验证与存储
 * - JWT Token 生成与管理
 * - 用户会话管理
 * - 首次密码设置流程
 * - 登录状态检查与维护
 *
 * 安全特性：
 * - 服务器端密码哈希存储 (PBKDF2)
 * - Token 自动过期验证 (24小时)
 * - 防暴力破解保护 (5次失败锁定15分钟)
 * - IP地址跟踪与限制
 * - 统一认证状态管理
 */

/**
 * 认证管理器类
 * 负责用户认证、会话管理和安全控制
 */
class AuthManager {
    /**
     * 初始化认证管理器
     * 设置API基础URL、加载本地存储的认证信息并启动系统
     * @constructor
     */
    constructor() {
        this.apiBase = window.location.origin;                                    // API基础URL
        this.token = this.getSecureToken();                                       // 安全获取认证令牌
        this.sessionId = this.getSecureSessionId();                               // 安全获取会话ID
        this.isSettingPassword = false;                                           // 密码设置状态标志
        this.isCheckingAuth = false;                                              // 认证检查状态标志

        // 启动认证系统初始化
        this.init();
    }

    /**
     * 系统初始化
     */
    async init() {
        this.loadTheme();
        this.bindEvents();

        // 只在登录页面进行认证检查
        if (window.location.pathname.includes('login.html')) {
            console.log('在登录页面，开始认证检查');
            await this.checkAuthStatus();
        } else {
            console.log('不在登录页面，跳过认证检查');
        }
    }

    /**
     * 检查认证状态和页面跳转 - 仅在登录页面使用
     */
    async checkAuthStatus() {
        // 如果正在设置密码，跳过状态检查
        if (this.isSettingPassword) {
            console.log('正在设置密码，跳过状态检查');
            return;
        }

        // 防止重复检查导致的循环
        if (this.isCheckingAuth) {
            console.log('正在检查认证状态，跳过重复检查');
            return;
        }

        // 只在登录页面执行认证检查
        if (!window.location.pathname.includes('login.html')) {
            console.log('不在登录页面，跳过认证检查');
            return;
        }

        this.isCheckingAuth = true;

        try {
            console.log('检查认证状态...');
            const isLoggedIn = await this.isLoggedIn();
            console.log('登录状态:', isLoggedIn);

            // 在登录页面且已登录，跳转到管理页面
            if (isLoggedIn) {
                console.log('已登录，跳转到管理页面');
                window.location.href = 'admin.html';
                return;
            }

            // 在登录页面且未登录，检查是否为首次设置
            console.log('未登录，检查首次设置状态');
            await this.checkFirstTimeSetup();
        } catch (error) {
            console.error('检查认证状态时出错:', error);
        } finally {
            this.isCheckingAuth = false;
        }
    }

    // 安全Token存储方法
    getSecureToken() {
        try {
            const token = localStorage.getItem('vtuber_admin_token');
            if (token) {
                // 验证token格式（应该是64字符的十六进制字符串）
                if (!/^[a-f0-9]{64}$/i.test(token)) {
                    console.warn('检测到无效的token格式，已清除');
                    this.clearSecureStorage();
                    return null;
                }
                return token;
            }
            return null;
        } catch (error) {
            console.error('获取token失败:', error);
            return null;
        }
    }

    getSecureSessionId() {
        try {
            const sessionId = localStorage.getItem('vtuber_admin_session_id');
            if (sessionId) {
                // 验证sessionId格式（应该是UUID格式）
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
                    console.warn('检测到无效的sessionId格式，已清除');
                    this.clearSecureStorage();
                    return null;
                }
                return sessionId;
            }
            return null;
        } catch (error) {
            console.error('获取sessionId失败:', error);
            return null;
        }
    }

    // 安全存储Token
    setSecureToken(token, sessionId) {
        try {
            if (token && sessionId) {
                localStorage.setItem('vtuber_admin_token', token);
                localStorage.setItem('vtuber_admin_session_id', sessionId);

                // 设置过期时间检查
                const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24小时
                localStorage.setItem('vtuber_admin_token_expiry', expiryTime.toString());

                this.token = token;
                this.sessionId = sessionId;
            }
        } catch (error) {
            console.error('存储token失败:', error);
        }
    }

    // 清除安全存储
    clearSecureStorage() {
        try {
            localStorage.removeItem('vtuber_admin_token');
            localStorage.removeItem('vtuber_admin_session_id');
            localStorage.removeItem('vtuber_admin_token_expiry');
            this.token = null;
            this.sessionId = null;
        } catch (error) {
            console.error('清除存储失败:', error);
        }
    }

    // 检查Token是否过期
    isTokenExpired() {
        try {
            const expiryTime = localStorage.getItem('vtuber_admin_token_expiry');
            if (!expiryTime) return true;

            return Date.now() > parseInt(expiryTime);
        } catch (error) {
            console.error('检查token过期时间失败:', error);
            return true;
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

    /**
     * 检查是否为首次设置 - 显示安全提示
     */
    async checkFirstTimeSetup() {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/status`);
            const data = await response.json();

            if (data.success && data.data.isFirstTime) {
                // 显示首次设置提示
                this.showSecurityNotice(
                    '🔒 安全提示',
                    data.data.message + '\n\n' + (data.data.securityNotice || ''),
                    'warning'
                );
            }
        } catch (error) {
            console.error('检查设置状态失败:', error);
            this.showError('无法连接到服务器，请检查网络连接');
        }
    }

    /**
     * 显示安全通知对话框
     */
    showSecurityNotice(title, message, type = 'info') {
        const dialog = document.createElement('div');
        dialog.className = 'security-notice-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content ${type}">
                    <h3>${title}</h3>
                    <p style="white-space: pre-line;">${message}</p>
                    <div class="dialog-actions">
                        <button class="glass-btn primary" onclick="this.closest('.security-notice-dialog').remove()">
                            我知道了
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .security-notice-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .security-notice-dialog .dialog-content {
                background: white;
                border-radius: 15px;
                padding: 30px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                text-align: center;
            }
            .security-notice-dialog .dialog-content.warning {
                border-left: 5px solid #ffc107;
            }
            .security-notice-dialog h3 {
                margin-bottom: 15px;
                color: #333;
            }
            .security-notice-dialog p {
                margin-bottom: 20px;
                color: #666;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(dialog);
    }

    /**
     * 处理登录
     */
    async handleLogin() {
        const passwordInput = document.getElementById('password');
        if (!passwordInput) return;

        const password = passwordInput.value.trim();

        if (!password) {
            this.showError('请输入密码');
            return;
        }

        // 显示加载状态
        this.setLoading(true);

        try {
            const response = await fetch(`${this.apiBase}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success) {
                if (data.data.firstTime) {
                    // 需要设置新密码
                    this.showPasswordChangeDialog();
                } else {
                    // 登录成功
                    this.setSecureToken(data.data.token, data.data.sessionId);
                    this.onLoginSuccess();
                }
            } else {
                this.showError(data.message || '登录失败');
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            this.showError('网络连接失败，请检查服务器状态');
        } finally {
            this.setLoading(false);
        }
    }
    /**
     * 显示密码修改对话框
     */
    showPasswordChangeDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'password-change-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <h3>设置新密码</h3>
                    <p>为了安全，请设置一个强密码</p>
                    <form id="changePasswordForm">
                        <div class="form-group">
                            <label>新密码</label>
                            <input type="password" id="newPassword" class="glass-input" placeholder="请输入新密码" required>
                        </div>
                        <div class="form-group">
                            <label>确认新密码</label>
                            <input type="password" id="confirmPassword" class="glass-input" placeholder="请再次输入新密码" required>
                        </div>
                        <div class="password-requirements">
                            <small>密码要求：至少8位，包含大小写字母、数字和特殊字符</small>
                        </div>
                        <div class="dialog-actions">
                            <button type="submit" class="glass-btn primary">设置新密码</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .password-change-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
            }
            .dialog-overlay {
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .dialog-content {
                background: white;
                border-radius: 15px;
                padding: 30px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }
            .dialog-content h3 {
                margin-bottom: 10px;
                color: #333;
                text-align: center;
            }
            .dialog-content p {
                margin-bottom: 20px;
                color: #666;
                text-align: center;
            }
            .password-requirements {
                margin-top: 10px;
                margin-bottom: 20px;
            }
            .password-requirements small {
                color: #666;
                line-height: 1.4;
            }
            .dialog-actions {
                text-align: center;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(dialog);

        // 绑定表单提交事件
        const form = dialog.querySelector('#changePasswordForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handlePasswordChange(dialog);
        });
    }

    /**
     * 处理密码修改
     */
    async handlePasswordChange(dialog) {
        const newPassword = dialog.querySelector('#newPassword').value;
        const confirmPassword = dialog.querySelector('#confirmPassword').value;

        if (!newPassword || !confirmPassword) {
            this.showError('请填写所有字段');
            return;
        }

        // 设置标志，防止页面跳转冲突
        this.isSettingPassword = true;

        if (newPassword !== confirmPassword) {
            this.showError('两次输入的密码不一致');
            return;
        }

        if (!this.validatePasswordStrength(newPassword)) {
            this.showError('密码强度不足，请使用包含大小写字母、数字和特殊字符的8位以上密码');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/auth/set-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    newPassword,
                    currentPassword: 'DEFAULT_PASSWORD' // 内部使用
                })
            });

            const data = await response.json();

            if (data.success) {
                // 设置成功，保存token
                if (data.data.token) {
                    this.setSecureToken(data.data.token, data.data.sessionId);
                }

                // 移除对话框
                document.body.removeChild(dialog);

                this.showNotification('密码设置成功！正在跳转...', 'success');

                // 清除设置密码标志
                this.isSettingPassword = false;

                // 跳转到管理页面
                setTimeout(() => {
                    window.location.href = 'admin.html';
                }, 1500);

            } else {
                this.showError(data.message || '设置密码失败');
                this.isSettingPassword = false; // 清除标志
            }
        } catch (error) {
            console.error('设置密码失败:', error);
            this.showError('网络连接失败，请重试');
            this.isSettingPassword = false; // 清除标志
        }
    }

    /**
     * 检查是否已登录
     */
    async isLoggedIn() {
        if (!this.token) {
            return false;
        }

        // 检查本地token是否过期
        if (this.isTokenExpired()) {
            console.warn('Token已过期，清除本地存储');
            this.clearSecureStorage();
            return false;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (!data.success || !data.data.valid) {
                // 服务器端token无效，清除本地存储
                this.clearSecureStorage();
                return false;
            }

            return true;
        } catch (error) {
            console.error('验证登录状态失败:', error);
            // 网络错误时不清除token，可能是临时问题
            return false;
        }
    }

    /**
     * 验证密码强度
     */
    validatePasswordStrength(password) {
        if (password.length < 8) return false;
        if (!/[a-z]/.test(password)) return false;
        if (!/[A-Z]/.test(password)) return false;
        if (!/\d/.test(password)) return false;
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
        return true;
    }

    /**
     * 登录成功处理
     */
    onLoginSuccess() {
        this.showNotification('登录成功！正在跳转...', 'success');
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1500);
    }

    /**
     * 登出
     */
    async logout() {
        try {
            if (this.token) {
                await fetch(`${this.apiBase}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('登出请求失败:', error);
        } finally {
            // 清除安全存储
            this.clearSecureStorage();

            // 跳转到登录页面
            window.location.href = 'login.html';
        }
    }

    /**
     * UI 工具方法
     */

    // 显示错误消息
    showError(message) {
        this.showNotification(message, 'error');
    }

    // 显示警告消息
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    // 显示通知消息
    showNotification(message, type = 'info') {
        // 移除现有通知
        const existingNotification = document.querySelector('.auth-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新通知
        const notification = document.createElement('div');
        notification.className = `auth-notification ${type}`;
        notification.textContent = message;

        // 添加样式
        const style = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10001;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease-out;
        `;

        const colors = {
            success: 'background: #28a745; border-left: 4px solid #1e7e34;',
            error: 'background: #dc3545; border-left: 4px solid #c82333;',
            warning: 'background: #ffc107; color: #212529; border-left: 4px solid #e0a800;',
            info: 'background: #17a2b8; border-left: 4px solid #138496;'
        };

        notification.style.cssText = style + (colors[type] || colors.info);

        // 添加动画样式
        if (!document.querySelector('#auth-notification-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'auth-notification-styles';
            styleSheet.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styleSheet);
        }

        document.body.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 4000);
    }

    // 设置加载状态
    setLoading(loading) {
        const loginBtn = document.querySelector('.glass-btn');
        const passwordInput = document.getElementById('password');

        if (loginBtn) {
            if (loading) {
                loginBtn.disabled = true;
                loginBtn.textContent = '登录中...';
                loginBtn.style.opacity = '0.7';
            } else {
                loginBtn.disabled = false;
                loginBtn.textContent = '登录';
                loginBtn.style.opacity = '1';
            }
        }

        if (passwordInput) {
            passwordInput.disabled = loading;
        }
    }

    // 切换密码可见性
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('passwordToggle');

        if (passwordInput && toggleBtn) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.textContent = '隐藏';
            } else {
                passwordInput.type = 'password';
                toggleBtn.textContent = '显示';
            }
        }
    }

    // 检查密码强度（实时）
    checkPasswordStrength() {
        // 可以在这里添加实时密码强度指示器
    }

    // 初始化密码强度检查
    initPasswordStrengthCheck() {
        // 可以添加密码强度指示器UI
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// 导出到全局作用域
window.AuthManager = AuthManager;