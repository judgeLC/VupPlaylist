/**
 * 简化的风格名称提取和更新脚本
 */

const fs = require('fs').promises;
const path = require('path');

async function createExtractorPage() {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>风格名称提取器</title>
</head>
<body>
    <h1>风格名称提取器</h1>
    <div id="status">正在提取...</div>
    <div id="result"></div>
    
    <script src="genre-manager.js"></script>
    <script>
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
                            statusDiv.textContent = '从localStorage读取到 ' + realGenres.length + ' 个风格';
                        }
                    } catch (e) {
                        console.error('解析localStorage数据失败:', e);
                    }
                }
                
                // 如果localStorage没有数据，尝试从GenreManager获取
                if (realGenres.length === 0 && window.GenreManager) {
                    const genreManager = new GenreManager();
                    await genreManager.initialize();
                    realGenres = genreManager.getAllGenres();
                    statusDiv.textContent = '从GenreManager读取到 ' + realGenres.length + ' 个风格';
                }
                
                // 显示结果
                if (realGenres.length > 0) {
                    const genreList = realGenres.map(g => g.name + ' (' + g.id + ')').join('<br>');
                    resultDiv.innerHTML = '<h3>提取到的风格:</h3><div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">' + genreList + '</div><h3>JSON数据:</h3><textarea id="jsonData" style="width: 100%; height: 200px;">' + JSON.stringify(realGenres, null, 2) + '</textarea><br><button onclick="copyToClipboard()">复制JSON数据</button>';
                    
                    statusDiv.textContent = '提取完成！请复制JSON数据';
                } else {
                    statusDiv.textContent = '未找到风格数据';
                    resultDiv.innerHTML = '<p style="color: red;">未找到任何风格数据</p>';
                }
                
            } catch (error) {
                console.error('提取失败:', error);
                document.getElementById('status').textContent = '提取失败: ' + error.message;
            }
        }
        
        function copyToClipboard() {
            const textarea = document.getElementById('jsonData');
            textarea.select();
            document.execCommand('copy');
            alert('JSON数据已复制到剪贴板！');
        }
        
        // 页面加载后自动执行
        window.addEventListener('load', extractGenreNames);
    </script>
</body>
</html>`;
    
    await fs.writeFile('genre-extractor.html', html, 'utf8');
    console.log('✅ 已创建风格提取器页面: genre-extractor.html');
}

async function updateDataWithRealGenres(realGenresJson) {
    try {
        const realGenres = JSON.parse(realGenresJson);
        console.log('开始更新数据文件，使用 ' + realGenres.length + ' 个真实风格名称...');
        
        // 1. 更新data.js
        const dataJsPath = path.join(__dirname, 'data.js');
        const dataJsContent = await fs.readFile(dataJsPath, 'utf8');
        
        const match = dataJsContent.match(/window\.officialData\s*=\s*({[\s\S]*?});/);
        if (match) {
            const dataStr = match[1];
            const officialData = eval('(' + dataStr + ')');
            
            // 更新customGenres字段
            officialData.customGenres = realGenres;
            
            // 重新写入data.js
            const newDataJsContent = 'window.officialData = ' + JSON.stringify(officialData, null, 2) + ';';
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
        
        console.log('🎉 数据文件更新完成！');
        console.log('📋 更新摘要:');
        realGenres.forEach(genre => {
            console.log('   - ' + genre.id + ' → ' + genre.name);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ 更新数据文件失败:', error);
        return false;
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // 创建提取器页面
        await createExtractorPage();
        console.log('📋 请按以下步骤操作:');
        console.log('1. 在浏览器中打开 genre-extractor.html');
        console.log('2. 页面会自动提取localStorage中的真实风格名称');
        console.log('3. 复制页面上的JSON数据');
        console.log('4. 运行: node simple-genre-extractor.js "复制的JSON数据"');
    } else {
        // 使用提供的JSON数据更新文件
        const jsonData = args[0];
        await updateDataWithRealGenres(jsonData);
    }
}

if (require.main === module) {
    main().catch(console.error);
}
