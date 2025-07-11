# 虚拟主播歌单系统 - API 文档

## 概述

本文档描述了虚拟主播歌单系统的RESTful API接口。所有API响应都遵循统一的格式。

### 响应格式

**成功响应**：
```json
{
  "success": true,
  "message": "操作成功",
  "data": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**错误响应**：
```json
{
  "success": false,
  "message": "错误信息",
  "error": "详细错误信息",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 歌曲管理 API

### 获取歌曲列表
```
GET /api/songs
```

**查询参数**：
- `page` (number): 页码，默认为1
- `limit` (number): 每页数量，默认为50
- `genre` (string): 筛选类型
- `search` (string): 搜索关键词

**响应示例**：
```json
{
  "success": true,
  "data": {
    "songs": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    },
    "metadata": {
      "version": "1.0",
      "lastModified": "2024-01-01T00:00:00.000Z",
      "totalCount": 100
    }
  }
}
```

### 获取单个歌曲
```
GET /api/songs/:id
```

### 添加歌曲
```
POST /api/songs
```

**请求体**：
```json
{
  "title": "歌曲标题",
  "artist": "艺术家",
  "genre": "类型",
  "note": "备注"
}
```

### 更新歌曲
```
PUT /api/songs/:id
```

**请求体**：同添加歌曲

### 删除歌曲
```
DELETE /api/songs/:id
```

### 批量删除歌曲
```
DELETE /api/songs
```

**请求体**：
```json
{
  "ids": ["id1", "id2", "id3"]
}
```

## 个人资料 API

### 获取个人资料
```
GET /api/profile
```

### 更新个人资料
```
PUT /api/profile
```

**请求体**：
```json
{
  "websiteTitle": "网站标题",
  "vtuberName": "主播名称",
  "vtuberUid": "主播UID",
  "vtuberBirthday": "生日",
  "liveRoomUrl": "直播间链接",
  "vtuberDesc": "个人描述",
  "avatar": "头像路径",
  "background": "背景图路径"
}
```

## 数据统计 API

### 获取统计信息
```
GET /api/stats
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "totalSongs": 100,
    "genreStats": {
      "流行": 30,
      "摇滚": 20,
      "古风": 15
    },
    "noteStats": {
      "推荐": 25,
      "热门": 20,
      "无备注": 55
    },
    "recentSongs": [...],
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

## 文件管理 API

### 上传文件
```
POST /api/upload?type=avatars
```

**请求**：multipart/form-data
- `file`: 文件数据
- `type`: 文件类型 (avatars/backgrounds)

### 获取图片列表
```
GET /api/images?type=avatars
```

## 数据同步 API

### 同步数据到官网
```
POST /api/update-data
```

**请求体**：
```json
{
  "profile": {...},
  "songs": [...]
}
```

## 使用示例

### JavaScript Fetch API

```javascript
// 获取歌曲列表
const response = await fetch('/api/songs?page=1&limit=10');
const result = await response.json();

if (result.success) {
  console.log('歌曲列表:', result.data.songs);
} else {
  console.error('获取失败:', result.message);
}

// 添加歌曲
const newSong = {
  title: '新歌曲',
  artist: '艺术家',
  genre: '流行',
  note: '推荐'
};

const addResponse = await fetch('/api/songs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(newSong)
});

const addResult = await addResponse.json();
```

### Axios 示例

```javascript
import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API错误:', error.response?.data?.message);
    return Promise.reject(error);
  }
);

// 使用示例
const songs = await api.get('/songs');
const newSong = await api.post('/songs', songData);
```

## 错误代码

- `400` - 请求参数错误
- `401` - 未授权访问
- `403` - 禁止访问
- `404` - 资源不存在
- `500` - 服务器内部错误

## 注意事项

1. 所有API都支持CORS跨域访问
2. 文件上传限制为5MB
3. 数据会同时保存到新格式和旧格式文件中
4. API响应时间通常在100ms以内
5. 建议使用分页获取大量数据
