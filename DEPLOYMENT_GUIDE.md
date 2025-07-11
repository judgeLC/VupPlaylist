# 公网部署指南

## 部署前准备

### 1. 安全检查清单
- [x] 所有安全漏洞已修复
- [ ] 服务器环境已准备
- [ ] HTTPS证书已配置
- [ ] 域名已解析
- [ ] 防火墙已配置

### 2. 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0
- HTTPS证书（强烈推荐）
- 反向代理服务器（推荐）

## 部署步骤

### 步骤1: 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 步骤2: 项目部署
```bash
# 上传项目文件到服务器
# 建议使用 /var/www/vupplaylist 目录

# 安装依赖
cd /var/www/vupplaylist
npm install

# 设置文件权限
sudo chown -R www-data:www-data /var/www/vupplaylist
sudo chmod -R 755 /var/www/vupplaylist
```

### 步骤3: 环境配置
```bash
# 创建环境变量文件
cat > .env << EOF
NODE_ENV=production
PORT=8000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EOF

# 删除敏感文件
rm FIRST_LOGIN.md
rm SECURITY_FIXES.md
rm DEPLOYMENT_GUIDE.md
```

### 步骤4: Nginx配置（推荐）
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 限制请求大小
    client_max_body_size 10M;
    
    # 代理到Node.js应用
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 静态文件缓存
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://localhost:8000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 步骤5: 进程管理（PM2）
```bash
# 安装PM2
sudo npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'vupplaylist',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

## 首次登录配置

### 1. 访问系统
访问 `https://yourdomain.com/login.html`

### 2. 使用默认密码登录
- 默认密码: `Admin@123456`
- 系统会强制要求修改密码

### 3. 设置强密码
新密码必须包含：
- 至少8个字符
- 大写字母
- 小写字母
- 数字
- 特殊字符

### 4. 完成初始配置
- 上传主播头像
- 设置个人资料
- 添加歌曲数据
- 测试所有功能

## 安全监控

### 1. 日志监控
```bash
# 查看应用日志
pm2 logs vupplaylist

# 查看Nginx访问日志
sudo tail -f /var/log/nginx/access.log

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

### 2. 安全检查脚本
```bash
#!/bin/bash
# security_check.sh

echo "=== 安全检查报告 ==="
echo "检查时间: $(date)"
echo

# 检查失败登录尝试
echo "最近的登录尝试:"
pm2 logs vupplaylist --lines 100 | grep "登录失败" | tail -5

# 检查可疑访问
echo "可疑路径访问:"
sudo grep "可疑路径访问" /var/log/nginx/access.log | tail -5

# 检查系统资源
echo "系统资源使用:"
pm2 monit
```

### 3. 定期维护任务
```bash
# 创建定期备份脚本
cat > backup.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/vupplaylist_\$DATE.tar.gz /var/www/vupplaylist/data/
find /backup -name "vupplaylist_*.tar.gz" -mtime +7 -delete
EOF

# 添加到crontab（每天凌晨2点备份）
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

## 故障排除

### 常见问题

1. **服务器无法启动**
   - 检查端口是否被占用: `netstat -tlnp | grep 8000`
   - 检查Node.js版本: `node --version`
   - 查看错误日志: `pm2 logs vupplaylist`

2. **CORS错误**
   - 确认 `ALLOWED_ORIGINS` 环境变量设置正确
   - 检查域名解析是否正确

3. **文件上传失败**
   - 检查目录权限: `ls -la /var/www/vupplaylist/images/`
   - 确认磁盘空间充足: `df -h`

4. **登录问题**
   - 检查是否使用HTTPS
   - 确认密码策略要求
   - 查看防爆破攻击日志

### 紧急恢复
```bash
# 重启应用
pm2 restart vupplaylist

# 重置到默认状态（谨慎使用）
rm /var/www/vupplaylist/data/auth.json
pm2 restart vupplaylist

# 从备份恢复
tar -xzf /backup/vupplaylist_YYYYMMDD_HHMMSS.tar.gz -C /
pm2 restart vupplaylist
```

## 技术支持

### 监控指标
- CPU使用率 < 80%
- 内存使用率 < 80%
- 磁盘使用率 < 90%
- 响应时间 < 2秒

### 性能优化
- 启用Nginx gzip压缩
- 配置静态文件缓存
- 使用CDN加速
- 定期清理日志文件

---

**部署完成！您的虚拟主播歌单系统现已安全运行在公网上！**
