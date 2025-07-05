/**
 * 紧急修复脚本：从歌曲数据中提取风格信息并修复数据文件
 */

const fs = require('fs').promises;
const path = require('path');

async function fixGenreData() {
    try {
        console.log('🔧 开始修复风格数据...');
        
        // 1. 读取当前的songs.json
        const songsPath = path.join(__dirname, 'data', 'songs.json');
        const songsData = JSON.parse(await fs.readFile(songsPath, 'utf8'));
        
        console.log(`📖 读取到 ${songsData.songs.length} 首歌曲`);
        
        // 2. 从歌曲中提取所有使用的custom_风格ID
        const genreMap = new Map();
        songsData.songs.forEach(song => {
            if (song.genre && song.genre.startsWith('custom_')) {
                if (!genreMap.has(song.genre)) {
                    // 生成友好的风格名称
                    const timestamp = song.genre.replace('custom_', '');
                    const date = new Date(parseInt(timestamp));
                    let friendlyName = song.genre;
                    
                    if (!isNaN(date.getTime())) {
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        const hour = date.getHours();
                        const minute = date.getMinutes();
                        friendlyName = `自定义风格_${month}月${day}日${hour}:${minute.toString().padStart(2, '0')}`;
                    }
                    
                    genreMap.set(song.genre, {
                        id: song.genre,
                        name: friendlyName,
                        builtIn: false
                    });
                }
            }
        });
        
        const extractedGenres = Array.from(genreMap.values());
        console.log(`🎵 提取到 ${extractedGenres.length} 个风格:`, extractedGenres.map(g => `${g.name}(${g.id})`));
        
        // 3. 更新songs.json，添加customGenres字段
        const updatedSongsData = {
            ...songsData,
            customGenres: extractedGenres,
            metadata: {
                ...songsData.metadata,
                lastModified: new Date().toISOString()
            }
        };
        
        await fs.writeFile(songsPath, JSON.stringify(updatedSongsData, null, 2), 'utf8');
        console.log('✅ songs.json 已更新');
        
        // 4. 读取当前的data.js
        const dataJsPath = path.join(__dirname, 'data.js');
        const dataJsContent = await fs.readFile(dataJsPath, 'utf8');
        
        // 解析data.js中的数据
        const match = dataJsContent.match(/window\.officialData\s*=\s*({[\s\S]*?});/);
        if (match) {
            const dataStr = match[1];
            const officialData = eval('(' + dataStr + ')');
            
            // 添加customGenres字段
            officialData.customGenres = extractedGenres;
            
            // 重新写入data.js
            const newDataJsContent = `window.officialData = ${JSON.stringify(officialData, null, 2)};`;
            await fs.writeFile(dataJsPath, newDataJsContent, 'utf8');
            console.log('✅ data.js 已更新');
        }
        
        // 5. 创建备份
        const backupPath = path.join(__dirname, `data.js.backup.${Date.now()}`);
        await fs.writeFile(backupPath, dataJsContent, 'utf8');
        console.log(`💾 原data.js已备份到: ${backupPath}`);
        
        console.log('🎉 风格数据修复完成！');
        console.log('📋 修复摘要:');
        console.log(`   - 提取风格数量: ${extractedGenres.length}`);
        console.log(`   - 更新文件: songs.json, data.js`);
        console.log(`   - 创建备份: ${path.basename(backupPath)}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ 修复失败:', error);
        return false;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    fixGenreData().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = fixGenreData;
