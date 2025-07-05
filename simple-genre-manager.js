/**
 * 简化的风格管理器 - 重构版本
 * 核心原则：单一数据源，简单可靠
 */
class SimpleGenreManager {
    constructor() {
        this.genres = new Map();
        this.initialized = false;
        this.apiBase = '';
        
        console.log('SimpleGenreManager 初始化');
    }

    /**
     * 初始化风格数据
     * 优先级：API > data.js > 默认数据
     */
    async initialize() {
        if (this.initialized) {
            console.log('SimpleGenreManager 已初始化');
            return;
        }

        console.log('开始初始化风格数据...');

        try {
            // 1. 优先从API加载
            if (await this.loadFromAPI()) {
                console.log('✅ 从API加载风格数据成功');
            }
            // 2. 如果API失败，从data.js加载
            else if (await this.loadFromDataJs()) {
                console.log('✅ 从data.js加载风格数据成功');
            }
            // 3. 最后使用默认数据
            else {
                this.loadDefaultGenres();
                console.log('✅ 使用默认风格数据');
            }

            this.initialized = true;
            console.log(`风格数据初始化完成，共 ${this.genres.size} 个风格`);
            this.logGenres();

        } catch (error) {
            console.error('风格数据初始化失败:', error);
            this.loadDefaultGenres();
            this.initialized = true;
        }
    }

    /**
     * 从API加载风格数据
     */
    async loadFromAPI() {
        try {
            const response = await fetch('/api/genres');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && Array.isArray(result.data)) {
                    this.setGenres(result.data);
                    return true;
                }
            }
        } catch (error) {
            console.log('API加载失败，尝试其他方式');
        }
        return false;
    }

    /**
     * 从data.js加载风格数据（向后兼容）
     */
    async loadFromDataJs() {
        return new Promise((resolve) => {
            const checkData = () => {
                if (window.officialData && window.officialData.customGenres) {
                    this.setGenres(window.officialData.customGenres);
                    resolve(true);
                } else {
                    resolve(false);
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkData);
            } else {
                checkData();
            }
        });
    }

    /**
     * 加载默认风格
     */
    loadDefaultGenres() {
        const defaultGenres = [
            { id: 'pop', name: '流行', builtIn: true }
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
                    builtIn: genre.builtIn || false,
                    createdAt: genre.createdAt || new Date().toISOString()
                });
            }
        });
    }

    /**
     * 获取风格显示名称
     */
    getDisplayName(genreId) {
        if (!genreId || genreId.trim() === '') {
            return '/';
        }

        const genre = this.genres.get(genreId);
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
        const genre = {
            id: id,
            name: name,
            builtIn: false,
            createdAt: new Date().toISOString()
        };
        
        this.genres.set(id, genre);
        return genre;
    }

    /**
     * 删除风格
     */
    deleteGenre(genreId) {
        const genre = this.genres.get(genreId);
        if (!genre || genre.builtIn) {
            return false; // 不能删除内置风格
        }
        
        return this.genres.delete(genreId);
    }

    /**
     * 检查是否已初始化
     */
    isReady() {
        return this.initialized;
    }

    /**
     * 强制刷新数据
     */
    async refresh() {
        this.initialized = false;
        this.genres.clear();
        await this.initialize();
    }

    /**
     * 输出调试信息
     */
    logGenres() {
        console.log('当前风格列表:');
        this.genres.forEach(genre => {
            console.log(`  - ${genre.name} (${genre.id}) ${genre.builtIn ? '[内置]' : '[自定义]'}`);
        });
    }
}

// 创建全局实例
window.simpleGenreManager = new SimpleGenreManager();

// 兼容性：保持原有接口
window.genreManager = window.simpleGenreManager;
