/**
 * 虚拟主播歌单系统 - 前端主要逻辑
 * 版本: v2.0 (前后端分离架构)
 *
 * 核心功能：
 * - 歌曲展示与智能筛选
 * - 点歌指令自动生成
 * - 主题切换 (明暗模式)
 * - 个人资料动态展示
 * - 实时API数据同步
 * - 响应式设计适配
 * - 备案信息展示
 */

/**
 * 虚拟主播歌单应用主类
 * 负责整个前端应用的状态管理和用户交互
 */
class VTuberPlaylist {
    /**
     * 初始化歌单系统
     * 设置应用状态、配置参数并启动异步初始化流程
     * @constructor
     */
    constructor() {
        // 应用核心数据状态
        this.profile = {};            // 主播个人资料
        this.songs = [];              // 歌曲数据列表
        this.genres = [];             // 风格分类数据
        this.notes = [];              // 备注分类数据
        this.searchTerm = '';         // 当前搜索关键词

        // 点歌指令配置
        this.settings = {
            commandPrefix: '/点歌',   // 指令前缀
            commandSuffix: ''        // 指令后缀
        };

        // 检测设备类型并设置相应的CSS类
        this.detectDeviceAndSetClasses();

        // 启动异步初始化流程
        this.initAsync();
    }

    /**
     * 异步初始化方法
     * 按顺序执行数据加载、组件初始化和页面渲染
     * @async
     */
    async initAsync() {
        try {
            console.log('开始异步初始化...');

            // 步骤1: 加载基础数据 (歌曲、个人资料等)
            this.loadData();
            console.log('基础数据加载完成');

            // 步骤2: 等待风格管理器初始化完成
            await window.simpleGenreManager.initialize();
            console.log('SimpleGenreManager 初始化完成，开始渲染页面');

            // 步骤3: 绑定用户交互事件
            this.bindEvents();
            this.updateFilterOptions();
            this.updateGenreNavigation(); // 确保风格导航正确更新
            this.filteredSongs = this.songs;
            this.renderPlaylist();
            this.updateProfile();

            // 4. 加载其他设置
            await this.loadThemeFromAPI(); // 从API加载主题
            this.loadSettings();
            this.loadFavicon();
            this.loadBeianInfo();

            // 5. 启动定期数据同步
            this.startDataSync();

            console.log('页面初始化完成');
        } catch (error) {
            console.error('页面初始化失败:', error);
        }
    }

    /**
     * 加载基础数据
     * 从全局数据对象中加载个人资料和歌曲数据
     */
    loadData() {
        // 从全局数据对象加载主播个人资料
        this.profile = window.officialData.profile || {};

        // 加载歌曲数据并按首字母排序
        this.songs = this.sortSongsByFirstLetter(window.officialData.songs || []);
        console.log(`成功加载 ${this.songs.length} 首歌曲`);
    }

    /**
     * 系统初始化方法 (兼容性接口)
     * 为了保持向后兼容性而保留的方法
     * @async
     * @returns {Promise} 返回异步初始化的Promise
     */
    async init() {
        return this.initAsync();
    }

    /**
     * 设备检测和CSS类设置
     * 根据屏幕尺寸和方向为body元素添加相应的CSS类
     */
    detectDeviceAndSetClasses() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const ratio = width / height;
        
        // 添加视口宽度类
        if (width <= 375) {
            document.body.classList.add('viewport-small');
        } else if (width <= 414) {
            document.body.classList.add('viewport-medium');
        } else if (width <= 768) {
            document.body.classList.add('viewport-large');
        } else if (width <= 1024) {
            document.body.classList.add('viewport-tablet');
        } else {
            document.body.classList.add('viewport-desktop');
        }
        
        // 添加设备方向类
        if (ratio > 1) {
            document.body.classList.add('landscape');
        } else {
            document.body.classList.add('portrait');
        }
        
        // 监听窗口大小变化
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                // 移除所有视口类
                document.body.classList.remove('viewport-small', 'viewport-medium', 'viewport-large', 'viewport-tablet', 'viewport-desktop', 'landscape', 'portrait');
                // 重新检测
                this.detectDeviceAndSetClasses();
            }, 250);
        });
    }



    /**
     * 重新加载数据
     * 从全局数据对象重新加载个人资料和歌曲数据，并更新筛选选项
     */
    reloadData() {
        if (window.officialData) {
            this.profile = window.officialData.profile || {};
            this.songs = this.sortSongsByFirstLetter(window.officialData.songs || []);
            this.updateFilterOptions();
        }
    }

    /**
     * 强制重新加载data.js文件
     */
    async forceReloadDataJs() {
        try {
            console.log('强制重新加载 data.js...');

            // 移除旧的data.js脚本
            const oldScript = document.querySelector('script[src*="data.js"]');
            if (oldScript) {
                oldScript.remove();
            }

            // 创建新的script标签，添加时间戳防止缓存
            const newScript = document.createElement('script');
            newScript.src = `data.js?v=${Date.now()}`;

            // 等待脚本加载完成
            await new Promise((resolve, reject) => {
                newScript.onload = () => {
                    console.log('data.js 重新加载完成');
                    resolve();
                };
                newScript.onerror = () => {
                    console.error('data.js 重新加载失败');
                    reject(new Error('Failed to reload data.js'));
                };
                document.head.appendChild(newScript);
            });

            // 重新加载数据
            this.reloadData();
            this.renderPlaylist();
            this.updateProfile();

        } catch (error) {
            console.error('强制重新加载data.js失败:', error);
        }
    }

    /**
     * 按首字母排序歌曲
     * 支持中文、英文、数字的首字母排序，中文使用拼音首字母
     * @param {Array} songs - 歌曲数组
     * @returns {Array} 排序后的歌曲数组
     */
    sortSongsByFirstLetter(songs) {
        return songs.sort((a, b) => {
            // 获取首字母（支持中文、英文、数字）
            const getFirstLetter = (title) => {
                if (!title) return '';
                const first = title.charAt(0).toUpperCase();
                
                // 如果是数字开头，返回 '#'
                if (/^\d/.test(first)) return '#';
                
                // 如果是英文字母，直接返回
                if (/^[A-Z]$/.test(first)) return first;
                
                // 如果是中文，获取拼音首字母
                const pinyinMap = {
                    // 常用中文字符的拼音首字母映射
                    '阿': 'A', '爱': 'A', '安': 'A',
                    '把': 'B', '白': 'B', '百': 'B', '北': 'B',
                    '草': 'C', '层': 'C', '茶': 'C', '晨': 'C',
                    '大': 'D', '东': 'D', '等': 'D',
                    '儿': 'E', '而': 'E',
                    '发': 'F', '方': 'F', '风': 'F',
                    '歌': 'G', '哥': 'G', '高': 'G',
                    '好': 'H', '海': 'H', '红': 'H',
                    '见': 'J', '叫': 'J', '金': 'J',
                    '开': 'K', '看': 'K',
                    '来': 'L', '里': 'L', '路': 'L',
                    '么': 'M', '美': 'M', '妈': 'M',
                    '你': 'N', '年': 'N',
                    '哦': 'O',
                    '跑': 'P', '品': 'P',
                    '去': 'Q', '情': 'Q',
                    '人': 'R', '日': 'R',
                    '是': 'S', '说': 'S', '山': 'S',
                    '他': 'T', '天': 'T', '听': 'T',
                    '为': 'W', '我': 'W', '无': 'W',
                    '想': 'X', '小': 'X', '心': 'X',
                    '要': 'Y', '一': 'Y', '用': 'Y',
                    '在': 'Z', '中': 'Z', '做': 'Z'
                };
                
                // 查找中文字符的拼音首字母
                const pinyin = pinyinMap[first];
                if (pinyin) return pinyin;
                
                // 如果找不到对应的拼音，将中文字符放在最后
                return 'Z' + first;
            };

            const letterA = getFirstLetter(a.title);
            const letterB = getFirstLetter(b.title);

            // 首字母相同时，按原始标题排序
            if (letterA === letterB) {
                return a.title.localeCompare(b.title, 'zh-CN');
            }

            return letterA.localeCompare(letterB, 'en');
        });
    }

    /**
     * 绑定用户交互事件
     * 为页面元素添加事件监听器，处理用户操作和数据更新
     */
    bindEvents() {
        // 主题切换按钮事件
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 直播间跳转按钮事件
        const liveBtn = document.getElementById('liveBtn');
        if (liveBtn) {
            liveBtn.addEventListener('click', () => this.openLiveRoom());
        }

        // 风格筛选下拉框事件
        const genreSelect = document.getElementById('genreSelect');
        if (genreSelect) {
            genreSelect.addEventListener('change', (e) => {
                this.currentGenre = e.target.value;
                this.applyFilters();
            });
        }

        // 备注筛选下拉框事件
        const noteSelect = document.getElementById('noteSelect');
        if (noteSelect) {
            noteSelect.addEventListener('change', (e) => {
                this.currentNote = e.target.value;
                this.applyFilters();
            });
        }

        // 搜索输入框事件
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // 监听自定义事件（用于同一页面内的数据更新）
        window.addEventListener('dataUpdated', () => {
            this.renderPlaylist();
            this.updateProfile();
        });

        // 监听来自后台的消息
        window.addEventListener('message', async (event) => {
            if (event.data) {
                switch (event.data.type) {
                    case 'profileUpdated':
                        this.reloadData();
                        this.renderPlaylist();
                        this.updateProfile();
                        break;
                    case 'dataUpdated':
                        this.reloadData();
                        this.renderPlaylist();
                        this.updateProfile();
                        break;
                    case 'forceDataReload':
                        // 强制重新加载data.js文件
                        console.log('收到强制数据重载消息');
                        await this.forceReloadDataJs();
                        break;
                    case 'genreDataUpdated':
                        // 风格数据更新，刷新 SimpleGenreManager
                        await window.simpleGenreManager.refresh();
                        this.updateGenreNavigation();
                        this.renderPlaylist(); // 重新渲染歌曲以更新风格显示
                        showGeneralNotification('风格数据已更新', 'success');
                        break;
                    case 'faviconUpdated':
                        if (event.data.favicon) {
                            this.updateFavicon(event.data.favicon);
                        }
                        break;
                    case 'beianUpdated':
                        if (event.data.settings) {
                            this.updateBeianInfo(event.data.settings);
                        }
                        break;
                }
            }
        });

        // 监听跨标签页的风格数据更新
        if (typeof BroadcastChannel !== 'undefined') {
            const genreChannel = new BroadcastChannel('vup-playlist-genres');
            genreChannel.addEventListener('message', async (event) => {
                if (event.data.type === 'genreDataUpdated') {
                    await window.simpleGenreManager.refresh();
                    this.updateGenreNavigation();
                    this.renderPlaylist();
                    showGeneralNotification('风格数据已同步更新', 'info');
                }
            });
        }

        // 监听 GenreManager 的风格更新事件
        window.addEventListener('genresUpdated', (event) => {
            console.log('收到风格更新事件，刷新页面显示...');
            this.updateGenreNavigation();
            this.renderPlaylist();
            showGeneralNotification('风格数据已更新', 'success');
        });

        // 定期检查风格数据更新（作为备用机制）
        this.setupPeriodicGenreCheck();

        // 监听来自后台的设置更新
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'settingsUpdated') {
                console.log('收到设置更新消息:', event.data.settings);
                // 更新设置
                this.settings = {
                    commandPrefix: event.data.settings.commandPrefix || '/点歌',
                    commandSuffix: event.data.settings.commandSuffix || ''
                };
                // 保存到localStorage以便刷新后保持
                localStorage.setItem('vtuber_command_settings', JSON.stringify(this.settings));
                // 重新渲染歌单以更新点歌指令格式
                this.renderPlaylist();
                console.log('设置已更新，当前设置:', this.settings);
            } else if (event.data && event.data.type === 'themeUpdated') {
                console.log('收到主题更新消息:', event.data.theme);
                // 更新主题
                this.applyTheme(event.data.theme);
                localStorage.setItem('vtuber_theme', event.data.theme);
                this.updateThemeButton();
                console.log('主题已更新为:', event.data.theme);
            }
        });

        // 隐藏的后台管理快捷键 (Ctrl+Alt+A)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                window.open('admin.html', '_blank');
                showNotification('正在打开后台管理...', 'info');
            }
        });

        // 监听页面可见性变化，当页面重新可见时检查数据更新
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.reloadData();
                this.renderPlaylist();
                this.updateProfile();
            }
        });

        console.log('虚拟主播歌单应用已加载完成');
    }

    /**
     * 启动数据同步
     * 定期检查服务器数据更新
     */
    startDataSync() {
        // 每30秒检查一次数据更新
        setInterval(async () => {
            await this.syncDataFromServer();
        }, 30000);

        // 页面获得焦点时也检查数据更新
        window.addEventListener('focus', async () => {
            await this.syncDataFromServer();
        });
    }

    /**
     * 从服务器同步数据
     */
    async syncDataFromServer() {
        try {
            // 检查主题设置
            const settingsResponse = await fetch('/api/settings');
            if (settingsResponse.ok) {
                const settingsResult = await settingsResponse.json();
                const serverTheme = settingsResult.data.settings.theme || 'light';
                const localTheme = localStorage.getItem('vtuber_theme') || 'light';

                if (serverTheme !== localTheme) {
                    console.log(`检测到主题更新: ${localTheme} -> ${serverTheme}`);
                    localStorage.setItem('vtuber_theme', serverTheme);
                    this.applyTheme(serverTheme);
                    this.updateThemeButton();
                }
            }

            // 检查歌曲数据更新
            const songsResponse = await fetch('/api/songs');
            if (songsResponse.ok) {
                const songsResult = await songsResponse.json();
                const serverSongs = songsResult.data.songs || [];

                // 比较服务器数据和当前数据
                if (JSON.stringify(serverSongs) !== JSON.stringify(this.songs)) {
                    console.log(`检测到歌曲数据更新: ${this.songs.length} -> ${serverSongs.length} 首歌曲`);
                    this.songs = this.sortSongsByFirstLetter(serverSongs);
                    this.renderPlaylist();
                    this.updateFilterOptions();
                }
            }

            // 检查个人资料更新
            const profileResponse = await fetch('/api/profile');
            if (profileResponse.ok) {
                const profileResult = await profileResponse.json();
                const serverProfile = profileResult.data.profile || {};

                // 比较服务器数据和当前数据
                if (JSON.stringify(serverProfile) !== JSON.stringify(this.profile)) {
                    console.log('检测到个人资料更新');
                    this.profile = serverProfile;
                    this.updateProfile();
                }
            }

        } catch (error) {
            console.error('数据同步失败:', error);
        }
    }

    /**
     * 设置定期检查风格数据更新
     */
    setupPeriodicGenreCheck() {
        // 每30秒检查一次风格数据是否有更新
        setInterval(async () => {
            try {
                await window.simpleGenreManager.refresh();
            } catch (error) {
                console.log('定期风格数据检查失败:', error);
            }
        }, 30000); // 30秒
    }



    /**
     * 主题切换功能
     * 在明暗主题之间切换，并同步到服务器和本地存储
     * @async
     */
    async toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        this.applyTheme(newTheme);
        localStorage.setItem('vtuber_theme', newTheme);

        // 更新主题按钮状态
        this.updateThemeButton();

        // 同步主题到服务器（仅在管理员登录时）
        try {
            // 检查是否有管理员会话
            const adminSession = localStorage.getItem('vtuber_admin_session');
            if (adminSession) {
                const session = JSON.parse(adminSession);
                // 设置认证令牌
                localStorage.setItem('auth_token', session.token);

                // 使用API客户端同步主题
                const result = await apiClient.put('/settings', { theme: newTheme });

                if (result.success) {
                    console.log('主题已同步到服务器:', newTheme);
                    // 通知后台页面主题更新（如果后台页面是打开的）
                    try {
                        window.postMessage({
                            type: 'themeUpdatedFromFrontend',
                            theme: newTheme
                        }, '*');
                    } catch (error) {
                        // 忽略错误，可能没有后台窗口打开
                    }
                } else {
                    console.log('主题同步失败，但不影响前端显示');
                }
            } else {
                console.log('未登录管理员，跳过主题同步到服务器');
            }
        } catch (error) {
            console.log('同步主题到服务器时出错，但不影响前端显示:', error.message);
        }

        // 添加切换动画
        document.body.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 400);
    }

    /**
     * 从API加载主题设置
     * 优先从服务器获取主题配置，失败时使用本地备用方案
     * @async
     */
    async loadThemeFromAPI() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const result = await response.json();
                const serverTheme = result.data.settings.theme || 'light';

                // 如果服务器主题与本地不同，使用服务器主题
                const localTheme = localStorage.getItem('vtuber_theme') || 'light';
                if (serverTheme !== localTheme) {
                    console.log(`主题同步: ${localTheme} -> ${serverTheme}`);
                    localStorage.setItem('vtuber_theme', serverTheme);
                }

                this.applyTheme(serverTheme);
                this.updateThemeButton();
            } else {
                // API失败时回退到data.js中的主题设置
                this.loadThemeFromDataJs();
            }
        } catch (error) {
            console.error('从API加载主题失败:', error);
            // API失败时回退到data.js中的主题设置
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

                this.applyTheme(dataJsTheme);
                this.updateThemeButton();
            } else {
                // 最终回退到本地主题
                this.loadTheme();
            }
        } catch (error) {
            console.error('从data.js加载主题失败:', error);
            // 最终回退到本地主题
            this.loadTheme();
        }
    }

    // 加载主题（本地回退方法）
    loadTheme() {
        const savedTheme = localStorage.getItem('vtuber_theme') || 'light';
        this.applyTheme(savedTheme);
        this.updateThemeButton();
    }

    // 应用主题
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    // 更新主题按钮状态
    updateThemeButton() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;
        
        const icon = themeToggle.querySelector('.icon');
        const text = themeToggle.querySelector('.text');
        
        const currentTheme = document.documentElement.getAttribute('data-theme');
        
        if (currentTheme === 'dark') {
            icon.textContent = '☀️';
            if (text) text.textContent = '白天模式';
        } else {
            icon.textContent = '🌙';
            if (text) text.textContent = '夜间模式';
        }
    }

    /**
     * 应用筛选条件
     * 根据当前的风格、备注和搜索条件筛选歌曲，并重新渲染歌单
     */
    applyFilters() {
        this.filteredSongs = this.songs.filter(song => {
            // 风格筛选匹配
            const matchesGenre = !this.currentGenre || this.currentGenre === 'all' || song.genre === this.currentGenre;

            // 备注筛选匹配
            const matchesNote = !this.currentNote || this.currentNote === 'all' || song.note === this.currentNote;

            // 搜索关键词匹配 (支持歌名、歌手、备注搜索)
            const matchesSearch = !this.searchTerm ||
                song.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                song.artist.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                (song.note && song.note.toLowerCase().includes(this.searchTerm.toLowerCase()));

            return matchesGenre && matchesNote && matchesSearch;
        });

        // 重新渲染筛选后的歌单
        this.renderPlaylist();
    }

    /**
     * 更新筛选选项
     * 根据当前歌曲数据动态生成风格和备注的筛选选项
     */
    updateFilterOptions() {
        // 更新风格选项
        const genreSelect = document.getElementById('genreSelect');
        if (genreSelect) {
            const genres = new Set(this.songs.map(song => song.genre));
            const genreOptions = ['<option value="all">全部</option>'];
            genres.forEach(genre => {
                const escapedGenre = this.escapeHtml(genre);
                const escapedDisplayName = this.escapeHtml(this.getGenreDisplayName(genre));
                genreOptions.push(`<option value="${escapedGenre}">${escapedDisplayName}</option>`);
            });
            genreSelect.innerHTML = genreOptions.join('');
        }

        // 更新备注选项
        const noteSelect = document.getElementById('noteSelect');
        if (noteSelect) {
            const notes = new Set(this.songs.map(song => song.note));
            const noteOptions = ['<option value="all">全部</option>'];
            notes.forEach(note => {
                if (note && note.trim()) {
                    const escapedNote = this.escapeHtml(note);
                    noteOptions.push(`<option value="${escapedNote}">${escapedNote}</option>`);
                }
            });
            noteSelect.innerHTML = noteOptions.join('');
        }
    }

    /**
     * 渲染歌单
     * 将筛选后的歌曲数据渲染到页面上，包括歌曲信息和点歌指令
     */
    renderPlaylist() {
        const playlistContent = document.getElementById('playlistContent');
        const songCount = document.getElementById('songCount');
        
        if (!playlistContent || !songCount) return;
        
        // 清空现有内容
        playlistContent.innerHTML = '';
        
        const songsToRender = this.filteredSongs || this.songs;

        // 渲染歌曲列表
        songsToRender.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            
            const title = this.escapeHtml(song.title);
            const artist = this.escapeHtml(song.artist);
            
            songItem.innerHTML = `
                <div class="song-title" data-song-id="${this.escapeHtml(song.id)}">${title}</div>
                <div class="song-artist">${artist}</div>
                <div class="song-genre-cell">
                    <div class="song-genre">${this.escapeHtml(this.getGenreDisplayName(song.genre))}</div>
                </div>
                <div class="song-note">${this.escapeHtml(song.note)}</div>
                <div class="song-command">
                    <button class="command-btn">复制指令</button>
                </div>
            `;
            
            // 绑定复制指令事件
            const copyBtn = songItem.querySelector('.command-btn');
            copyBtn.addEventListener('click', () => this.copyCommand(title, artist, song.id));
            
            // 为移动端添加歌名点击复制功能
            const songTitle = songItem.querySelector('.song-title');
            if (this.isMobile()) {
                songTitle.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleMobileTitleClick(songTitle, title, artist, song.id);
                });
                
                // 添加触摸反馈
                songTitle.addEventListener('touchstart', (e) => {
                    songTitle.classList.add('active');
                });
                
                songTitle.addEventListener('touchend', (e) => {
                    setTimeout(() => {
                        songTitle.classList.remove('active');
                    }, 150);
                });
            }
            
            playlistContent.appendChild(songItem);
        });
        
        // 更新歌曲数量
        songCount.textContent = `共 ${songsToRender.length} 首歌曲`;
    }



    /**
     * 获取所有风格分类
     * 从SimpleGenreManager获取内置和自定义风格的完整列表
     * @returns {Array} 风格对象数组，包含id、name和displayName属性
     */
    getAllGenres() {
        return window.simpleGenreManager.getAllGenres().map(g => ({
            id: g.id,
            name: g.name,
            emoji: '🎵'
        }));
    }

    /**
     * 更新风格导航选择框
     * 根据当前歌曲数据动态生成风格筛选选项，包含歌曲数量统计
     */
    updateGenreNavigation() {
        const genreSelect = document.getElementById('genreSelect');
        if (!genreSelect) return;

        // 统计每个风格的歌曲数量
        const genreCount = {};
        this.songs.forEach(song => {
            const genre = song.genre || 'unknown';
            genreCount[genre] = (genreCount[genre] || 0) + 1;
        });

        // 获取当前选中的值
        const currentValue = genreSelect.value;

        // 更新选择框选项
        let optionsHTML = '<option value="all">🌟 全部</option>';
        
        const allGenres = this.getAllGenres();

        allGenres.forEach(genre => {
            const count = genreCount[genre.id] || 0;
            if (count > 0) {
                optionsHTML += `<option value="${genre.id}">${genre.emoji} ${genre.name} (${count})</option>`;
            }
        });

        // 添加其他未分类的风格
        Object.keys(genreCount).forEach(genreId => {
            if (!allGenres.find(g => g.id === genreId) && genreId !== 'unknown') {
                const count = genreCount[genreId];
                const escapedGenreId = this.escapeHtml(genreId);
                optionsHTML += `<option value="${escapedGenreId}">🎵 ${escapedGenreId} (${count})</option>`;
            }
        });

        genreSelect.innerHTML = optionsHTML;
        genreSelect.value = currentValue;
    }

    // 处理歌曲点击
    handleSongClick(songId) {
        const song = this.songs.find(s => s.id == songId);
        if (song) {
            // 这里可以添加播放功能或其他交互
            console.log('点击歌曲:', song);
            
            // 添加点击效果
            const songElement = document.querySelector(`[data-id="${songId}"]`);
            songElement.style.transform = 'scale(0.98)';
            setTimeout(() => {
                songElement.style.transform = '';
            }, 150);
        }
    }

    /**
     * 检测是否为移动设备
     * 通过屏幕宽度和用户代理字符串判断设备类型
     * @returns {boolean} 是否为移动设备
     */
    isMobile() {
        return window.innerWidth <= 768 ||
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * 处理移动端歌名点击事件
     * 在移动设备上点击歌名时复制点歌指令
     * @param {Element} titleElement - 歌名元素
     * @param {string} title - 歌曲标题
     * @param {string} artist - 歌手名称
     * @param {string} songId - 歌曲ID
     */
    handleMobileTitleClick(titleElement, title, artist, songId) {
        // 防止重复点击
        if (titleElement.classList.contains('copying')) {
            return;
        }
        
        titleElement.classList.add('copying');
        
        // 复制点歌指令
        this.copyCommand(title, artist, songId);
        
        // 显示移动端专用的复制提示
        this.showMobileCopyNotification(title);
        
        // 移除复制状态
        setTimeout(() => {
            titleElement.classList.remove('copying');
        }, 1000);
    }

    // 显示移动端复制成功提示
    showMobileCopyNotification(title) {
        // 移除现有的通知（如果有）
        const existingNotification = document.querySelector('.copy-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新的通知
        const notification = document.createElement('div');
        notification.className = 'copy-notification success';
        notification.innerHTML = `
            <span class="icon">🎵</span>
            <span class="text">已复制《${title}》的点歌指令</span>
        `;
        document.body.appendChild(notification);

        // 触发动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // 3秒后移除通知
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    /**
     * 获取风格显示名称
     * 通过SimpleGenreManager获取风格的友好显示名称
     * @param {string} genre - 风格ID
     * @returns {string} 风格显示名称
     */
    getGenreDisplayName(genre) {
        return window.simpleGenreManager.getDisplayName(genre);
    }

    /**
     * HTML转义函数
     * 防止XSS攻击，将特殊字符转换为HTML实体
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的HTML安全文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 更新主播资料显示
     * 根据个人资料数据更新页面上的所有相关元素
     */
    updateProfile() {
        const profile = this.profile;
        
        // 更新网站标题
        const customTitle = profile.websiteTitle && profile.websiteTitle.trim() !== '';
        const websiteTitle = customTitle ? profile.websiteTitle : '虚拟主播歌单';
        
        // 更新页面标题
        document.title = websiteTitle;
        
        // 更新页面顶部的logo文字
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.textContent = websiteTitle;
        }
        
        // 更新头像
        const avatar = document.getElementById('vtuberAvatar');
        if (avatar && profile.avatar) {
            avatar.src = profile.avatar;
            avatar.onerror = () => {
                avatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMTAwIiBmaWxsPSIjNjM2NmYxIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOCIvPgo8Y2lyY2xlIGN4PSI4NSIgY3k9Ijg1IiByPSI4IiBmaWxsPSIjNjM2NmYxIi8+CjxjaXJjbGUgY3g9IjExNSIgY3k9Ijg1IiByPSI4IiBmaWxsPSIjNjM2NmYxIi8+CjxwYXRoIGQ9Ik04NSAxMTVDODUgMTE1IDkyLjUgMTI1IDEwMCAxMjVDMTA3LjUgMTI1IDExNSAxMTUgMTE1IDExNSIgc3Ryb2tlPSIjNjM2NmYxIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
            };
        }

        // 更新名称
        const name = document.getElementById('vtuberName');
        if (name && profile.vtuberName) {
            name.textContent = profile.vtuberName;
        }

        // 更新UID
        const uid = document.getElementById('vtuberUid');
        if (uid && profile.vtuberUid) {
            uid.textContent = `UID: ${profile.vtuberUid}`;
        }

        // 更新生日
        const birthday = document.getElementById('vtuberBirthday');
        if (birthday && profile.vtuberBirthday) {
            birthday.textContent = `🎂 生日: ${profile.vtuberBirthday}`;
        }

        // 更新描述
        const description = document.getElementById('vtuberDescription');
        if (description && profile.vtuberDesc) {
            description.textContent = profile.vtuberDesc;
        }

        // 更新直播间按钮状态
        this.updateLiveRoomButton(profile.liveRoomUrl);

        // 更新背景
        if (profile.background && profile.background.trim() !== '') {
            console.log('设置背景图片:', profile.background);
            
            // 确保移除可能的CSS背景设置，用内联样式覆盖
            document.body.style.setProperty('background-image', `url("${profile.background}")`, 'important');
            document.body.style.setProperty('background-size', 'cover', 'important');
            document.body.style.setProperty('background-position', 'center', 'important');
            document.body.style.setProperty('background-attachment', 'fixed', 'important');
            document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
            
            // 降低装饰层透明度
            const decorLayers = document.querySelectorAll('.kawaii-decor-1, .kawaii-decor-2, .kawaii-decor-3');
            decorLayers.forEach(layer => {
                layer.style.opacity = '0.3';
            });
            
            console.log('背景图样式已应用，当前body style:', document.body.style.backgroundImage);
        } else {
            console.log('清除背景图片');
            document.body.style.removeProperty('background-image');
            document.body.style.removeProperty('background-size');
            document.body.style.removeProperty('background-position');
            document.body.style.removeProperty('background-attachment');
            document.body.style.removeProperty('background-repeat');
            
            // 恢复装饰层透明度
            const decorLayers = document.querySelectorAll('.kawaii-decor-1, .kawaii-decor-2, .kawaii-decor-3');
            decorLayers.forEach(layer => {
                layer.style.opacity = '';
            });
        }
    }

    /**
     * 打开直播间
     * 在新标签页中打开主播的直播间链接
     */
    openLiveRoom() {
        const profile = this.profile;
        const liveRoomUrl = profile.liveRoomUrl;

        if (liveRoomUrl && liveRoomUrl.trim() !== '') {
            // 在新标签页打开直播间链接
            window.open(liveRoomUrl, '_blank');
            showNotification('正在跳转到直播间...', 'success');
        } else {
            showNotification('直播间链接未设置，请在后台管理中配置', 'warning');
        }
    }

    /**
     * 更新直播间按钮状态
     * 根据是否设置了直播间链接来更新按钮的显示状态
     * @param {string} liveRoomUrl - 直播间链接
     */
    updateLiveRoomButton(liveRoomUrl) {
        const liveBtn = document.getElementById('liveBtn');
        if (liveBtn) {
            if (liveRoomUrl && liveRoomUrl.trim() !== '') {
                // 有链接时显示正常状态
                liveBtn.style.opacity = '1';
                liveBtn.style.cursor = 'pointer';
                liveBtn.setAttribute('title', '点击进入直播间');
            } else {
                // 无链接时显示禁用状态
                liveBtn.style.opacity = '0.6';
                liveBtn.style.cursor = 'default';
                liveBtn.setAttribute('title', '直播间链接未设置');
            }
        }
    }

    /**
     * 处理搜索功能
     * 设置搜索关键词并重新应用筛选条件
     * @param {string} term - 搜索关键词
     */
    handleSearch(term) {
        this.searchTerm = term;
        this.applyFilters();
    }

    /**
     * 格式化点歌指令
     * 根据设置的前缀和后缀格式化点歌指令文本
     * @param {string} title - 歌曲标题
     * @param {string} artist - 歌手名称
     * @returns {string} 格式化后的点歌指令
     */
    formatCommand(title, artist) {
        const prefix = this.settings.commandPrefix || '/点歌';
        const suffix = this.settings.commandSuffix || '';
        
        // 如果后缀为空，则不包含后缀部分
        if (suffix.trim() === '') {
            return `${prefix} ${title}`;
        } else {
            return `${prefix} ${title} ${suffix} ${artist}`;
        }
    }

    /**
     * 复制点歌指令到剪贴板
     * 使用现代Clipboard API或降级方案复制指令文本
     * @param {string} title - 歌曲标题
     * @param {string} artist - 歌手名称
     * @param {string} songId - 歌曲ID (未使用，保留兼容性)
     */
    copyCommand(title, artist, songId) {
        const command = this.formatCommand(title, artist);

        // 优先使用现代Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(command).then(() => {
                this.showCopyNotification();
            });
        } else {
            // 降级使用传统复制方法
            const success = this.fallbackCopyCommand(command);
            if (success) {
                this.showCopyNotification();
            }
        }
    }

    /**
     * 显示复制成功提示
     * 创建并显示一个临时的成功提示通知
     */
    showCopyNotification() {
        // 移除现有的通知（如果有）
        const existingNotification = document.querySelector('.copy-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新的通知
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.innerHTML = `
            <span class="icon">✓</span>
            <span>点歌指令已复制</span>
        `;
        document.body.appendChild(notification);

        // 触发动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // 3秒后移除通知
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    /**
     * 降级复制方案
     * 当现代Clipboard API不可用时使用的传统复制方法
     * @param {string} command - 要复制的指令文本
     * @returns {boolean} 是否复制成功
     */
    fallbackCopyCommand(command) {
        const textarea = document.createElement('textarea');
        textarea.value = command;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            document.body.removeChild(textarea);
            return false;
        }
    }

    /**
     * 加载点歌指令设置
     * 从localStorage加载用户自定义的点歌指令格式设置
     */
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('vtuber_command_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.settings = {
                    commandPrefix: settings.commandPrefix || '/点歌',
                    commandSuffix: settings.commandSuffix || ''
                };
                console.log('已加载点歌指令设置:', this.settings);
            } else {
                // 使用默认设置
                this.settings = {
                    commandPrefix: '/点歌',
                    commandSuffix: ''
                };
                console.log('使用默认点歌指令设置:', this.settings);
            }
        } catch (error) {
            console.error('加载点歌指令设置失败:', error);
            // 出错时使用默认设置
            this.settings = {
                commandPrefix: '/点歌',
                commandSuffix: ''
            };
        }
    }

    /**
     * 加载网站图标
     * 从localStorage加载用户自定义的网站图标
     */
    loadFavicon() {
        const savedFavicon = localStorage.getItem('vtuber_favicon');
        if (savedFavicon) {
            this.updateFavicon(savedFavicon);
        }
    }

    /**
     * 更新网站图标
     * 动态更新页面的favicon图标
     * @param {string} url - 图标URL，如果为空则使用默认图标
     */
    updateFavicon(url) {
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzYzNjZmMSIvPjwvc3ZnPg==';
    }

    /**
     * 加载备案信息
     * 从localStorage加载备案信息设置并更新页面显示
     */
    loadBeianInfo() {
        const settings = this.getBeianSettings();
        this.updateBeianInfo(settings);
    }

    /**
     * 获取备案信息设置
     * 从localStorage获取备案信息配置，如果不存在则返回默认配置
     * @returns {Object} 备案信息配置对象
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
     * 更新备案信息显示
     * 根据配置动态生成备案信息HTML并更新到页面
     * @param {Object} settings - 备案信息配置
     */
    updateBeianInfo(settings) {
        const container = document.getElementById('beianInfo');
        if (!container) return;

        let html = '';

        // 版权信息（最左边）
        html += '<a href="https://github.com/judgeLC/VupPlaylist" target="_blank" rel="nofollow">@irislc于2025</a>';

        // ICP备案信息
        if (settings.icp) {
            html += '<span class="separator">|</span>';
            html += `<a href="${settings.icpLink}" target="_blank" rel="nofollow">${settings.icp}</a>`;
        }

        // 公安备案信息
        if (settings.police) {
            html += '<span class="separator">|</span>';
            html += `
                <a href="${settings.policeLink}" target="_blank" rel="nofollow">
                    <img class="police-icon" src="data:image/png;base64,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">
                    ${settings.police}
                </a>
            `;
        }

        container.innerHTML = html;
    }
}

/**
 * 显示通用通知
 * 在页面右上角显示一个临时的通知消息
 * @param {string} message - 通知消息内容
 * @param {string} type - 通知类型 ('info', 'success', 'warning', 'error')
 */
function showGeneralNotification(message, type = 'info') {
    // 创建通知元素
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

    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏 (3秒后)
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

/**
 * 应用初始化函数
 * 确保数据加载完成后再初始化VTuberPlaylist应用
 * @async
 */
async function initializeApp() {
    console.log('初始化应用，检查数据状态...');
    console.log('window.officialData 存在:', !!window.officialData);

    if (window.officialData) {
        console.log('数据已加载，开始初始化应用');

        // 初始化歌单应用
        window.vtuberPlaylist = new VTuberPlaylist();

        // 等待应用完全初始化
        console.log('等待应用异步初始化完成...');

        // 添加页面加载动画
        const cards = document.querySelectorAll('.glass-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';

            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 150);
        });
    } else {
        console.log('数据未加载，等待数据加载完成...');
        // 如果数据还没加载，等待一段时间后重试
        setTimeout(initializeApp, 100);
    }
}

/**
 * 页面DOM加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * 页面完全加载后清理会话数据
 */
window.addEventListener('load', () => {
    sessionStorage.removeItem('isReloading');
});

/**
 * 注释说明：
 * 以下功能已在v2.0架构中移除或重构：
 * - localStorage监听机制 (已改为服务器端同步)
 * - 全局函数导出 (已改为模块化设计)
 * - 跨标签页通信 (已改为BroadcastChannel API)
 */