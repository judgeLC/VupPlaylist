# 虚拟主播歌单系统 (VupPlaylist)

一个专为虚拟主播设计的歌单管理系统，支持歌曲管理、个人资料展示和观众互动。

## 功能特性

### 歌单管理
- **歌曲增删改查** - 完整的歌曲信息管理
- **风格分类** - 支持自定义音乐风格标签
- **搜索筛选** - 按歌名、歌手、风格快速查找
- **批量操作** - 支持批量添加、编辑和删除
- **备注系统** - 为歌曲添加个性化备注

### 个人资料
- **主播信息** - 展示主播基本信息和介绍
- **头像背景** - 支持自定义头像和背景图片
- **社交链接** - 直播间链接等社交媒体信息
- **个性化设置** - 网站标题、主题等自定义选项

### 界面设计
- **响应式布局** - 完美适配桌面和移动设备
- **毛玻璃效果** - 现代化的视觉设计
- **主题切换** - 支持明暗主题切换
- **动画效果** - 流畅的交互动画

### 安全特性
- **登录认证** - 安全的后台管理系统
- **数据保护** - 本地数据存储，隐私安全
- **访问控制** - 前台展示，后台管理分离
- **备份恢复** - 支持数据导出导入

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Node.js, Express.js
- **数据存储**: JSON 文件
- **文件上传**: Multer
- **样式**: 原生CSS + 毛玻璃效果

## 快速开始

### 环境要求
- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-username/VupPlaylist.git
cd VupPlaylist
```

2. **安装依赖**
```bash
npm install
```

3. **启动服务器**
```bash
npm start
# 或
node server.js
```

4. **访问应用**
- 前台展示: http://localhost:8000
- 后台管理: http://localhost:8000/admin.html
- 登录页面: http://localhost:8000/login.html

### 首次使用

1. 访问登录页面
2. 使用默认密码登录（详见部署文档）
3. 立即修改为强密码
4. 开始管理您的歌单

## 项目结构

```
VupPlaylist/
├── index.html          # 前台主页
├── admin.html          # 后台管理页面
├── login.html          # 登录页面
├── server.js           # 后端服务器
├── auth.js             # 认证模块
├── admin.js            # 后台管理脚本
├── script.js           # 前台脚本
├── styles.css          # 主样式文件
├── admin.css           # 后台样式
├── data/               # 数据存储目录
├── images/             # 图片资源
└── package.json        # 项目配置
```

## API 接口

### 歌曲管理
- `GET /api/songs` - 获取歌曲列表
- `POST /api/songs` - 添加新歌曲
- `PUT /api/songs/:id` - 更新歌曲信息
- `DELETE /api/songs/:id` - 删除歌曲

### 个人资料
- `GET /api/profile` - 获取个人资料
- `PUT /api/profile` - 更新个人资料

### 文件上传
- `POST /api/upload` - 上传图片文件

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/verify` - 验证登录状态

## 部署指南

### 本地开发
```bash
# 开发模式启动
npm run dev

# 生产模式启动
npm start
```

### 生产部署

1. **环境配置**
```bash
# 设置环境变量
export NODE_ENV=production
export PORT=8000
```

2. **使用 PM2 部署**
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name "vupplaylist"

# 设置开机自启
pm2 startup
pm2 save
```

3. **Nginx 反向代理**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 安全注意事项

- 首次部署后立即修改默认密码
- 建议使用 HTTPS 协议
- 定期备份数据文件
- 限制后台管理访问权限
- 监控异常登录尝试

## 自定义配置

### 主题定制
修改 `styles.css` 中的 CSS 变量来自定义主题：

```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --accent-color: #f093fb;
}
```

### 功能扩展
- 添加新的音乐风格分类
- 自定义歌曲字段
- 集成第三方音乐平台 API
- 添加歌词显示功能

## 常见问题

### Q: 忘记管理员密码怎么办？
A: 删除数据目录中的认证文件，重启服务器即可重置。

### Q: 如何备份数据？
A: 复制整个 `data/` 目录即可备份所有数据。

### Q: 支持哪些图片格式？
A: 支持 JPG, PNG, GIF, WebP 格式的图片上传。

### Q: 如何修改端口号？
A: 设置环境变量 `PORT` 或修改服务器配置。

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 更新日志

### v2.0.0
- 重构为前后端分离架构
- 增强安全认证系统
- 优化用户界面设计
- 添加批量操作功能

### v1.0.0
- 基础歌单管理功能
- 个人资料展示
- 响应式设计
- 本地数据存储

## 联系方式

- 项目主页: https://github.com/your-username/VupPlaylist
- 问题反馈: https://github.com/your-username/VupPlaylist/issues

---

**感谢使用 VupPlaylist！如果这个项目对您有帮助，请给个 Star 支持一下！**
