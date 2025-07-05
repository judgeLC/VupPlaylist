/**
 * 虚拟主播歌单系统 - 后台管理脚本
 * 主要功能：
 * - 歌单管理（CRUD操作）
 * - 个人资料管理
 * - 系统设置
 * - 安全认证
 * - 数据备份与恢复
 */

class AdminManager {
    /**
     * 初始化管理系统
     * @constructor
     */
    constructor() {
        // 初始化状态
        this.songs = [];
        this.filteredSongs = [];
        this.currentEditingSong = null;
        this.currentSection = 'songs';
        this.profileLoaded = false;
        this.authCheckInterval = null;
        this.searchTerm = '';
        this.genreFilter = 'all';
        this.remarkFilter = 'all';
        
        // 验证登录状态
        if (!this.checkAuth()) {
            return;
        }
        
        this.init();
    }

    // 安全地获取DOM元素
    safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    }

    // 安全地设置元素内容
    safeSetContent(id, content) {
        const element = this.safeGetElement(id);
        if (element) {
            element.textContent = content;
            return true;
        }
        return false;
    }

    // 安全地获取元素值
    safeGetValue(id) {
        const element = this.safeGetElement(id);
        return element ? element.value : '';
    }

    // 安全地设置元素值
    safeSetValue(id, value) {
        const element = this.safeGetElement(id);
        if (element) {
            element.value = value;
            return true;
        }
        return false;
    }

    /**
     * 系统初始化
     * 加载数据和绑定事件
     */
    init() {
        // 设置API认证令牌
        this.setupApiAuth();

        this.initCustomGenres();
        this.loadData();
        this.bindEvents();
        this.initSections();
        this.loadTheme();
        this.loadProfile();
        this.profileLoaded = true;
        this.updateStats();
        this.updateGenreSelects();
        this.updateGenreAndRemarkSelects();
        this.startAuthCheck();
        this.setupMessageListener();
    }

    /**
     * 设置API认证令牌
     */
    setupApiAuth() {
        const session = this.getSession();
        if (session && session.token) {
            localStorage.setItem('auth_token', session.token);
            console.log('API认证令牌已设置');
        } else {
            console.warn('未找到有效的会话令牌');
        }
    }

    /**
     * 设置消息监听器，监听来自前端页面的消息
     */
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'themeUpdatedFromFrontend') {
                console.log('收到前端主题更新消息:', event.data.theme);
                // 更新后台页面的主题
                this.applyThemeFromMessage(event.data.theme);
            }
        });
    }

    /**
     * 从消息应用主题（避免循环通知）
     */
    applyThemeFromMessage(theme) {
        localStorage.setItem('vtuber_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '☀️' : '🌙';
            }
        }

        // 同步主题设置选择框
        const defaultTheme = document.getElementById('defaultTheme');
        if (defaultTheme) {
            defaultTheme.value = theme;
        }

        console.log('后台主题已更新为:', theme);
    }

    /**
     * 检查登录状态
     * @returns {boolean} 是否已登录
     */
    checkAuth() {
        const session = this.getSession();
        if (!session) {
            this.redirectToLogin();
            return false;
        }

        const now = Date.now();
        
        // 检查会话是否过期
        if (now >= session.expiresAt) {
            this.logout('会话已过期，请重新登录');
            return false;
        }

        // 检查是否超时
        const sessionTimeout = 2 * 60 * 60 * 1000; // 2小时
        if (now - session.lastActivity >= sessionTimeout) {
            this.logout('长时间无操作，已自动登出');
            return false;
        }

        this.updateSessionActivity();
        return true;
    }

    // 获取会话信息
    getSession() {
        const stored = localStorage.getItem('vtuber_admin_session');
        return stored ? JSON.parse(stored) : null;
    }

    // 更新会话活动时间
    updateSessionActivity() {
        const session = this.getSession();
        if (session) {
            session.lastActivity = Date.now();
            localStorage.setItem('vtuber_admin_session', JSON.stringify(session));
        }
    }

    // 开始定期检查登录状态
    startAuthCheck() {
        // 每2分钟检查一次登录状态
        this.authCheckInterval = setInterval(() => {
            if (!this.checkAuth()) {
                if (this.authCheckInterval) {
                    clearInterval(this.authCheckInterval);
                }
            }
        }, 2 * 60 * 1000);

        // 监听用户活动，更新会话
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, () => {
                this.updateSessionActivity();
            }, { passive: true });
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // 页面重新可见时检查登录状态
                if (!this.checkAuth()) {
                    if (this.authCheckInterval) {
                        clearInterval(this.authCheckInterval);
                    }
                }
            }
        });
    }

    // 登出
    logout(message = '已安全登出') {
        // 清除会话
        localStorage.removeItem('vtuber_admin_session');
        
        // 清除检查定时器
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
        
        // 显示消息并跳转
        this.showNotification(message, 'info');
        setTimeout(() => {
            this.redirectToLogin();
        }, 1500);
    }

    // 跳转到登录页面
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    // 确认登出
    confirmLogout() {
        this.showConfirmModal(
            '确定要安全登出吗？您需要重新输入密码才能再次访问管理界面。',
            () => {
                this.logout('正在安全登出...');
            }
        );
    }

    // 加载数据
    loadData() {
        const savedSongs = localStorage.getItem('vtuber_songs');
        if (savedSongs) {
            try {
                this.songs = JSON.parse(savedSongs);
            } catch (error) {
                console.error('Failed to load songs from localStorage:', error);
                this.songs = [];
            }
        } else if (window.officialData && window.officialData.songs) {
            console.log('Loading songs from data.js');
            this.songs = window.officialData.songs;
            this.saveData(); // 保存到 localStorage 供后续使用
        } else {
            this.songs = [];
        }

        // 确保每个歌曲都有正确的ID
        this.songs = this.songs.map(song => ({
            ...song,
            id: song.id || Date.now()
        }));
        
        this.renderSongs();
        this.populateFilters();
    }

    // 保存数据
    saveData() {
        try {
            // 确保每个歌曲都有正确的属性
            const songsToSave = this.songs.map(song => ({
                id: song.id || Date.now(),
                title: song.title || '',
                artist: song.artist || '',
                genre: song.genre || '',
                note: song.note || '',
                addedDate: song.addedDate || new Date().toISOString()
            }));

            const dataString = JSON.stringify(songsToSave);
            console.log(`尝试保存数据，大小: ${(dataString.length / 1024).toFixed(2)} KB`);

            localStorage.setItem('vtuber_songs', dataString);
            this.updateStats();
            this.populateFilters();

            // 触发主页面数据更新
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'dataUpdated' }, '*');
            }
        } catch (error) {
            console.error('Failed to save songs:', error);

            // 检查是否是存储空间不足
            const isQuotaError = error.name === 'QuotaExceededError' ||
                                error.code === 22 ||
                                error.message.toLowerCase().includes('quota') ||
                                error.message.toLowerCase().includes('storage') ||
                                error.message.toLowerCase().includes('exceed');

            if (isQuotaError) {
                this.handleStorageQuotaExceeded();
            } else {
                // 提供中文错误信息
                let errorMsg = '保存数据失败';
                if (error.message.includes('permission')) {
                    errorMsg = '没有存储权限，请检查浏览器设置';
                } else if (error.message.includes('network')) {
                    errorMsg = '网络错误，请检查连接';
                } else {
                    errorMsg = '保存数据时发生未知错误';
                }
                console.error('保存错误详情:', error);
                this.showNotification(errorMsg, 'error');
            }
        }
    }

    // 处理存储空间不足的情况
    handleStorageQuotaExceeded() {
        const currentSize = this.getLocalStorageSize();
        console.log(`当前 localStorage 使用量: ${(currentSize / 1024).toFixed(2)} KB`);

        this.showNotification(
            `存储空间不足！当前使用 ${(currentSize / 1024).toFixed(2)} KB。请清理数据或导出备份。`,
            'error',
            5000
        );

        // 提供清理选项
        setTimeout(() => {
            if (confirm('存储空间不足，是否自动清理临时数据？')) {
                this.cleanupTempData();
                // 重试保存
                setTimeout(() => this.saveData(), 500);
            }
        }, 1000);
    }

    // 获取 localStorage 使用量
    getLocalStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    }

    // 绑定事件
    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('songSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            // 按下 ESC 键清空搜索
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.handleSearch('');
                }
            });
        }

        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 登出按钮
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.confirmLogout());
        }

        // 导航切换
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.nav-btn').dataset.section;
                if (section) {
                    this.switchSection(section);
                }
            });
        });

        // 歌曲管理
        document.getElementById('addSongBtn').addEventListener('click', () => this.openSongModal());
        document.getElementById('songForm').addEventListener('submit', (e) => this.handleSongSubmit(e));
        document.getElementById('closeSongModal').addEventListener('click', () => this.closeSongModal());
        document.getElementById('cancelSongBtn').addEventListener('click', () => this.closeSongModal());

        // 批量操作功能
        document.getElementById('batchAddBtn').addEventListener('click', () => this.openBatchModal('songs'));
        document.getElementById('closeBatchModal').addEventListener('click', () => this.closeBatchModal());
        document.getElementById('closeBatchModalBtn').addEventListener('click', () => this.closeBatchModal());
        document.getElementById('previewBatchBtn').addEventListener('click', () => this.previewBatchSongs());
        document.getElementById('confirmBatchAddBtn').addEventListener('click', () => this.confirmBatchAdd());

        // 批量选择功能
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e));
        }
        document.getElementById('batchSetArtistBtn').addEventListener('click', () => this.openBatchSetArtistModal());
        document.getElementById('batchSetGenreBtn').addEventListener('click', () => this.openBatchSetGenreModal());
        document.getElementById('batchSetRemarkBtn').addEventListener('click', () => this.openBatchSetRemarkModal());
        document.getElementById('batchDeleteBtn').addEventListener('click', () => this.batchDeleteSongs());
        document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearSelection());

        // 歌单筛选
        document.getElementById('genreFilter').addEventListener('change', (e) => {
            this.genreFilter = e.target.value;
            this.filterSongs();
            this.renderSongs();
        });
        document.getElementById('remarkFilter').addEventListener('change', (e) => {
            this.remarkFilter = e.target.value;
            this.filterSongs();
            this.renderSongs();
        });

        // 批量操作标签切换
        document.querySelectorAll('.batch-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchBatchTab(e.target.closest('.tab-btn').dataset.tab));
        });
        
        // 移除了子标签切换和模板相关的代码

        // 风格管理
        document.getElementById('addNewGenreBtn').addEventListener('click', () => this.addNewGenre());
        document.getElementById('newGenreInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addNewGenre();
        });

        // 备注管理
        document.getElementById('addNewRemarkBtn').addEventListener('click', () => this.addNewRemark());
        document.getElementById('newRemarkInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addNewRemark();
        });

        // 个人资料管理
        document.getElementById('saveProfileBtn').addEventListener('click', () => this.saveProfile());
        document.getElementById('uploadAvatarBtn').addEventListener('click', () => this.triggerFileInput('avatarFileInput'));
        document.getElementById('uploadBackgroundBtn').addEventListener('click', () => this.triggerFileInput('backgroundFileInput'));
        document.getElementById('avatarFileInput').addEventListener('change', (e) => this.handleImageUpload(e, 'avatar'));
        document.getElementById('backgroundFileInput').addEventListener('change', (e) => this.handleImageUpload(e, 'background'));
        document.getElementById('avatarInput').addEventListener('input', (e) => this.previewImage(e.target.value, 'avatar'));
        document.getElementById('backgroundInput').addEventListener('input', (e) => this.previewImage(e.target.value, 'background'));
        
        // 图片选择器事件
        document.getElementById('avatarSelect').addEventListener('change', (e) => this.handleImageSelect(e, 'avatar'));
        document.getElementById('backgroundSelect').addEventListener('change', (e) => this.handleImageSelect(e, 'background'));
        document.getElementById('refreshAvatarBtn').addEventListener('click', () => this.refreshImageList('avatar'));
        document.getElementById('refreshBackgroundBtn').addEventListener('click', () => this.refreshImageList('background'));

        // 确认模态框
        document.getElementById('closeConfirmModal').addEventListener('click', () => this.closeConfirmModal());
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => this.closeConfirmModal());

        // 设置
        document.getElementById('defaultTheme').addEventListener('change', (e) => this.saveThemeSetting(e.target.value));

        // 数据管理
        document.getElementById('exportData').addEventListener('click', () => this.backupDataToFile());
        document.getElementById('syncDataBtn').addEventListener('click', () => this.syncOfficialData());
        document.getElementById('restoreBtn').addEventListener('click', () => this.triggerFileInput('restoreFileInput'));
        document.getElementById('restoreFileInput').addEventListener('change', (e) => this.importData(e));

        // 创建隐藏的导入文件输入
        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.id = 'importDataFile';
        importInput.accept = '.json';
        importInput.style.display = 'none';
        document.body.appendChild(importInput);
        importInput.addEventListener('change', (e) => this.importData(e));

        // 模态框外部点击关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSongModal();
                this.closeConfirmModal();
                this.closeBatchModal();
            }
        });

        // 网站图标设置
        const uploadFaviconBtn = document.getElementById('uploadFaviconBtn');
        const faviconFileInput = document.getElementById('faviconFileInput');
        const faviconInput = document.getElementById('faviconInput');
        const saveFaviconBtn = document.getElementById('saveFaviconBtn');

        if (uploadFaviconBtn) {
            uploadFaviconBtn.addEventListener('click', () => this.triggerFileInput('faviconFileInput'));
        }
        if (faviconFileInput) {
            faviconFileInput.addEventListener('change', (e) => this.handleFaviconUpload(e));
        }
        if (faviconInput) {
            faviconInput.addEventListener('input', (e) => this.previewFavicon(e.target.value));
        }
        if (saveFaviconBtn) {
            saveFaviconBtn.addEventListener('click', () => this.saveFaviconSettings());
        }

        // 备案信息设置
        const saveBeianBtn = document.getElementById('saveBeianBtn');
        if (saveBeianBtn) {
            saveBeianBtn.addEventListener('click', () => this.saveBeianSettings());
        }
    }

    // 初始化页面部分
    initSections() {
        this.switchSection('songs');
    }

    // 切换页面部分
    switchSection(section) {
        this.currentSection = section;
        
        // 更新导航
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // 更新内容区域
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');
        
        // 特定部分的初始化
        if (section === 'profile') {
            // 只在首次加载或者输入框为空时才重新加载
            const avatarInput = document.getElementById('avatarInput');
            const backgroundInput = document.getElementById('backgroundInput');
            if (!this.profileLoaded || (avatarInput.value === '' && backgroundInput.value === '')) {
                this.loadProfile();
                this.profileLoaded = true;
            } else {
                // 即使不重新加载个人资料，也要确保图片列表是最新的
                this.loadImageList('avatar');
                this.loadImageList('background');
            }
        } else if (section === 'settings') {
            this.loadSettings();
        }
    }

    // 主题切换
    async toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // 通过API保存主题设置
        await this.saveThemeSetting(newTheme);

        // 同步主题设置选择框
        const defaultTheme = document.getElementById('defaultTheme');
        if (defaultTheme) {
            defaultTheme.value = newTheme;
        }
    }

    // 加载主题
    async loadTheme() {
        try {
            let result;

            // 检查是否有API客户端可用
            if (typeof apiClient !== 'undefined') {
                // 从API加载主题设置（GET请求不需要认证）
                result = await apiClient.get('/settings');
            } else {
                // 回退到原生fetch
                const response = await fetch('/api/settings');
                if (response.ok) {
                    result = await response.json();
                } else {
                    throw new Error('API请求失败');
                }
            }

            if (result.success && result.data) {
                const serverTheme = result.data.settings.theme || 'light';

                // 使用服务器主题
                localStorage.setItem('vtuber_theme', serverTheme);
                document.documentElement.setAttribute('data-theme', serverTheme);

                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) {
                    const icon = themeToggle.querySelector('.icon');
                    if (icon) {
                        icon.textContent = serverTheme === 'dark' ? '☀️' : '🌙';
                    }
                }

                const defaultTheme = document.getElementById('defaultTheme');
                if (defaultTheme) {
                    defaultTheme.value = serverTheme;
                }

                console.log('从API加载主题:', serverTheme);
            } else {
                // API失败时尝试从data.js加载
                this.loadThemeFromDataJs();
            }
        } catch (error) {
            console.error('从API加载主题失败:', error);
            // API失败时尝试从data.js加载
            this.loadThemeFromDataJs();
        }
    }

    // 从data.js加载主题（备用方案）
    loadThemeFromDataJs() {
        try {
            if (window.officialData && window.officialData.settings && window.officialData.settings.theme) {
                const dataJsTheme = window.officialData.settings.theme;
                const localTheme = localStorage.getItem('vtuber_theme') || 'light';

                if (dataJsTheme !== localTheme) {
                    console.log(`从data.js同步主题: ${localTheme} -> ${dataJsTheme}`);
                    localStorage.setItem('vtuber_theme', dataJsTheme);
                }

                document.documentElement.setAttribute('data-theme', dataJsTheme);

                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) {
                    const icon = themeToggle.querySelector('.icon');
                    if (icon) {
                        icon.textContent = dataJsTheme === 'dark' ? '☀️' : '🌙';
                    }
                }

                const defaultTheme = document.getElementById('defaultTheme');
                if (defaultTheme) {
                    defaultTheme.value = dataJsTheme;
                }

                console.log('从data.js加载主题:', dataJsTheme);
            } else {
                // 最终回退到本地主题
                this.loadThemeFromLocal();
            }
        } catch (error) {
            console.error('从data.js加载主题失败:', error);
            // 最终回退到本地主题
            this.loadThemeFromLocal();
        }
    }

    // 从本地加载主题（回退方法）
    loadThemeFromLocal() {
        const savedTheme = localStorage.getItem('vtuber_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.icon');
            if (icon) {
                icon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
            }
        }

        const defaultTheme = document.getElementById('defaultTheme');
        if (defaultTheme) {
            defaultTheme.value = savedTheme;
        }
    }

    // 处理搜索
    handleSearch(term) {
        this.searchTerm = term.toLowerCase().trim();
        this.filterSongs();
        this.renderSongs();
    }

    // 过滤歌曲
    filterSongs() {
        let songs = this.songs;

        // 搜索过滤
        if (this.searchTerm) {
            songs = songs.filter(song => {
                const searchFields = [
                    song.title,
                    song.artist,
                    song.note,
                    this.getGenreDisplayName(song.genre)
                ].map(field => (field || '').toLowerCase());
    
                return searchFields.some(field => field.includes(this.searchTerm));
            });
        }

        // 风格过滤
        if (this.genreFilter !== 'all') {
            songs = songs.filter(song => song.genre === this.genreFilter);
        }
        
        // 备注过滤
        if (this.remarkFilter !== 'all') {
            if (this.remarkFilter === '[NONE]') {
                songs = songs.filter(song => !song.note || song.note.trim() === '');
            } else {
                songs = songs.filter(song => song.note === this.remarkFilter);
            }
        }

        this.filteredSongs = songs;
    }

    // 渲染歌曲列表
    renderSongs() {
        const container = document.getElementById('songsContent');
        const songsToRender = this.filteredSongs.length > 0 ? this.filteredSongs : this.songs;
        
        if (this.songs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🎵</div>
                    <h3>暂无歌曲</h3>
                    <p>点击上方"添加歌曲"按钮开始管理您的歌单</p>
                </div>
            `;
            return;
        }

        if (this.searchTerm && this.filteredSongs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <h3>未找到匹配的歌曲</h3>
                    <p>尝试使用其他关键词搜索</p>
                </div>
            `;
            return;
        }

        const songsHTML = songsToRender.map(song => {
            // 生成点歌指令
            const commandSettings = this.getCommandSettings();
            const prefix = commandSettings.commandPrefix || '/点歌';
            const suffix = commandSettings.commandSuffix || '';
            let command = `${prefix} ${song.title}`;
            if (suffix && song.artist) {
                command += ` ${suffix} ${song.artist}`;
            }

            // 处理风格显示
            const genreDisplay = this.getGenreDisplayName(song.genre);

            return `
                <div class="song-row" data-id="${song.id}">
                    <div class="song-cell select-cell">
                        <label class="checkbox-container">
                            <input type="checkbox" class="song-checkbox" data-id="${song.id}">
                            <span class="checkmark"></span>
                        </label>
                    </div>
                    <div class="song-cell song-title" onclick="adminManager.handleSongClick(event, '${this.escapeHtml(command)}')">${this.escapeHtml(song.title)}</div>
                    <div class="song-cell song-artist">${this.escapeHtml(song.artist || '')}</div>
                    <div class="song-cell song-genre">${this.escapeHtml(genreDisplay)}</div>
                    <div class="song-cell song-note">${this.escapeHtml(song.note || '-')}</div>
                    <div class="song-cell song-actions">
                        <button class="action-btn edit" onclick="adminManager.editSong(${song.id})">
                            <span class="icon">✏️</span>
                            编辑
                        </button>
                        <button class="action-btn delete" onclick="adminManager.deleteSong(${song.id})">
                            <span class="icon">🗑️</span>
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = songsHTML;

        // 重新绑定事件监听器
        container.querySelectorAll('.song-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleSongSelect(e));
        });

        // 更新全选状态
        this.updateSelectAllState();
    }

    // 处理歌名点击
    handleSongClick(event, command) {
        // 只在移动端处理点击
        if (window.innerWidth <= 768) {
            event.preventDefault();
            event.stopPropagation();
            
            // 添加点击反馈
            const element = event.target;
            element.classList.add('active');
            setTimeout(() => {
                element.classList.remove('active');
            }, 200);
            
            // 复制点歌指令
            this.copyToClipboard(command);
        }
    }

    // 复制到剪贴板
    copyToClipboard(text) {
        console.log('尝试复制文本:', text); // 调试日志

        // 创建临时输入框
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:0;top:0;opacity:0;z-index:-1;';
        document.body.appendChild(textarea);

        try {
            // 选择文本并复制
            textarea.focus();
            textarea.select();
            const successful = document.execCommand('copy');
            
            if (successful) {
                this.showNotification('点歌指令已复制', 'success');
            } else {
                throw new Error('复制失败');
            }
        } catch (err) {
            console.error('复制失败:', err);
            // 显示完整的点歌指令供用户手动复制
            this.showNotification(`请手动复制: ${text}`, 'info', 5000);
        } finally {
            // 清理
            document.body.removeChild(textarea);
        }
    }

    // 显示通知
    showNotification(message, type = 'success', duration = 2000) {
        const container = document.getElementById('notification-container');
        if (!container) {
            console.error('Notification container not found!');
            return;
        }

        // 创建新的通知
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // 根据类型选择图标
        const icon = type === 'success' ? '✨' : 
                    type === 'error' ? '❌' : 
                    type === 'warning' ? '⚠️' : 'ℹ️';
        
        notification.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="text">${message}</span>
        `;
        
        container.appendChild(notification);
        
        // 强制重绘
        notification.offsetHeight;
        
        // 显示通知
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // 打开歌曲模态框
    openSongModal(song = null) {
        this.currentEditingSong = song;
        const modal = document.getElementById('songModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('songForm');
        const customGroup = document.getElementById('customGenreGroup');
        const customInput = document.getElementById('customGenre');
        
        if (song) {
            title.textContent = '编辑歌曲';
            document.getElementById('songTitle').value = song.title;
            document.getElementById('songArtist').value = song.artist;
            document.getElementById('songNote').value = song.note || '';
            
            // 处理风格选择
            if (song.genre) {
                document.getElementById('songGenre').value = 'custom';
                customGroup.style.display = 'block';
                customInput.required = true;
                customInput.value = song.genre;
            } else {
                document.getElementById('songGenre').value = '';
                customGroup.style.display = 'none';
                customInput.required = false;
                customInput.value = '';
            }
        } else {
            title.textContent = '添加歌曲';
            form.reset();
            customGroup.style.display = 'none';
            customInput.required = false;
            customInput.value = '';
        }
        
        modal.classList.add('active');
        document.getElementById('songTitle').focus();
    }

    // 关闭歌曲模态框
    closeSongModal() {
        document.getElementById('songModal').classList.remove('active');
        this.currentEditingSong = null;
    }

    // 处理风格选择变化
    handleGenreChange(value) {
        const customGroup = document.getElementById('customGenreGroup');
        const customInput = document.getElementById('customGenre');
        
        if (value === 'custom') {
            customGroup.style.display = 'block';
            customInput.required = true;
            customInput.focus();
        } else {
            customGroup.style.display = 'none';
            customInput.required = false;
            customInput.value = '';
        }
    }

    // 处理歌曲表单提交
    handleSongSubmit(e) {
        e.preventDefault();
        
        let genre = document.getElementById('songGenre').value;
        const customGenre = document.getElementById('customGenre').value.trim();
        
        // 如果选择了自定义风格，使用自定义输入的值
        if (genre === 'custom') {
            if (!customGenre) {
                this.showNotification('请输入自定义风格名称', 'error');
                return;
            }
            genre = customGenre;
        }
        
        const formData = {
            title: document.getElementById('songTitle').value.trim(),
            artist: document.getElementById('songArtist').value.trim(),
            genre: genre,
            note: document.getElementById('songNote').value.trim()
        };

        // 验证（风格字段为可选）
        if (!formData.title || !formData.artist) {
            this.showNotification('请填写歌名和歌手', 'error');
            return;
        }

        if (this.currentEditingSong) {
            // 编辑现有歌曲
            const index = this.songs.findIndex(s => s.id === this.currentEditingSong.id);
            if (index !== -1) {
                this.songs[index] = { ...this.songs[index], ...formData };
                this.showNotification('歌曲更新成功', 'success');
            }
        } else {
            // 添加新歌曲
            const newSong = {
                id: Date.now(),
                ...formData,
                addedDate: new Date().toISOString()
            };
            this.songs.unshift(newSong);
            this.showNotification('歌曲添加成功', 'success');
        }

        this.saveData();
        this.renderSongs();
        this.closeSongModal();
    }

    // 编辑歌曲
    editSong(songId) {
        const song = this.songs.find(s => s.id === songId);
        if (song) {
            this.openSongModal(song);
        }
    }

    // 删除歌曲
    deleteSong(songId) {
        const song = this.songs.find(s => s.id === songId);
        if (song) {
            this.showConfirmModal(
                `确定要删除歌曲"${song.title}"吗？此操作无法撤销。`,
                () => {
                    this.songs = this.songs.filter(s => s.id !== songId);
                    this.saveData();
                    this.renderSongs();
                    this.showNotification('歌曲已删除', 'success');
                }
            );
        }
    }

    // 显示确认模态框
    showConfirmModal(message, onConfirm) {
        const confirmMessageElement = document.getElementById('confirmMessage');
        if (confirmMessageElement) {
            confirmMessageElement.textContent = message;
        }

        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.classList.add('active');
        }
        
        const confirmBtn = document.getElementById('confirmBtn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.closeConfirmModal();
        });
    }

    // 关闭确认模态框
    closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('active');
    }

    // 加载个人资料
    async loadProfile() {
        try {
            // 尝试从API加载个人资料（GET请求不需要认证）
            const result = await apiClient.getProfile();

            let profile;
            if (result.success && result.data) {
                profile = result.data.profile;
            } else {
                // 如果API失败，回退到localStorage
                profile = this.getProfile();
            }

            if (profile) {
                document.getElementById('websiteTitleInput').value = profile.websiteTitle || '';
                document.getElementById('vtuberNameInput').value = profile.vtuberName || '';
                document.getElementById('vtuberUidInput').value = profile.vtuberUid || '';
                document.getElementById('vtuberBirthdayInput').value = profile.vtuberBirthday || '';
                document.getElementById('liveRoomUrlInput').value = profile.liveRoomUrl || '';
                document.getElementById('vtuberDescInput').value = profile.vtuberDesc || '';

                // 加载头像和背景图
                const avatarPath = profile.avatar || '';
                const backgroundPath = profile.background || '';

                if (avatarPath) {
                    document.getElementById('avatarInput').value = avatarPath;
                    document.getElementById('avatarPreview').src = avatarPath;
                    document.getElementById('avatarPreview').style.display = 'block';
                }

                if (backgroundPath) {
                    document.getElementById('backgroundInput').value = backgroundPath;
                    document.getElementById('backgroundPreview').src = backgroundPath;
                    document.getElementById('backgroundPreview').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('从API加载个人资料失败，使用本地数据:', error);
            // 如果API调用失败，使用本地数据
            const profile = this.getProfile();
            if (profile) {
                document.getElementById('websiteTitleInput').value = profile.websiteTitle || '';
                document.getElementById('vtuberNameInput').value = profile.vtuberName || '';
                document.getElementById('vtuberUidInput').value = profile.vtuberUid || '';
                document.getElementById('vtuberBirthdayInput').value = profile.vtuberBirthday || '';
                document.getElementById('liveRoomUrlInput').value = profile.liveRoomUrl || '';
                document.getElementById('vtuberDescInput').value = profile.vtuberDesc || '';

                const avatarPath = profile.avatar || '';
                const backgroundPath = profile.background || '';

                if (avatarPath) {
                    document.getElementById('avatarInput').value = avatarPath;
                    document.getElementById('avatarPreview').src = avatarPath;
                    document.getElementById('avatarPreview').style.display = 'block';
                }

                if (backgroundPath) {
                    document.getElementById('backgroundInput').value = backgroundPath;
                    document.getElementById('backgroundPreview').src = backgroundPath;
                    document.getElementById('backgroundPreview').style.display = 'block';
                }
            }
        }

        // 加载图片列表
        this.loadImageList('avatar');
        this.loadImageList('background');
    }

    // 保存个人资料
    async saveProfile() {
        const profile = {
            websiteTitle: document.getElementById('websiteTitleInput').value.trim(),
            vtuberName: document.getElementById('vtuberNameInput').value.trim(),
            vtuberUid: document.getElementById('vtuberUidInput').value.trim(),
            vtuberBirthday: document.getElementById('vtuberBirthdayInput').value.trim(),
            liveRoomUrl: document.getElementById('liveRoomUrlInput').value.trim(),
            vtuberDesc: document.getElementById('vtuberDescInput').value.trim(),
            avatar: document.getElementById('avatarInput').value.trim(),
            background: document.getElementById('backgroundInput').value.trim()
        };

        try {
            // 尝试使用API保存（需要认证）
            const result = await apiClient.updateProfile(profile);

            if (result.success) {
                // API保存成功，同时也保存到localStorage作为备份
                localStorage.setItem('vtuber_profile', JSON.stringify(profile));
                this.showNotification('个人资料保存成功', 'success');
            } else {
                throw new Error(result.message || 'API保存失败');
            }
        } catch (error) {
            console.error('API保存失败，尝试本地保存:', error);
            // 如果API失败，回退到localStorage
            try {
                localStorage.setItem('vtuber_profile', JSON.stringify(profile));
                this.showNotification('个人资料已保存到本地', 'warning');
            } catch (localError) {
                console.error('本地保存也失败:', localError);
                this.showNotification('保存失败，请检查存储空间', 'error');
                return;
            }
        }

        // 触发主页面更新
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'profileUpdated' }, '*');
        }
    }

    // 获取个人资料
    getProfile() {
        const savedProfile = localStorage.getItem('vtuber_profile');
        if (savedProfile) {
            return JSON.parse(savedProfile);
        }
        return {
            websiteTitle: '',
            vtuberName: '虚拟主播',
            vtuberUid: 'VT-001',
            vtuberBirthday: '01/01',
            liveRoomUrl: '',
            vtuberDesc: '欢迎来到我的歌单空间！',
            avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMTAwIiBmaWxsPSIjNjM2NmYxIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9Ijg1IiByPSI4IiBmaWxsPSIjNjM2NmYxIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9Ijg1IiByPSI4IiBmaWxsPSIjNjM2NmYxIi8+CjxwYXRoIGQ9Ik04NSAxMTVDODUgMTE1IDkyLjUgMTI1IDEwMCAxMjVDMTA3LjUgMTI1IDExNSAxMTUgMTE1IDExNSIgc3Ryb2tlPSIjNjM2NmYxIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K',
            background: ''
        };
    }

    // 触发文件输入框
    triggerFileInput(inputId) {
        document.getElementById(inputId).click();
    }

    // 处理图片上传
    handleImageUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            this.showNotification('请选择图片文件', 'error');
            return;
        }

        // 显示压缩选项
        this.showCompressionOptions(file, type);
    }

    // 显示压缩选项
    showCompressionOptions(file, type) {
        const modal = document.getElementById('compressionModal');
        const originalInfo = document.getElementById('originalInfo');
        
        // 显示原图信息
        originalInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)}KB)`;
        
        // 重置选项状态
        document.querySelectorAll('.compression-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // 默认选中均衡压缩
        document.querySelector('.compression-option[data-quality="85"]').classList.add('selected');
        
        // 存储当前处理的文件和类型信息
        window.currentCompression = { file, type };
        
        modal.classList.add('active');
    }

    // 选择压缩选项
    selectCompressionOption(element) {
        // 移除其他选项的选中状态
        document.querySelectorAll('.compression-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // 添加当前选项的选中状态
        element.classList.add('selected');
    }

    // 确认压缩
    async confirmCompression() {
        const { file, type } = window.currentCompression;
        const selectedOption = document.querySelector('.compression-option.selected');
        const quality = parseInt(selectedOption.dataset.quality) / 100;
        
        // 关闭模态框
        this.closeCompressionModal();
        
        // 执行压缩
        await this.performCompression(file, type, quality);
    }

    // 执行图片压缩
    async performCompression(file, type, quality) {
        try {
            // 创建图片对象
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;
            };

            img.onload = () => {
                // 创建canvas
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 根据质量等级调整尺寸
                if (quality < 0.9) {  // 对于中等和低质量，进行尺寸缩放
                    const maxSize = quality < 0.8 ? 800 : 1200;  // 低质量800px，中等质量1200px
                    if (width > height && width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // 绘制图片
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 转换为Blob
                canvas.toBlob(async (blob) => {
                    try {
                        // 生成文件名
                        const timestamp = Date.now();
                        const extension = file.name.split('.').pop() || 'jpg';
                        const filename = `${timestamp}.${extension}`;

                        // 创建FormData
                        const formData = new FormData();
                        formData.append('file', new File([blob], filename, { type: 'image/jpeg' }));

                        // 上传文件（需要认证）
                        const session = this.getSession();
                        const headers = {};
                        if (session && session.token) {
                            headers['Authorization'] = `Bearer ${session.token}`;
                        }

                        const response = await fetch(`/api/upload?type=${type}s`, {
                            method: 'POST',
                            headers: headers,
                            body: formData
                        });

                        const result = await response.json();
                        if (!result.success) {
                            throw new Error(result.message || '上传失败');
                        }

                        // 获取文件路径（新API格式）
                        const filePath = result.data ? result.data.path : result.path;

                        // 更新预览和输入框
                        if (type === 'avatar') {
                            document.getElementById('avatarPreview').src = filePath;
                            document.getElementById('avatarPreview').style.display = 'block';
                            document.getElementById('avatarInput').value = filePath;
                        } else {
                            document.getElementById('backgroundPreview').src = filePath;
                            document.getElementById('backgroundPreview').style.display = 'block';
                            document.getElementById('backgroundInput').value = filePath;
                        }

                        // 刷新图片列表
                        this.loadImageList(type);

                        // 显示成功消息
                        this.showNotification('图片处理完成', 'success');
                    } catch (error) {
                        console.error('保存文件失败:', error);
                        this.showNotification(error.message || '保存文件失败，请重试', 'error');
                    }
                }, 'image/jpeg', quality);
            };

            reader.readAsDataURL(file);
        } catch (error) {
            console.error('图片处理失败:', error);
            this.showNotification('图片处理失败，请重试', 'error');
        }
    }

    // 预览图片
    previewImage(path, type) {
        const preview = document.getElementById(`${type}Preview`);
        if (path) {
            preview.src = path;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    // 加载图片列表
    async loadImageList(type) {
        try {
            // GET请求不需要认证
            const result = await apiClient.get(`/images?type=${type}s`);

            if (result.success && result.data) {
                this.populateImageSelect(type, result.data.images || []);
            } else {
                console.error(`加载${type}列表失败:`, result.message);
                // 如果失败，传递空数组以避免错误
                this.populateImageSelect(type, []);
            }
        } catch (error) {
            console.error(`加载${type}列表失败:`, error);
            // 如果出现异常，传递空数组以避免错误
            this.populateImageSelect(type, []);
        }
    }

    // 填充图片选择框
    populateImageSelect(type, images) {
        const select = document.getElementById(`${type}Select`);
        const currentValue = select.value;
        
        // 清空选项并添加默认选项
        select.innerHTML = `<option value="">选择已上传的${type === 'avatar' ? '头像' : '背景图'}</option>`;
        
        // 添加图片选项
        images.forEach(image => {
            const option = document.createElement('option');
            option.value = image.path;
            option.textContent = `${image.filename} (${this.formatFileSize(image.size)})`;
            select.appendChild(option);
        });
        
        // 恢复之前的选择
        select.value = currentValue;
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 处理图片选择
    handleImageSelect(event, type) {
        const selectedPath = event.target.value;
        const input = document.getElementById(`${type}Input`);
        
        if (selectedPath) {
            input.value = selectedPath;
            this.previewImage(selectedPath, type);
        }
    }

    // 刷新图片列表
    async refreshImageList(type) {
        const refreshBtn = document.getElementById(`refresh${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
        const originalContent = refreshBtn.innerHTML;
        
        // 显示刷新动画
        refreshBtn.innerHTML = '<span class="icon">🔄</span>';
        refreshBtn.style.pointerEvents = 'none';
        
        try {
            await this.loadImageList(type);
            this.showNotification(`${type === 'avatar' ? '头像' : '背景图'}列表已刷新`, 'success');
        } catch (error) {
            this.showNotification('刷新失败，请重试', 'error');
        } finally {
            // 恢复按钮状态
            refreshBtn.innerHTML = originalContent;
            refreshBtn.style.pointerEvents = 'auto';
        }
    }

    // 加载设置
    loadSettings() {
        const theme = localStorage.getItem('vtuber_theme') || 'light';
        document.getElementById('defaultTheme').value = theme;
        
        // 加载点歌指令设置
        const settings = this.getCommandSettings();
        const prefixInput = document.getElementById('commandPrefix');
        const suffixInput = document.getElementById('commandSuffix');
        
        if (prefixInput) prefixInput.value = settings.commandPrefix;
        if (suffixInput) suffixInput.value = settings.commandSuffix;
        
        // 绑定实时预览事件
        if (prefixInput) {
            prefixInput.addEventListener('input', () => this.updateCommandPreview());
        }
        if (suffixInput) {
            suffixInput.addEventListener('input', () => this.updateCommandPreview());
        }
        
        this.updateCommandPreview();
        this.updateStats();
        
        // 加载网站图标设置
        this.loadFaviconSettings();
        
        // 加载备案信息设置
        this.loadBeianSettings();
    }

    /**
     * 加载备案信息设置
     */
    loadBeianSettings() {
        const settings = this.getBeianSettings();
        document.getElementById('icpInput').value = settings.icp || '';
        document.getElementById('icpLinkInput').value = settings.icpLink || 'https://beian.miit.gov.cn';
        document.getElementById('policeInput').value = settings.police || '';
        document.getElementById('policeLinkInput').value = settings.policeLink || 'http://www.beian.gov.cn/portal/registerSystemInfo';
    }

    /**
     * 获取备案信息设置
     * @returns {Object} 备案信息设置
     */
    getBeianSettings() {
        const saved = localStorage.getItem('vtuber_beian_settings');
        return saved ? JSON.parse(saved) : {
            icp: '',
            icpLink: 'https://beian.miit.gov.cn',
            police: '',
            policeLink: 'http://www.beian.gov.cn/portal/registerSystemInfo'
        };
    }

    /**
     * 保存备案信息设置
     */
    saveBeianSettings() {
        const settings = {
            icp: document.getElementById('icpInput').value.trim(),
            icpLink: document.getElementById('icpLinkInput').value.trim() || 'https://beian.miit.gov.cn',
            police: document.getElementById('policeInput').value.trim(),
            policeLink: document.getElementById('policeLinkInput').value.trim() || 'http://www.beian.gov.cn/portal/registerSystemInfo'
        };

        try {
            localStorage.setItem('vtuber_beian_settings', JSON.stringify(settings));
            this.showNotification('备案信息设置已保存', 'success');

            // 通知主页面更新备案信息
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                    type: 'beianUpdated',
                    settings: settings
                }, '*');
            }
        } catch (error) {
            console.error('Failed to save beian settings:', error);
            this.showNotification('保存备案设置失败', 'error');
        }
    }

    // 保存主题设置
    async saveThemeSetting(theme) {
        try {
            let result;

            // 检查是否有API客户端可用
            if (typeof apiClient !== 'undefined') {
                // 保存到服务器（需要认证）
                result = await apiClient.put('/settings', { theme: theme });
            } else {
                // 回退到原生fetch，包含认证头
                const session = this.getSession();
                const headers = {
                    'Content-Type': 'application/json'
                };
                if (session && session.token) {
                    headers['Authorization'] = `Bearer ${session.token}`;
                }

                const response = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: headers,
                    body: JSON.stringify({ theme: theme })
                });

                if (response.ok) {
                    result = await response.json();
                } else {
                    throw new Error('服务器保存失败');
                }
            }

            if (result.success) {
                // 服务器保存成功后更新本地
                localStorage.setItem('vtuber_theme', theme);
                document.documentElement.setAttribute('data-theme', theme);

                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) {
                    const icon = themeToggle.querySelector('.icon');
                    if (icon) {
                        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
                    }
                }

                // 同步主题设置到前端页面
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({
                        type: 'themeUpdated',
                        theme: theme
                    }, '*');
                }

                this.showNotification('主题设置已保存', 'success');
            } else {
                throw new Error(result.message || '服务器保存失败');
            }
        } catch (error) {
            console.error('保存主题设置失败:', error);
            this.showNotification('保存主题设置失败', 'error');
        }
    }

    // 更新统计数据
    updateStats() {
        // 安全地更新总歌曲数
        this.safeSetContent('totalSongs', this.songs.length);

        // 安全地更新最后更新时间（如果元素存在）
        const lastUpdate = localStorage.getItem('vtuber_last_update');
        if (lastUpdate) {
            this.safeSetContent('lastUpdate', new Date(lastUpdate).toLocaleString('zh-CN'));
        } else {
            this.safeSetContent('lastUpdate', '从未');
        }

        // 更新最后更新时间戳
        localStorage.setItem('vtuber_last_update', new Date().toISOString());
    }

    // 导出数据
    exportData() {
        const data = {
            songs: this.songs,
            profile: this.getProfile(),
            theme: localStorage.getItem('vtuber_theme') || 'light'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vtuber-playlist-backup.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('数据导出成功', 'success');
    }

    // 导入数据
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.songs || !Array.isArray(data.songs)) throw new Error('无效的数据格式');

                this.showConfirmModal(
                    `确定要导入数据吗？这将替换当前的 ${data.songs.length} 首歌曲和个人资料信息。`,
                    () => {
                        this.songs = data.songs;
                        localStorage.setItem('vtuber_songs', JSON.stringify(this.songs));
                        if (data.profile) localStorage.setItem('vtuber_profile', JSON.stringify(data.profile));
                        if (data.theme) this.saveThemeSetting(data.theme);
                        
                        this.renderSongs();
                        this.loadProfile();
                        this.updateStats();
                        this.showNotification('数据导入成功', 'success');
                        
                        if (window.opener && !window.opener.closed) {
                            window.opener.postMessage({ type: 'dataUpdated' }, '*');
                        }
                    }
                );
            } catch (error) {
                this.showNotification('导入失败：' + error.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // 备份数据到本地文件
    backupDataToFile() {
        this.exportData();
    }

    // 获取风格显示名称
    getGenreDisplayName(genre) {
        if (!genre || genre.trim() === '') return '-';
        
        const allGenres = this.getAllGenres();
        const matchedGenre = allGenres.find(g => g.id === genre);
        
        return matchedGenre ? matchedGenre.name : genre;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    checkStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) totalSize += localStorage[key].length;
        }
        const estimatedQuota = 5 * 1024 * 1024;
        const usagePercent = ((totalSize / estimatedQuota) * 100).toFixed(1);
        return { totalSize, usagePercent };
    }

    cleanupTempData() {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('temp_') || key.startsWith('cache_') || key.includes('_backup_'));
        keys.forEach(key => localStorage.removeItem(key));
        if (keys.length > 0) this.showNotification(`已清理 ${keys.length} 个临时文件`, 'info');
    }

    openBatchModal(tab = 'songs') {
        const modal = document.getElementById('batchModal');
        modal.classList.add('active');
        this.switchBatchTab(tab);
        this.resetBatchAddForm();
        this.updateGenreAndRemarkSelects();
        this.loadGenresAndRemarks();
    }

    closeBatchModal() {
        document.getElementById('batchModal').classList.remove('active');
    }

    resetBatchAddForm() {
        document.getElementById('batchSongText').value = '';
        document.getElementById('batchPreview').innerHTML = '<p class="preview-hint">输入歌曲信息后，这里会显示解析预览</p>';
        document.getElementById('batchDefaultGenre').value = '';
        document.getElementById('batchDefaultNote').value = '';
    }

    switchBatchTab(tabName) {
        document.querySelectorAll('.batch-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.batch-tabs [data-tab="${tabName}"]`).classList.add('active');
        document.querySelectorAll('#batchModal .tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        const titles = { songs: '批量添加歌曲', genres: '管理风格', remarks: '管理备注' };
        const batchModalTitle = document.getElementById('batchModalTitle');
        if (batchModalTitle) {
            batchModalTitle.textContent = titles[tabName] || '批量操作';
        }

        const modalContent = document.querySelector('#batchModal .modal-content');
        if (modalContent) {
            if (tabName === 'songs') {
                modalContent.classList.add('large-modal');
                modalContent.classList.remove('medium-modal');
            } else {
                modalContent.classList.add('medium-modal');
                modalContent.classList.remove('large-modal');
            }
        }

        if (tabName === 'genres') this.renderGenreManagement();
        else if (tabName === 'remarks') this.renderRemarkManagement();
    }

    // 移除了子标签切换、预览、模板相关的函数

    getCustomGenres() {
        const saved = localStorage.getItem('vtuber_custom_genres');
        let customGenres = saved ? JSON.parse(saved) : [];

        // 如果localStorage为空，初始化默认风格数据
        if (customGenres.length === 0) {
            // 优先从 window.officialData 获取，然后是默认数据
            const initialGenres = (window.officialData && window.officialData.customGenres) ? window.officialData.customGenres : this.getDefaultGenres();
            customGenres = initialGenres;
            localStorage.setItem('vtuber_custom_genres', JSON.stringify(customGenres));
            console.log('admin getCustomGenres: 初始化风格数据', customGenres);
        }

        return customGenres;
    }

    // 获取默认风格数据（与硬编码映射保持一致）
    getDefaultGenres() {
        return [
            { id: 'custom_1751485097686', name: '情歌', builtIn: false },
            { id: 'custom_1751506273759', name: '甜蜜情歌', builtIn: false },
            { id: 'custom_1751506269360', name: '古风', builtIn: false },
            { id: 'custom_1751506264888', name: '戏曲', builtIn: false },
            { id: 'custom_1751506259744', name: '京剧', builtIn: false },
            { id: 'custom_1751506255759', name: '豫剧', builtIn: false },
            { id: 'custom_1751506245176', name: '儿歌', builtIn: false },
            { id: 'custom_1751506243976', name: '流行', builtIn: false },
            { id: 'custom_1751656714021', name: '黄梅戏', builtIn: false },
            { id: 'custom_1751656716807', name: '现代戏曲', builtIn: false }
        ];
    }

    saveCustomGenres(genres) {
        localStorage.setItem('vtuber_custom_genres', JSON.stringify(genres));
    }

    getBuiltInGenres() {
        return [];
    }

    getAllGenres() {
        return this.getCustomGenres();
    }

    updateGenreSelects() {
        const selects = document.querySelectorAll('select[id$="Genre"], select[id^="songGenre"], select[id="defaultGenre"]');
        const allGenres = this.getAllGenres();
        selects.forEach(select => {
            const currentValue = select.value;
            const isRequired = select.hasAttribute('required');
            let optionsHtml = isRequired ? '<option value="">请选择风格</option>' : '<option value="">不设置默认风格</option>';
            allGenres.forEach(genre => {
                optionsHtml += `<option value="${genre.id}">${this.escapeHtml(genre.name)}</option>`;
            });
            if (select.id !== 'defaultGenre') optionsHtml += '<option value="custom">自定义</option>';
            select.innerHTML = optionsHtml;
            select.value = currentValue;
        });
    }

    updateGenreAndRemarkSelects() {
        const batchGenreSelect = document.getElementById('batchDefaultGenre');
        if (batchGenreSelect) {
            const allGenres = this.getAllGenres();
            let genreOptionsHtml = '<option value="">不设置统一风格</option>';
            allGenres.forEach(genre => {
                genreOptionsHtml += `<option value="${genre.id}">${this.escapeHtml(genre.name)}</option>`;
            });
            batchGenreSelect.innerHTML = genreOptionsHtml;
        }

        const batchRemarkSelect = document.getElementById('batchDefaultNote');
        if (batchRemarkSelect) {
            const allRemarks = this.getAllRemarks();
            let remarkOptionsHtml = '<option value="">不设置统一备注</option>';
            allRemarks.forEach(remark => {
                remarkOptionsHtml += `<option value="${this.escapeHtml(remark)}">${this.escapeHtml(remark)}</option>`;
            });
            batchRemarkSelect.innerHTML = remarkOptionsHtml;
        }
    }

    loadGenresAndRemarks() {
        this.renderGenreManagement();
        this.renderRemarkManagement();
    }

    addNewGenre() {
        const input = document.getElementById('newGenreInput');
        const name = input.value.trim();
        if (!name) {
            this.showNotification('请输入风格名称', 'warning');
            input.focus();
            return;
        }
        const allGenres = this.getAllGenres();
        if (allGenres.some(g => g.name === name)) {
            this.showNotification('该风格已存在', 'warning');
            input.focus();
            return;
        }
        const customGenres = this.getCustomGenres();
        customGenres.push({ id: 'custom_' + Date.now(), name, builtIn: false });
        this.saveCustomGenres(customGenres);
        input.value = '';
        this.renderGenreManagement();
        this.updateGenreSelects();
        this.updateGenreAndRemarkSelects();
        this.showNotification('风格添加成功', 'success');
    }

    deleteGenre(genreId) {
        const customGenres = this.getCustomGenres();
        const updated = customGenres.filter(g => g.id !== genreId);
        this.saveCustomGenres(updated);
        this.renderGenreManagement();
        this.updateGenreSelects();
        this.updateGenreAndRemarkSelects();
        this.showNotification('风格删除成功', 'success');
    }

    renderGenreManagement() {
        const container = document.getElementById('genresList');
        const customGenres = this.getCustomGenres();
        container.innerHTML = '';
        
        customGenres.forEach(genre => {
            const itemTag = document.createElement('div');
            itemTag.className = 'item-tag';
            const span = document.createElement('span');
            span.textContent = genre.name;
            itemTag.appendChild(span);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => this.deleteGenre(genre.id);
            itemTag.appendChild(deleteBtn);
            container.appendChild(itemTag);
        });
    }

    getAllRemarks() {
        const savedRemarks = localStorage.getItem('vtuber_custom_remarks');
        return (savedRemarks ? JSON.parse(savedRemarks) : []).sort();
    }

    saveCustomRemarks(remarks) {
        localStorage.setItem('vtuber_custom_remarks', JSON.stringify(remarks));
    }

    addNewRemark() {
        const input = document.getElementById('newRemarkInput');
        const remark = input.value.trim();
        if (!remark) {
            this.showNotification('请输入备注内容', 'warning');
            input.focus();
            return;
        }
        const allRemarks = this.getAllRemarks();
        if (allRemarks.includes(remark)) {
            this.showNotification('该备注已存在', 'warning');
            input.focus();
            return;
        }
        const customRemarks = JSON.parse(localStorage.getItem('vtuber_custom_remarks') || '[]');
        customRemarks.push(remark);
        this.saveCustomRemarks(customRemarks);
        input.value = '';
        this.renderRemarkManagement();
        this.updateGenreAndRemarkSelects();
        this.showNotification('备注添加成功', 'success');
    }

    deleteRemark(remark) {
        const customRemarks = JSON.parse(localStorage.getItem('vtuber_custom_remarks') || '[]');
        const updated = customRemarks.filter(r => r !== remark);
        this.saveCustomRemarks(updated);
        this.renderRemarkManagement();
        this.updateGenreAndRemarkSelects();
        this.showNotification('备注删除成功', 'success');
    }

    renderRemarkManagement() {
        const container = document.getElementById('remarksList');
        const allRemarks = this.getAllRemarks();
        container.innerHTML = '';
        allRemarks.forEach(remark => {
            const itemTag = document.createElement('div');
            itemTag.className = 'item-tag';
            const span = document.createElement('span');
            span.textContent = remark;
            itemTag.appendChild(span);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => this.deleteRemark(remark);
            itemTag.appendChild(deleteBtn);
            container.appendChild(itemTag);
        });
        const statsContainer = document.getElementById('remarksStats');
        const remarkCount = {};
        this.songs.forEach(song => {
            const remark = song.note || '无备注';
            remarkCount[remark] = (remarkCount[remark] || 0) + 1;
        });
        const statsHtml = Object.entries(remarkCount).map(([remark, count]) => `<div class="stat-item"><span class="stat-name">${this.escapeHtml(remark)}</span><span class="stat-count">${count}</span></div>`).join('');
        statsContainer.innerHTML = statsHtml;
    }

    showBatchEditOptions() {
        const selectedCount = this.getSelectedSongIds().length;
        const actions = (selectedCount === 0) ? [
            { icon: '🏷️', text: '管理风格', action: () => this.openBatchModal('genres') },
            { icon: '📝', text: '管理备注', action: () => this.openBatchModal('remarks') }
        ] : [
            { icon: '🎤', text: `批量设置歌手 (${selectedCount}首)`, action: () => this.openBatchSetArtistModal() },
            { icon: '🏷️', text: `批量设置风格 (${selectedCount}首)`, action: () => this.openBatchSetGenreModal() },
            { icon: '📝', text: `批量设置备注 (${selectedCount}首)`, action: () => this.openBatchSetRemarkModal() }
        ];
        this.showActionMenu(actions);
    }

    showBatchRemoveOptions() {
        const selectedCount = this.getSelectedSongIds().length;
        if (selectedCount === 0) {
            this.showNotification('请先选择要删除的歌曲', 'warning');
        } else {
            this.batchDeleteSongs();
        }
    }

    showActionMenu(actions) {
        const menu = document.createElement('div');
        menu.className = 'action-menu';
        menu.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--glass-bg); backdrop-filter: blur(10px); border: 1px solid var(--glass-border); border-radius: 12px; padding: 20px; z-index: 10000; box-shadow: 0 8px 32px var(--shadow); min-width: 250px;`;
        menu.innerHTML = `<h4 style="margin: 0 0 16px 0; color: var(--text-primary); text-align: center;">选择操作</h4><div style="display: flex; flex-direction: column; gap: 12px;">${actions.map((action, index) => `<button class="glass-btn action-menu-btn" data-index="${index}" style="padding: 12px 16px; text-align: left; width: 100%; display: flex; align-items: center; gap: 12px;"><span style="font-size: 1.2em;">${action.icon}</span><span>${action.text}</span></button>`).join('')}</div><div style="margin-top: 16px; text-align: center;"><button class="glass-btn secondary cancel-menu-btn">取消</button></div>`;
        document.body.appendChild(menu);

        menu.querySelectorAll('.action-menu-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                actions[index].action();
                document.body.removeChild(menu);
            });
        });

        menu.querySelector('.cancel-menu-btn').addEventListener('click', () => document.body.removeChild(menu));

        const closeOnOutsideClick = (e) => {
            if (!menu.contains(e.target)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeOnOutsideClick);
            }
        };
        setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 100);
    }

    handleSelectAll(event) {
        const isChecked = event.target.checked;
        const checkboxes = document.querySelectorAll('.song-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const row = checkbox.closest('.song-row');
            if (row) {
                row.classList.toggle('selected', isChecked);
            }
        });
        this.updateBatchToolbar();
        console.log('Selected IDs after handleSelectAll:', this.getSelectedSongIds()); // 调试信息
    }

    handleSongSelect(event) {
        const checkbox = event.target;
        const row = checkbox.closest('.song-row');
        if (row) {
            row.classList.toggle('selected', checkbox.checked);
        }
        this.updateBatchToolbar();
        this.updateSelectAllState();
        console.log('Selected IDs after handleSongSelect:', this.getSelectedSongIds()); // 调试信息
    }

    updateSelectAllState() {
        const checkboxes = document.querySelectorAll('.song-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;

        const totalCount = checkboxes.length;
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        
        selectAllCheckbox.checked = checkedCount > 0;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
        
        console.log(`Total: ${totalCount}, Checked: ${checkedCount}`); // 调试信息
    }

    updateBatchToolbar() {
        const selectedIds = this.getSelectedSongIds();
        const selectedCount = selectedIds.length;
        const toolbar = document.getElementById('batchToolbar');
        const countDisplay = document.getElementById('selectedCount');
        
        if (toolbar && countDisplay) {
            countDisplay.textContent = selectedCount;
            toolbar.style.display = selectedCount > 0 ? 'flex' : 'none';
        }
        console.log('Selected IDs in updateBatchToolbar:', selectedIds); // 调试信息
    }

    updateRowSelection() {
        document.querySelectorAll('.song-checkbox').forEach(checkbox => {
            const row = checkbox.closest('.song-row');
            if (row) {
                row.classList.toggle('selected', checkbox.checked);
            }
        });
    }

    getSelectedSongIds() {
        const selectedIds = [];
        document.querySelectorAll('.song-checkbox:checked').forEach(checkbox => {
            const id = parseInt(checkbox.dataset.id, 10);
            if (!isNaN(id)) {
                selectedIds.push(id);
            }
        });
        return selectedIds;
    }

    clearSelection() {
        document.querySelectorAll('.song-checkbox').forEach(checkbox => checkbox.checked = false);
        document.getElementById('selectAllCheckbox').checked = false;
        document.getElementById('selectAllCheckbox').indeterminate = false;
        this.updateBatchToolbar();
        this.updateRowSelection();
    }

    openBatchSetGenreModal() {
        const selectedIds = this.getSelectedSongIds();
        if (selectedIds.length === 0) {
            this.showNotification('请先选择要操作的歌曲', 'warning');
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'batchGenreModal';
        const customGenres = this.getCustomGenres();
        const genreOptions = customGenres.map(genre => `<option value="${genre.id}">${this.escapeHtml(genre.name)}</option>`).join('');
        modal.innerHTML = `<div class="modal-content glass-card"><div class="modal-header"><h3>批量设置风格</h3><button class="close-btn" onclick="this.closest('.modal').remove()">❌</button></div><div class="modal-body"><p>将为 <strong>${selectedIds.length}</strong> 首歌曲设置风格</p><div class="form-group"><label for="batchGenreSelect">选择风格</label><select id="batchGenreSelect" class="glass-input" required><option value="">请选择风格</option>${genreOptions}<option value="custom">自定义</option></select></div><div class="form-group" id="batchCustomGenreGroup" style="display: none;"><label for="batchCustomGenre">自定义风格</label><input type="text" id="batchCustomGenre" class="glass-input" placeholder="请输入自定义风格"></div></div><div class="modal-footer"><button class="glass-btn secondary" onclick="this.closest('.modal').remove()">取消</button><button class="glass-btn primary" id="confirmBatchGenreBtn">确认设置</button></div></div>`;
        document.body.appendChild(modal);

        // 绑定确认按钮事件
        document.getElementById('confirmBatchGenreBtn').addEventListener('click', () => {
            this.confirmBatchSetGenre(selectedIds);
        });

        document.getElementById('batchGenreSelect').addEventListener('change', (e) => {
            const customGroup = document.getElementById('batchCustomGenreGroup');
            const customInput = document.getElementById('batchCustomGenre');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            customInput.required = e.target.value === 'custom';
            if(e.target.value === 'custom') customInput.focus();
        });
    }

    confirmBatchSetGenre(selectedIds) {
        if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
            this.showNotification('没有选中的歌曲', 'error');
            return;
        }

        let genre = document.getElementById('batchGenreSelect').value;
        const customGenre = document.getElementById('batchCustomGenre')?.value.trim();
        if (genre === 'custom') {
            if (!customGenre) {
                this.showNotification('请输入自定义风格名称', 'error');
                return;
            }
            genre = customGenre;
        }
        if (!genre) {
            this.showNotification('请选择风格', 'error');
            return;
        }

        let updatedCount = 0;
        const selectedIdSet = new Set(selectedIds);

        this.songs = this.songs.map(song => {
            if (selectedIdSet.has(song.id)) {
                updatedCount++;
                return { ...song, genre: genre };
            }
            return song;
        });

        this.saveData();
        this.renderSongs();
        this.clearSelection();
        this.updateGenreSelects();

        // 安全地移除模态框
        const modal = document.getElementById('batchGenreModal');
        if (modal) {
            modal.remove();
        }

        this.showNotification(`已为 ${updatedCount} 首歌曲设置风格`, 'success');
    }

    openBatchSetRemarkModal() {
        const selectedIds = this.getSelectedSongIds();
        if (selectedIds.length === 0) {
            this.showNotification('请先选择要操作的歌曲', 'warning');
            return;
        }

        const allRemarks = this.getAllRemarks();
        const remarkOptions = allRemarks.map(remark => `<option value="${this.escapeHtml(remark)}">${this.escapeHtml(remark)}</option>`).join('');

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'batchRemarkModal';
        modal.innerHTML = `<div class="modal-content glass-card">
            <div class="modal-header">
                <h3>批量设置备注</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">❌</button>
            </div>
            <div class="modal-body">
                <p>将为 <strong>${selectedIds.length}</strong> 首歌曲设置备注</p>
                <div class="form-group">
                    <label for="batchRemarkSelect">选择备注</label>
                    <select id="batchRemarkSelect" class="glass-input">
                        <option value="">清空备注</option>
                        ${remarkOptions}
                        <option value="custom">自定义新备注</option>
                    </select>
                </div>
                <div class="form-group" id="batchCustomRemarkGroup" style="display: none;">
                    <label for="batchCustomRemark">自定义备注</label>
                    <input type="text" id="batchCustomRemark" class="glass-input" placeholder="请输入自定义备注">
                </div>
            </div>
            <div class="modal-footer">
                <button class="glass-btn secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="glass-btn primary" id="confirmBatchRemarkBtn">确认设置</button>
            </div>
        </div>`;
        document.body.appendChild(modal);

        // 绑定确认按钮事件
        document.getElementById('confirmBatchRemarkBtn').addEventListener('click', () => {
            this.confirmBatchSetRemark(selectedIds);
        });

        document.getElementById('batchRemarkSelect').addEventListener('change', (e) => {
            const customGroup = document.getElementById('batchCustomRemarkGroup');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            if (e.target.value === 'custom') {
                document.getElementById('batchCustomRemark').focus();
            }
        });
    }

    // 确认批量设置备注
    confirmBatchSetRemark(selectedIds) {
        if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
            this.showNotification('没有选中的歌曲', 'error');
            return;
        }

        let remark = document.getElementById('batchRemarkSelect').value;
        if (remark === 'custom') {
            remark = document.getElementById('batchCustomRemark').value.trim();
        }

        let updatedCount = 0;
        const selectedIdSet = new Set(selectedIds);

        this.songs = this.songs.map(song => {
            if (selectedIdSet.has(song.id)) {
                updatedCount++;
                return { ...song, note: remark };
            }
            return song;
        });

        this.saveData();
        this.renderSongs();
        this.clearSelection();

        // 安全地移除模态框
        const modal = document.getElementById('batchRemarkModal');
        if (modal) {
            modal.remove();
        }

        this.showNotification(`已为 ${updatedCount} 首歌曲设置备注`, 'success');
    }

    openBatchSetArtistModal() {
        const selectedIds = this.getSelectedSongIds();
        if (selectedIds.length === 0) {
            this.showNotification('请先选择要操作的歌曲', 'warning');
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'batchArtistModal';
        modal.innerHTML = `<div class="modal-content glass-card">
            <div class="modal-header">
                <h3>批量设置歌手</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">❌</button>
            </div>
            <div class="modal-body">
                <p>将为 <strong>${selectedIds.length}</strong> 首歌曲设置歌手</p>
                <div class="form-group">
                    <label for="batchArtistInput">歌手名称</label>
                    <input type="text" id="batchArtistInput" class="glass-input" placeholder="请输入歌手名称（留空则清空歌手）">
                </div>
            </div>
            <div class="modal-footer">
                <button class="glass-btn secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="glass-btn primary" id="confirmBatchArtistBtn">确认设置</button>
            </div>
        </div>`;
        document.body.appendChild(modal);

        // 绑定确认按钮事件
        document.getElementById('confirmBatchArtistBtn').addEventListener('click', () => {
            this.confirmBatchSetArtist(selectedIds);
        });

        document.getElementById('batchArtistInput').focus();
    }

    confirmBatchSetArtist(selectedIds) {
        try {
            console.log('confirmBatchSetArtist called with:', selectedIds);

            if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
                this.showNotification('没有选中的歌曲', 'error');
                return;
            }

            const artistInput = document.getElementById('batchArtistInput');
            if (!artistInput) {
                console.error('batchArtistInput element not found');
                this.showNotification('输入框未找到，请重试', 'error');
                return;
            }

            const artist = artistInput.value.trim();
            let updatedCount = 0;

            console.log('Setting artist to:', artist);

            // 创建歌曲ID的集合以提高查找效率
            const selectedIdSet = new Set(selectedIds);

            // 更新所有选中的歌曲
            this.songs = this.songs.map(song => {
                if (selectedIdSet.has(song.id)) {
                    updatedCount++;
                    console.log(`Updating song ${song.id}: ${song.title} -> artist: ${artist}`);
                    return { ...song, artist };
                }
                return song;
            });

            console.log(`Updated ${updatedCount} songs`);

            this.saveData();
            this.renderSongs();
            this.clearSelection();

            // 安全地移除模态框
            const modal = document.getElementById('batchArtistModal');
            if (modal) {
                modal.remove();
            }

            this.showNotification(`已为 ${updatedCount} 首歌曲设置歌手`, 'success');
        } catch (error) {
            console.error('Error in confirmBatchSetArtist:', error);
            this.showNotification('批量设置歌手时发生错误', 'error');
        }
    }

    batchDeleteSongs() {
        const selectedIds = this.getSelectedSongIds();
        if (selectedIds.length === 0) {
            this.showNotification('请先选择要删除的歌曲', 'warning');
            return;
        }
        this.showConfirmModal(
            `确定要删除选中的 ${selectedIds.length} 首歌曲吗？此操作无法撤销。`,
            () => {
                this.songs = this.songs.filter(song => !selectedIds.includes(song.id));
                this.saveData();
                this.renderSongs();
                this.clearSelection();
                this.updateSelectAllState();
                this.showNotification(`已删除 ${selectedIds.length} 首歌曲`, 'success');
            }
        );
    }

    async syncOfficialData() {
        this.showNotification('正在同步数据...', 'info');
        const dataToSync = { profile: this.getProfile(), songs: this.songs };
        try {
            // 确保有认证令牌
            const session = this.getSession();
            if (!session || !session.token) {
                throw new Error('认证令牌缺失，请重新登录');
            }

            let result;

            // 检查是否有API客户端可用
            if (typeof apiClient !== 'undefined') {
                // 设置认证令牌到localStorage，供API客户端使用
                localStorage.setItem('auth_token', session.token);

                // 使用API客户端进行同步
                result = await apiClient.syncData(dataToSync);
            } else {
                // 回退到原生fetch，但包含认证头
                console.warn('API客户端未加载，使用原生fetch');
                const response = await fetch('/api/update-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.token}`
                    },
                    body: JSON.stringify(dataToSync, null, 2)
                });
                result = await response.json();
            }

            if (result.success) {
                this.showNotification('官网数据已同步！', 'success');
            } else {
                throw new Error(result.message || '未知错误');
            }
        } catch (error) {
            console.error('同步失败:', error);
            this.showNotification(`同步失败: ${error.message}`, 'error');

            // 如果是认证错误，可能需要重新登录
            if (error.message.includes('认证') || error.message.includes('登录')) {
                setTimeout(() => {
                    this.logout('认证失败，请重新登录');
                }, 2000);
            }
        }
    }

    // 预览批量添加的歌曲
    previewBatchSongs() {
        const text = document.getElementById('batchSongText').value.trim();
        const previewContainer = document.getElementById('batchPreview');
        
        if (!text) {
            previewContainer.innerHTML = '<p class="preview-hint">请输入歌曲信息</p>';
            return;
        }

        const lines = text.split('\n').filter(line => line.trim());
        const parsedSongs = [];
        const errors = [];

        lines.forEach((line, index) => {
            const lineContent = line.trim();

            if (!lineContent) {
                errors.push(`第 ${index + 1} 行为空`);
                return;
            }

            // 只使用空格分隔
            const titles = lineContent.split(/\s+/).filter(t => t.trim());

            // 将每个标题添加到解析结果中
            titles.forEach(title => {
                parsedSongs.push({ title });
            });
        });

        let previewHTML = '';
        
        // 显示错误信息
        if (errors.length > 0) {
            previewHTML += '<div class="preview-errors">' +
                errors.map(error => `<div class="preview-error">${this.escapeHtml(error)}</div>`).join('') +
                '</div>';
        }

        // 显示成功解析的歌曲
        if (parsedSongs.length > 0) {
            previewHTML += parsedSongs.map(song => `
                <div class="preview-song">
                    <div class="preview-song-title">${this.escapeHtml(song.title)}</div>
                </div>
            `).join('');
        }

        if (parsedSongs.length === 0 && errors.length === 0) {
            previewHTML = '<p class="preview-hint">无法解析任何歌曲，请检查输入格式</p>';
        }

        previewContainer.innerHTML = previewHTML;
    }

    // 确认批量添加歌曲
    confirmBatchAdd() {
        const text = document.getElementById('batchSongText').value.trim();
        
        if (!text) {
            this.showNotification('请输入歌曲信息', 'warning');
            return;
        }

        const lines = text.split('\n').filter(line => line.trim());
        const parsedSongs = [];
        const errors = [];

        let songIndex = 0;
        lines.forEach((line, lineIndex) => {
            const lineContent = line.trim();
            
            if (!lineContent) {
                errors.push(`第 ${lineIndex + 1} 行为空`);
                return;
            }

            // 只使用空格分隔
            const titles = lineContent.split(/\s+/).filter(t => t.trim());

            // 将每个标题添加到解析结果中
            titles.forEach(title => {
                parsedSongs.push({
                    id: Date.now() + songIndex++, // 确保每个ID都是唯一的
                    title,
                    artist: '', // 默认为空字符串
                    addedDate: new Date().toISOString()
                });
            });
        });

        if (errors.length > 0) {
            this.showNotification('存在格式错误的歌曲，请修正后重试', 'error');
            return;
        }

        if (parsedSongs.length === 0) {
            this.showNotification('没有可添加的歌曲', 'warning');
            return;
        }

        // 获取统一设置的风格和备注
        const defaultGenre = document.getElementById('batchDefaultGenre').value;
        const defaultNote = document.getElementById('batchDefaultNote').value;

        // 添加风格和备注（如果有设置）
        parsedSongs.forEach(song => {
            if (defaultGenre) song.genre = defaultGenre;
            if (defaultNote) song.note = defaultNote;
        });

        // 添加到歌曲列表
        this.songs.unshift(...parsedSongs);
        this.saveData();
        this.renderSongs();
        this.closeBatchModal();
        this.showNotification(`成功添加 ${parsedSongs.length} 首歌曲`, 'success');
    }

    // 关闭压缩选项模态框
    closeCompressionModal() {
        const modal = document.getElementById('compressionModal');
        modal.classList.remove('active');
        window.currentCompression = null;
    }

    // 修改密码
    async changePassword() {
        const oldPassword = document.getElementById('oldPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        // 验证输入
        if (!oldPassword || !newPassword || !confirmPassword) {
            this.showNotification('请填写所有密码字段', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('两次输入的新密码不一致', 'error');
            return;
        }

        // 验证新密码强度
        if (!this.validatePasswordStrength(newPassword)) {
            this.showNotification('新密码强度不足，请使用包含大小写字母、数字和特殊字符的8位以上密码', 'error');
            return;
        }

        // 验证当前密码
        const storedHash = localStorage.getItem('vtuber_admin_password');
        if (!storedHash) {
            this.showNotification('系统错误：未找到密码记录', 'error');
            return;
        }

        // 验证旧密码是否正确
        const oldPasswordHash = await this.hashPassword(oldPassword);
        if (oldPasswordHash !== storedHash) {
            this.showNotification('当前密码不正确', 'error');
            return;
        }

        try {
            // 生成新密码的哈希
            const newPasswordHash = await this.hashPassword(newPassword);

            // 更新存储的密码哈希
            localStorage.setItem('vtuber_admin_password', newPasswordHash);

            // 显示成功消息并跳转到登录页面
            this.showNotification('密码修改成功，请重新登录', 'success');
            setTimeout(() => {
                this.logout('密码已修改，请使用新密码登录');
            }, 1500);
        } catch (error) {
            console.error('修改密码失败:', error);
            this.showNotification('修改密码失败，请重试', 'error');
        }
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

    // 密码哈希函数
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + this.getSalt());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 获取盐值
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

    // 获取点歌指令设置
    getCommandSettings() {
        const saved = localStorage.getItem('vtuber_command_settings');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            commandPrefix: '/点歌',
            commandSuffix: '' // 默认后缀为空
        };
    }

    // 保存点歌指令设置
    saveCommandSettings(settings) {
        try {
            // 保存到 localStorage
            localStorage.setItem('vtuber_command_settings', JSON.stringify(settings));
            console.log('点歌指令设置已保存:', settings);
            
            // 同步到前端页面
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ 
                    type: 'settingsUpdated', 
                    settings: settings 
                }, '*');
                console.log('已发送设置更新消息到前端页面');
            } else {
                console.log('前端页面未打开，无法同步设置');
            }
        } catch (error) {
            console.error('保存点歌指令设置失败:', error);
            throw error; // 向上传播错误以便显示通知
        }
    }

    // 更新指令预览
    updateCommandPreview() {
        const prefix = document.getElementById('commandPrefix')?.value || '/点歌';
        const suffix = document.getElementById('commandSuffix')?.value || '';
        const previewElement = document.getElementById('previewText');
        
        if (previewElement) {
            // 如果后缀为空，则不显示后缀部分
            if (suffix.trim() === '') {
                previewElement.textContent = `${prefix} {歌名}`;
            } else {
                previewElement.textContent = `${prefix} {歌名} ${suffix} {歌手}`;
            }
        }
    }

    // 初始化自定义风格
    initCustomGenres() {
        // 检查数据版本，如果版本不匹配则清除旧数据
        const dataVersion = localStorage.getItem('vtuber_data_version');
        const currentVersion = '2.0'; // 增加版本号以强制更新

        if (dataVersion !== currentVersion) {
            console.log('数据版本更新，清除旧的风格数据');
            localStorage.removeItem('vtuber_custom_genres');
            localStorage.setItem('vtuber_data_version', currentVersion);
        }

        const savedGenres = localStorage.getItem('vtuber_custom_genres');
        if (!savedGenres) {
            // 从 data.js 或默认列表初始化
            const initialGenres = (window.officialData && window.officialData.customGenres) ? window.officialData.customGenres : this.getDefaultGenres();
            localStorage.setItem('vtuber_custom_genres', JSON.stringify(initialGenres));
            console.log('初始化风格数据:', initialGenres);
        } else {
            // 检查是否需要更新风格数据（如果服务器数据更新了）
            const saved = JSON.parse(savedGenres);
            if (window.officialData && window.officialData.customGenres && window.officialData.customGenres.length > 0) {
                // 合并服务器数据和本地数据，优先使用服务器数据
                const serverGenres = window.officialData.customGenres;
                const mergedGenres = [...serverGenres];

                // 添加本地独有的风格
                saved.forEach(localGenre => {
                    if (!serverGenres.find(sg => sg.id === localGenre.id)) {
                        mergedGenres.push(localGenre);
                    }
                });

                localStorage.setItem('vtuber_custom_genres', JSON.stringify(mergedGenres));
                console.log('更新风格数据:', mergedGenres);
            }
        }
    }

    // 获取自定义风格
    getCustomGenres() {
        const saved = localStorage.getItem('vtuber_custom_genres');
        let customGenres = saved ? JSON.parse(saved) : [];

        // 如果localStorage为空，初始化默认风格数据
        if (customGenres.length === 0) {
            // 优先从 window.officialData 获取，然后是默认数据
            const initialGenres = (window.officialData && window.officialData.customGenres) ? window.officialData.customGenres : this.getDefaultGenres();
            customGenres = initialGenres;
            localStorage.setItem('vtuber_custom_genres', JSON.stringify(customGenres));
            console.log('admin getCustomGenres: 初始化风格数据', customGenres);
        }

        return customGenres;
    }

    // 获取默认风格数据（与硬编码映射保持一致）
    getDefaultGenres() {
        return [
            { id: 'custom_1751485097686', name: '情歌', builtIn: false },
            { id: 'custom_1751506273759', name: '甜蜜情歌', builtIn: false },
            { id: 'custom_1751506269360', name: '古风', builtIn: false },
            { id: 'custom_1751506264888', name: '戏曲', builtIn: false },
            { id: 'custom_1751506259744', name: '京剧', builtIn: false },
            { id: 'custom_1751506255759', name: '豫剧', builtIn: false },
            { id: 'custom_1751506245176', name: '儿歌', builtIn: false },
            { id: 'custom_1751506243976', name: '流行', builtIn: false },
            { id: 'custom_1751656714021', name: '黄梅戏', builtIn: false },
            { id: 'custom_1751656716807', name: '现代戏曲', builtIn: false }
        ];
    }

    // 填充筛选器
    populateFilters() {
        this.populateGenreFilter();
        this.populateRemarkFilter();
    }

    populateGenreFilter() {
        const genreFilter = document.getElementById('genreFilter');
        const customGenres = this.getCustomGenres();
        const currentValue = genreFilter.value;

        let optionsHtml = '<option value="all">所有风格</option>';
        customGenres.forEach(genre => {
            optionsHtml += `<option value="${genre.id}">${this.escapeHtml(genre.name)}</option>`;
        });

        genreFilter.innerHTML = optionsHtml;
        genreFilter.value = currentValue;
    }

    populateRemarkFilter() {
        const remarkFilter = document.getElementById('remarkFilter');
        const remarks = this.songs.map(song => song.note || '').filter(note => note.trim() !== '');
        const uniqueRemarks = [...new Set(remarks)].sort();
        const currentValue = remarkFilter.value;

        let optionsHtml = '<option value="all">所有备注</option>';
        optionsHtml += '<option value="[NONE]">无备注</option>';
        uniqueRemarks.forEach(remark => {
            optionsHtml += `<option value="${this.escapeHtml(remark)}">${this.escapeHtml(remark)}</option>`;
        });

        remarkFilter.innerHTML = optionsHtml;
        remarkFilter.value = currentValue;
    }

    // 处理网站图标上传
    handleFaviconUpload(event) {
        console.log('开始处理网站图标上传');
        const file = event.target.files[0];
        if (!file) {
            console.log('没有选择文件');
            return;
        }

        console.log('选择的文件:', file.name, file.type, file.size);

        // 检查文件类型 - 放宽限制，支持更多格式
        const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        const fileExtension = file.name.toLowerCase().split('.').pop();
        const allowedExtensions = ['ico', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            this.showNotification('请选择有效的图标文件（.ico, .png, .jpg, .gif, .webp）', 'error');
            return;
        }

        // 检查文件大小
        if (file.size > 500 * 1024) { // 500KB
            this.showNotification('图标文件过大，建议不超过500KB', 'warning');
        }

        // 显示处理中状态
        this.showNotification('正在处理图标文件...', 'info');

        // 读取文件并预览
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('文件读取完成');
            const dataUrl = e.target.result;
            this.previewFavicon(dataUrl);
            this.safeSetValue('faviconInput', dataUrl);
            this.showNotification('图标文件上传成功，请点击保存设置', 'success');
        };

        reader.onerror = (e) => {
            console.error('文件读取失败:', e);
            this.showNotification('文件读取失败，请重试', 'error');
        };

        reader.readAsDataURL(file);
    }

    // 预览网站图标
    previewFavicon(url) {
        console.log('预览网站图标:', url ? '有URL' : '无URL');
        const preview = document.getElementById('faviconPreview');

        if (!preview) {
            console.error('找不到 faviconPreview 元素');
            return;
        }

        if (!url) {
            preview.style.display = 'none';
            return;
        }

        preview.src = url;
        preview.style.display = 'block';
        console.log('图标预览已显示');

        // 成功加载处理
        preview.onload = () => {
            console.log('图标预览加载成功');
        };

        // 错误处理
        preview.onerror = () => {
            console.error('图标预览加载失败');
            preview.style.display = 'none';
            this.showNotification('无法加载图标预览', 'error');
        };
    }

    // 保存网站图标设置
    saveFaviconSettings() {
        const faviconUrl = document.getElementById('faviconInput').value.trim();
        
        try {
            // 保存到本地存储
            localStorage.setItem('vtuber_favicon', faviconUrl);
            
            // 更新当前页面的图标
            this.updateFavicon(faviconUrl);
            
            this.showNotification('网站图标设置已保存', 'success');
            
            // 通知主页面更新图标
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ 
                    type: 'faviconUpdated',
                    favicon: faviconUrl
                }, '*');
            }
        } catch (error) {
            console.error('Failed to save favicon:', error);
            this.showNotification('保存图标设置失败', 'error');
        }
    }

    // 更新网站图标
    updateFavicon(url) {
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzYzNjZmMSIvPjwvc3ZnPg==';
    }

    // 加载网站图标设置
    loadFaviconSettings() {
        const savedFavicon = localStorage.getItem('vtuber_favicon');
        if (savedFavicon) {
            document.getElementById('faviconInput').value = savedFavicon;
            this.previewFavicon(savedFavicon);
            this.updateFavicon(savedFavicon);
        }
    }
}

// 全局saveSettings函数
function saveSettings() {
    try {
        const prefixValue = document.getElementById('commandPrefix')?.value?.trim();
        const suffixValue = document.getElementById('commandSuffix')?.value?.trim();
        
        // 前缀不能为空，后缀允许为空
        const prefix = prefixValue || '/点歌';
        const suffix = suffixValue || ''; // 允许后缀为空
        
        const settings = {
            commandPrefix: prefix,
            commandSuffix: suffix
        };
        
        // 保存设置
        adminManager.saveCommandSettings(settings);
        
        // 更新预览
        adminManager.updateCommandPreview();
        
        // 显示成功提示
        adminManager.showNotification('点歌指令设置已保存', 'success');
        
        // 打印调试信息
        console.log('点歌指令设置已更新:', settings);
    } catch (error) {
        console.error('保存点歌指令设置失败:', error);
        adminManager.showNotification('保存设置失败，请重试', 'error');
    }
}

// 确保数据加载完成后再初始化管理界面
function initializeAdmin() {
    console.log('初始化管理界面，检查数据状态...');
    console.log('window.officialData 存在:', !!window.officialData);

    if (window.officialData) {
        console.log('数据已加载，开始初始化管理界面');
        window.adminManager = new AdminManager();
    } else {
        console.log('数据未加载，等待数据加载完成...');
        // 如果数据还没加载，等待一段时间后重试
        setTimeout(initializeAdmin, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAdmin();
});