/**
 * 从管理后台的localStorage中提取真实的风格名称
 * 并更新data.js和songs.json文件
 */

const fs = require('fs').promises;
const path = require('path');

async function extractRealGenreNames() {
    try {
        console.log('🔍 开始提取真实风格名称...');
        
        // 1. 创建一个HTML页面来读取localStorage
        const extractorHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>风格名称提取器</title>
</head>
<body>
    <h1>风格名称提取器</h1>
    <div id="status">正在提取...</div>
    <div id="result"></div>
    
    <script>
        // 加载GenreManager
        const script = document.createElement('script');
        script.src = 'genre-manager.js';
        script.onload = function() {
            extractGenreNames();
        };
        document.head.appendChild(script);
        
        async function extractGenreNames() {
            try {
                const statusDiv = document.getElementById('status');
                const resultDiv = document.getElementById('result');
                
                statusDiv.textContent = '正在读取localStorage...';
                
                // 读取localStorage中的风格数据
                const cacheKey = 'vtuber_genres_v3';
                const cachedData = localStorage.getItem(cacheKey);
                
                let realGenres = [];
                
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        if (Array.isArray(parsed)) {
                            realGenres = parsed;
                            statusDiv.textContent = \`从localStorage读取到 \${realGenres.length} 个风格\`;
                        }
                    } catch (e) {
                        console.error('解析localStorage数据失败:', e);
                    }
                }
                
                // 如果localStorage没有数据，尝试从GenreManager获取
                if (realGenres.length === 0 && window.genreManager) {
                    await window.genreManager.initialize();
                    realGenres = window.genreManager.getAllGenres();
                    statusDiv.textContent = \`从GenreManager读取到 \${realGenres.length} 个风格\`;
                }
                
                // 显示结果
                if (realGenres.length > 0) {
                    const genreList = realGenres.map(g => \`\${g.name} (\${g.id})\`).join('<br>');
                    resultDiv.innerHTML = \`
                        <h3>提取到的风格:</h3>
                        <div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
                            \${genreList}
                        </div>
                        <h3>JSON数据:</h3>
                        <textarea style="width: 100%; height: 200px;">\${JSON.stringify(realGenres, null, 2)}</textarea>
                    \`;
                    
                    // 将数据写入到一个JSON文件中
                    const dataUrl = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(realGenres, null, 2));
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = 'real-genres.json';
                    link.textContent = '下载风格数据';
                    link.style.display = 'block';
                    link.style.marginTop = '10px';
                    resultDiv.appendChild(link);
                    
                    statusDiv.textContent = '提取完成！';
                } else {
                    statusDiv.textContent = '未找到风格数据';
                    resultDiv.innerHTML = '<p style="color: red;">未找到任何风格数据</p>';
                }
                
            } catch (error) {
                console.error('提取失败:', error);
                document.getElementById('status').textContent = '提取失败: ' + error.message;
            }
        }
    </script>
</body>
</html>`;
        
        // 2. 写入提取器HTML文件
        const extractorPath = path.join(__dirname, 'genre-extractor.html');
        await fs.writeFile(extractorPath, extractorHtml, 'utf8');
        console.log('✅ 已创建风格提取器页面: genre-extractor.html');
        
        console.log('📋 请按以下步骤操作:');
        console.log('1. 在浏览器中打开 genre-extractor.html');
        console.log('2. 页面会自动提取localStorage中的真实风格名称');
        console.log('3. 下载生成的 real-genres.json 文件');
        console.log('4. 将该文件放在项目根目录');
        console.log('5. 再次运行此脚本进行更新');
        
        // 3. 检查是否已有real-genres.json文件
        const realGenresPath = path.join(__dirname, 'real-genres.json');
        try {
            const realGenresData = await fs.readFile(realGenresPath, 'utf8');
            const realGenres = JSON.parse(realGenresData);
            
            console.log('🎉 找到real-genres.json文件，开始更新数据文件...');
            await updateDataFiles(realGenres);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('⏳ 等待您完成上述步骤后再次运行此脚本');
            } else {
                console.error('读取real-genres.json失败:', error);
            }
        }
        
    } catch (error) {
        console.error('❌ 提取失败:', error);
        return false;
    }
}

async function updateDataFiles(realGenres) {
    try {
        console.log(\`📝 开始更新数据文件，使用 \${realGenres.length} 个真实风格名称...\`);
        
        // 1. 更新data.js
        const dataJsPath = path.join(__dirname, 'data.js');
        const dataJsContent = await fs.readFile(dataJsPath, 'utf8');
        
        const match = dataJsContent.match(/window\\.officialData\\s*=\\s*({[\\s\\S]*?});/);
        if (match) {
            const dataStr = match[1];
            const officialData = eval('(' + dataStr + ')');
            
            // 更新customGenres字段
            officialData.customGenres = realGenres;
            
            // 重新写入data.js
            const newDataJsContent = \`window.officialData = \${JSON.stringify(officialData, null, 2)};\`;
            await fs.writeFile(dataJsPath, newDataJsContent, 'utf8');
            console.log('✅ data.js 已更新');
        }
        
        // 2. 更新data/songs.json
        const songsPath = path.join(__dirname, 'data', 'songs.json');
        const songsData = JSON.parse(await fs.readFile(songsPath, 'utf8'));
        
        songsData.customGenres = realGenres;
        songsData.metadata.lastModified = new Date().toISOString();
        
        await fs.writeFile(songsPath, JSON.stringify(songsData, null, 2), 'utf8');
        console.log('✅ data/songs.json 已更新');
        
        // 3. 创建备份
        const backupPath = path.join(__dirname, \`data.js.backup.\${Date.now()}\`);
        await fs.writeFile(backupPath, dataJsContent, 'utf8');
        console.log(\`💾 原data.js已备份到: \${path.basename(backupPath)}\`);
        
        console.log('🎉 数据文件更新完成！');
        console.log('📋 更新摘要:');
        realGenres.forEach(genre => {
            console.log(\`   - \${genre.id} → \${genre.name}\`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ 更新数据文件失败:', error);
        return false;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    extractRealGenreNames().then(() => {
        console.log('脚本执行完成');
    });
}

module.exports = { extractRealGenreNames, updateDataFiles };
