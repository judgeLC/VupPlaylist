# 虚拟主播歌单系统 v1.0

示例页面：https://vup.irislc.net/

> 前后端分离架构的虚拟主播歌单管理系统

专为虚拟主播开发的开源歌单系统，采用现代化的前后端分离架构，提供完整的RESTful API接口。

## 功能特点

### 前端功能
- **歌曲展示**: 支持分类筛选、搜索和分页
- **点歌指令**: 一键复制点歌指令
- **个性化定制**: 自定义主播信息、头像、背景
- **响应式设计**: 完美适配移动端和桌面端
- **主题切换**: 支持白天/黑夜模式
- **实时更新**: 基于API的实时数据同步

### 后台管理
- **安全认证**: 强密码要求和防爆破攻击
- **歌曲管理**: 添加、编辑、删除歌曲，支持批量操作
- **个人资料**: 管理主播信息、头像、背景图
- **数据统计**: 歌曲统计和分析图表
- **文件管理**: 图片上传和管理
- **API接口**: 完整的RESTful API支持

### API特性
- **RESTful设计**: 标准化的API接口
- **统一响应格式**: 一致的数据返回格式
- **错误处理**: 完善的错误处理机制
- **数据验证**: 输入数据验证和清理
- **CORS支持**: 跨域访问支持

### 安全特性
- **强密码策略**: 8位以上，包含大小写字母、数字、特殊字符
- **防爆破攻击**: 5次失败锁定15分钟
- **会话管理**: 24小时自动过期和清理
- **文件上传安全**: 严格的文件类型和内容验证
- **XSS/CSRF防护**: 全面的安全头部保护
- **速率限制**: 防止API滥用
- **输入验证**: 所有用户输入的验证和清理
- **安全存储**: 密码哈希和安全的文件存储

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装和运行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **数据迁移** (从旧版本升级)
   ```bash
   npm run migrate
   ```

3. **启动服务器**
   ```bash
   npm start
   ```

4. **访问应用**
   - 主页: http://localhost:8000
   - 管理后台: http://localhost:8000/admin.html
   - 登录页面: http://localhost:8000/login.html

### 首次登录
- 默认密码: `Admin@123456`
- 首次登录后系统会要求修改密码
- 详细说明请查看 [FIRST_LOGIN.md](./FIRST_LOGIN.md)

## 技术架构

### 前后端分离设计

```
┌─────────────────┐    HTTP/API    ┌─────────────────┐
│   前端 (Web)    │ ◄─────────────► │   后端 (API)    │
│                 │                │                 │
│ • HTML/CSS/JS   │                │ • Node.js       │
│ • 用户界面      │                │ • Express.js    │
│ • API调用       │                │ • RESTful API   │
└─────────────────┘                └─────────────────┘
                                           │
                                           ▼
                                   ┌─────────────────┐
                                   │   数据存储      │
                                   │ • JSON文件      │
                                   │ • 文件系统      │
                                   └─────────────────┘
```

### 技术栈
- **后端**: Node.js + Express.js + RESTful API
- **前端**: HTML5 + CSS3 + ES6 + Fetch API
- **存储**: JSON文件 + 文件系统
- **安全**: Web Crypto API + 密码哈希
- **设计**: 响应式设计 + 主题切换

## 项目结构

```
VupPlaylist/
├── server.js                    # 主服务器文件
├── index.html                   # 前端主页
├── admin.html                   # 后台管理页面
├── login.html                   # 登录页面
├── script.js                    # 前端主要逻辑
├── admin.js                     # 后台管理逻辑
├── auth.js                      # 认证系统
├── api-client.js                # 前端API客户端
├── simple-genre-manager.js      # 风格管理器
├── data.js                      # 数据配置文件
├── styles.css                   # 主要样式文件
├── admin.css                    # 后台样式文件
├── data/                        # 数据存储目录
│   ├── songs.json                 # 歌曲数据
│   ├── profile.json               # 个人资料
│   ├── settings.json              # 系统设置
│   ├── genres.json                # 风格数据
│   └── auth.json                  # 认证数据
├── images/                      # 图片存储
│   ├── avatars/                   # 头像图片
│   └── backgrounds/               # 背景图片
├── package.json                 # 项目配置
├── API.md                       # API文档
├── SECURITY.md                  # 安全说明
├── FIRST_LOGIN.md               # 首次登录说明
└── README.md                    # 项目说明
```

## API 接口

### 歌曲管理
- `GET /api/songs` - 获取歌曲列表
- `POST /api/songs` - 添加歌曲
- `PUT /api/songs/:id` - 更新歌曲
- `DELETE /api/songs/:id` - 删除歌曲

### 个人资料
- `GET /api/profile` - 获取个人资料
- `PUT /api/profile` - 更新个人资料

### 数据统计
- `GET /api/stats` - 获取统计信息

### 文件管理
- `POST /api/upload` - 上传文件
- `GET /api/images` - 获取图片列表

详细API文档请查看 [API.md](./API.md)

## 开发命令

```bash
# 启动服务器
npm start

# 开发模式（与start相同）
npm run dev
```

## 配置说明

### 服务器配置
在 `server.js` 中修改端口和路径：
```javascript
const PORT = process.env.PORT || 8000;
const UPLOAD_DIR = './images';
const DATA_DIR = './data';
```

### API客户端配置
在 `api-client.js` 中修改API基础URL：
```javascript
const apiClient = new ApiClient('/api');
```

## 故障排除

### 常见问题
1. **服务器启动失败**: 检查端口占用和Node.js版本
2. **文件上传失败**: 检查文件大小和格式
3. **登录失败**: 确认密码正确，检查是否被锁定
4. **数据丢失**: 检查 data/ 目录权限

### 日志查看
服务器运行时会输出详细日志，包括：
- 请求日志
- 错误日志
- 安全事件日志

### 浏览器支持
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 更新日志

### v2.0.0 (2024-07-11)
- 重构为前后端分离架构
- 实现完整的RESTful API
- 优化数据存储结构
- 全面的安全增强
- 完善文档和示例

### v1.0.0
- 基础歌单管理功能
- 个人资料管理
- 文件上传功能

## 部署指南

### 生产环境部署
1. 设置环境变量
2. 配置反向代理（推荐 Nginx）
3. 启用 HTTPS
4. 设置防火墙规则
5. 配置自动备份

详细部署说明请查看 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 安全说明

本系统已实施多层安全防护，详细安全特性请查看 [SECURITY.md](./SECURITY.md)

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 支持

如有问题或建议，请：
1. 查看文档和 FAQ
2. 搜索已有 Issue
3. 创建新的 Issue
4. 联系开发者

---

**注意**: 本系统专为虚拟主播设计，请确保在使用时遵守相关平台的服务条款和版权法律。


