/**
 * 虚拟主播歌单系统 - API客户端
 * 提供统一的API调用接口
 */

class ApiClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.timeout = 10000;
    }

    /**
     * 发送HTTP请求
     * @param {string} url 请求URL
     * @param {object} options 请求选项
     * @returns {Promise} 响应数据
     */
    async request(url, options = {}) {
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // 添加认证头（如果有token）
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.baseURL}${url}`, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || '请求失败');
            }

            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        }
    }

    /**
     * GET请求
     */
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return this.request(fullUrl);
    }

    /**
     * POST请求
     */
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT请求
     */
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE请求
     */
    async delete(url, data = null) {
        const options = { method: 'DELETE' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    }

    /**
     * 文件上传
     */
    async upload(url, file, params = {}) {
        const formData = new FormData();
        formData.append('file', file);

        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;

        return this.request(fullUrl, {
            method: 'POST',
            headers: {}, // 让浏览器自动设置Content-Type
            body: formData
        });
    }

    // ==================== 歌曲管理 API ====================

    /**
     * 获取歌曲列表
     */
    async getSongs(params = {}) {
        return this.get('/songs', params);
    }

    /**
     * 获取单个歌曲
     */
    async getSong(id) {
        return this.get(`/songs/${id}`);
    }

    /**
     * 添加歌曲
     */
    async addSong(songData) {
        return this.post('/songs', songData);
    }

    /**
     * 更新歌曲
     */
    async updateSong(id, songData) {
        return this.put(`/songs/${id}`, songData);
    }

    /**
     * 删除歌曲
     */
    async deleteSong(id) {
        return this.delete(`/songs/${id}`);
    }

    /**
     * 批量删除歌曲
     */
    async deleteSongs(ids) {
        return this.delete('/songs', { ids });
    }

    // ==================== 个人资料 API ====================

    /**
     * 获取个人资料
     */
    async getProfile() {
        return this.get('/profile');
    }

    /**
     * 更新个人资料
     */
    async updateProfile(profileData) {
        return this.put('/profile', profileData);
    }

    // ==================== 数据统计 API ====================

    /**
     * 获取统计信息
     */
    async getStats() {
        return this.get('/stats');
    }

    // ==================== 文件管理 API ====================

    /**
     * 上传文件
     */
    async uploadFile(file, type = 'avatars') {
        return this.upload('/upload', file, { type });
    }

    /**
     * 获取图片列表
     */
    async getImages(type = 'avatars') {
        return this.get('/images', { type });
    }

    // ==================== 数据同步 API ====================

    /**
     * 同步数据到官网
     */
    async syncData(data) {
        return this.post('/update-data', data);
    }
}

// 创建全局API客户端实例
const apiClient = new ApiClient();

// 导出API客户端
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
} else {
    window.ApiClient = ApiClient;
    window.apiClient = apiClient;
}

// 使用示例和工具函数
class ApiHelper {
    /**
     * 显示加载状态
     */
    static showLoading(element, text = '加载中...') {
        if (element) {
            element.disabled = true;
            element.textContent = text;
        }
    }

    /**
     * 隐藏加载状态
     */
    static hideLoading(element, originalText = '确定') {
        if (element) {
            element.disabled = false;
            element.textContent = originalText;
        }
    }

    /**
     * 处理API错误
     */
    static handleError(error, defaultMessage = '操作失败') {
        console.error('API错误:', error);
        const message = error.message || defaultMessage;
        
        // 这里可以集成通知系统
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        } else {
            alert(message);
        }
        
        return message;
    }

    /**
     * 处理API成功
     */
    static handleSuccess(result, defaultMessage = '操作成功') {
        const message = result.message || defaultMessage;
        
        // 这里可以集成通知系统
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        }
        
        return result.data;
    }

    /**
     * 安全的API调用包装器
     */
    static async safeCall(apiCall, loadingElement = null, originalText = '') {
        try {
            this.showLoading(loadingElement);
            const result = await apiCall();
            return this.handleSuccess(result);
        } catch (error) {
            this.handleError(error);
            throw error;
        } finally {
            this.hideLoading(loadingElement, originalText);
        }
    }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
    module.exports.ApiHelper = ApiHelper;
} else {
    window.ApiHelper = ApiHelper;
}
