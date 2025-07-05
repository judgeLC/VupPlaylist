/**
 * 统一的风格数据管理器
 * 解决风格数据同步和显示问题的核心组件
 */
class GenreManager {
    constructor() {
        this.genres = new Map(); // 使用Map提高查找性能
        this.initialized = false;
        this.version = '3.2'; // 新版本号
        this.cacheKey = 'vtuber_genres_v3';
        this.versionKey = 'vtuber_genre_version';

        console.log('GenreManager 初始化');

        // 设置跨页面通信监听
        this.setupCrossPageCommunication();
    }

    /**
     * 初始化风格数据
     * 数据源优先级: data.js > API > localStorage > 默认数据
     */
    async initialize() {
        if (this.initialized) {
            console.log('GenreManager 已初始化，跳过');
            return;
        }

        console.log('开始初始化风格数据...');
        
        try {
            // 1. 首先尝试从 data.js 加载
            if (await this.loadFromDataJs()) {
                console.log('✓ 从 data.js 加载风格数据成功');
            }
            // 2. 如果 data.js 没有数据，尝试从 API 加载
            else if (await this.loadFromAPI()) {
                console.log('✓ 从 API 加载风格数据成功');
            }
            // 3. 如果 API 也没有，尝试从 localStorage 加载
            else if (this.loadFromCache()) {
                console.log('✓ 从缓存加载风格数据成功');
            }
            // 4. 最后使用默认数据
            else {
                this.loadDefaultGenres();
                console.log('✓ 使用默认风格数据');
            }

            // 保存到缓存
            this.saveToCache();
            this.initialized = true;
            
            console.log(`风格数据初始化完成，共 ${this.genres.size} 个风格`);
            this.logGenres();
            
        } catch (error) {
            console.error('风格数据初始化失败:', error);
            // 出错时使用默认数据
            this.loadDefaultGenres();
            this.initialized = true;
        }
    }

    /**
     * 从 data.js 加载风格数据
     */
    async loadFromDataJs() {
        return new Promise((resolve) => {
            // 等待 data.js 加载完成
            const checkData = () => {
                if (window.officialData && window.officialData.customGenres) {
                    const genres = window.officialData.customGenres;
                    if (Array.isArray(genres) && genres.length > 0) {
                        console.log(`从 data.js 加载了 ${genres.length} 个风格:`, genres.map(g => `${g.name}(${g.id})`));
                        this.setGenres(genres);
                        resolve(true);
                        return;
                    }
                }

                // 如果数据还没加载，等待一段时间后重试
                if (this.retryCount < 50) { // 最多等待5秒
                    this.retryCount = (this.retryCount || 0) + 1;
                    setTimeout(checkData, 100);
                } else {
                    resolve(false);
                }
            };

            checkData();
        });
    }

    /**
     * 从服务器重新加载最新的 data.js
     */
    async reloadFromServer() {
        try {
            console.log('从服务器重新加载风格数据...');

            // 添加时间戳避免缓存
            const timestamp = Date.now();
            const response = await fetch(`/data.js?t=${timestamp}`);
            const text = await response.text();

            // 解析 data.js 内容
            const match = text.match(/window\.officialData\s*=\s*({[\s\S]*?});/);
            if (match) {
                const dataStr = match[1];
                const data = eval('(' + dataStr + ')');

                if (data.customGenres && Array.isArray(data.customGenres)) {
                    console.log(`从服务器重新加载了 ${data.customGenres.length} 个风格`);
                    this.setGenres(data.customGenres);
                    this.saveToCache();
                    return true;
                }
            }

            console.warn('服务器数据格式不正确');
            return false;
        } catch (error) {
            console.error('从服务器重新加载风格数据失败:', error);
            return false;
        }
    }

    /**
     * 从 API 加载风格数据
     */
    async loadFromAPI() {
        try {
            const response = await fetch('/api/genres');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.setGenres(result.data);
                    return true;
                }
            }
        } catch (error) {
            console.log('从 API 加载风格数据失败:', error.message);
        }
        return false;
    }

    /**
     * 从缓存加载风格数据
     */
    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            const version = localStorage.getItem(this.versionKey);
            
            if (cached && version === this.version) {
                const genres = JSON.parse(cached);
                if (Array.isArray(genres) && genres.length > 0) {
                    this.setGenres(genres);
                    return true;
                }
            }
        } catch (error) {
            console.log('从缓存加载风格数据失败:', error.message);
        }
        return false;
    }

    /**
     * 加载默认风格数据
     */
    loadDefaultGenres() {
        const defaultGenres = [
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
        this.setGenres(defaultGenres);
    }

    /**
     * 设置风格数据
     */
    setGenres(genresArray) {
        this.genres.clear();
        genresArray.forEach(genre => {
            if (genre.id && genre.name) {
                this.genres.set(genre.id, {
                    id: genre.id,
                    name: genre.name,
                    builtIn: genre.builtIn || false
                });
            }
        });
    }

    /**
     * 保存到缓存
     */
    saveToCache() {
        try {
            const genresArray = Array.from(this.genres.values());
            localStorage.setItem(this.cacheKey, JSON.stringify(genresArray));
            localStorage.setItem(this.versionKey, this.version);
            
            // 清理旧版本的缓存
            localStorage.removeItem('vtuber_custom_genres');
            localStorage.removeItem('vtuber_data_version');
        } catch (error) {
            console.error('保存风格数据到缓存失败:', error);
        }
    }

    /**
     * 获取风格显示名称
     * 这是最重要的方法，用于将风格ID转换为显示名称
     */
    getDisplayName(genreId) {
        if (!genreId || genreId.trim() === '') {
            return '/';
        }

        const genre = this.genres.get(genreId);
        if (!genre) {
            console.warn(`未找到风格 ID: ${genreId}，当前已加载的风格:`, Array.from(this.genres.keys()));
        }
        return genre ? genre.name : genreId;
    }

    /**
     * 获取所有风格
     */
    getAllGenres() {
        return Array.from(this.genres.values());
    }

    /**
     * 添加新风格
     */
    addGenre(name) {
        const id = 'custom_' + Date.now();
        const genre = { id, name, builtIn: false };
        this.genres.set(id, genre);
        this.saveToCache();
        this.notifyDataUpdate();
        return genre;
    }

    /**
     * 删除风格
     */
    deleteGenre(genreId) {
        const deleted = this.genres.delete(genreId);
        if (deleted) {
            this.saveToCache();
            this.notifyDataUpdate();
        }
        return deleted;
    }

    /**
     * 设置跨页面通信监听
     */
    setupCrossPageCommunication() {
        // 监听 BroadcastChannel 消息
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.broadcastChannel = new BroadcastChannel('genre-updates');
                this.broadcastChannel.addEventListener('message', (event) => {
                    if (event.data.type === 'GENRES_UPDATED') {
                        console.log('收到风格更新通知，准备刷新数据...');
                        this.handleGenreUpdate();
                    }
                });
                console.log('BroadcastChannel 监听已设置');
            } catch (error) {
                console.warn('BroadcastChannel 设置失败:', error);
            }
        }

        // 监听 postMessage 消息
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'GENRES_UPDATED') {
                console.log('收到 postMessage 风格更新通知，准备刷新数据...');
                this.handleGenreUpdate();
            }
        });
    }

    /**
     * 处理风格更新通知
     */
    async handleGenreUpdate() {
        try {
            console.log('处理风格更新通知...');

            // 延迟一点时间确保服务器数据已写入
            await new Promise(resolve => setTimeout(resolve, 500));

            // 强制刷新数据
            await this.refresh();

            console.log('风格数据刷新完成');

            // 触发自定义事件，通知页面组件更新
            window.dispatchEvent(new CustomEvent('genresUpdated', {
                detail: { genres: this.getAllGenres() }
            }));

        } catch (error) {
            console.error('处理风格更新失败:', error);
        }
    }

    /**
     * 强制刷新数据
     */
    async refresh() {
        console.log('强制刷新风格数据...');
        this.initialized = false;
        this.genres.clear();

        // 清除缓存，强制从服务器重新加载
        localStorage.removeItem(this.cacheKey);
        localStorage.removeItem(this.versionKey);

        // 尝试从服务器重新加载最新数据
        if (await this.reloadFromServer()) {
            console.log('从服务器重新加载成功');
            this.initialized = true;
        } else {
            // 如果服务器加载失败，回退到正常初始化流程
            console.log('服务器加载失败，使用正常初始化流程');
            await this.initialize();
        }
    }

    /**
     * 通知其他页面数据已更新
     */
    notifyDataUpdate() {
        // 通知主页面数据更新
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
                type: 'genreDataUpdated',
                genres: this.getAllGenres()
            }, '*');
        }

        // 广播到其他标签页
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('vup-playlist-genres');
            channel.postMessage({
                type: 'genreDataUpdated',
                genres: this.getAllGenres()
            });
            channel.close();
        }
    }

    /**
     * 输出调试信息
     */
    logGenres() {
        console.log('当前风格数据:');
        this.genres.forEach((genre, id) => {
            console.log(`  ${id} → ${genre.name}`);
        });
    }

    /**
     * 检查是否已初始化
     */
    isReady() {
        return this.initialized && this.genres.size > 0;
    }
}

// 创建全局实例
window.genreManager = new GenreManager();
