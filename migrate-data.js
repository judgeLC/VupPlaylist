/**
 * 数据迁移脚本
 * 将现有的localStorage数据和data.js迁移到新的JSON文件格式
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

class DataMigrator {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.songsFile = path.join(this.dataDir, 'songs.json');
        this.profileFile = path.join(this.dataDir, 'profile.json');
        this.settingsFile = path.join(this.dataDir, 'settings.json');
        this.oldDataFile = path.join(__dirname, 'data.js');
    }

    /**
     * 确保数据目录存在
     */
    async ensureDataDir() {
        if (!fsSync.existsSync(this.dataDir)) {
            await fs.mkdir(this.dataDir, { recursive: true });
            console.log('✅ 创建数据目录:', this.dataDir);
        }
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * 读取旧的data.js文件
     */
    async readOldDataFile() {
        try {
            if (!fsSync.existsSync(this.oldDataFile)) {
                console.log('⚠️  未找到旧的data.js文件');
                return null;
            }

            const content = await fs.readFile(this.oldDataFile, 'utf8');
            
            // 解析data.js文件内容
            const match = content.match(/window\.officialData\s*=\s*({[\s\S]*});/);
            if (match) {
                return JSON.parse(match[1]);
            }
            
            console.log('⚠️  无法解析data.js文件格式');
            return null;
        } catch (error) {
            console.error('❌ 读取旧数据文件失败:', error);
            return null;
        }
    }

    /**
     * 迁移歌曲数据
     */
    async migrateSongs(oldData) {
        try {
            const songs = (oldData?.songs || []).map(song => ({
                id: song.id || this.generateId(),
                title: song.title || '',
                artist: song.artist || '',
                genre: song.genre || '',
                note: song.note || '',
                addedDate: song.addedDate || new Date().toISOString(),
                updatedDate: song.updatedDate || null
            }));

            const songsData = {
                songs,
                metadata: {
                    version: '1.0',
                    lastModified: new Date().toISOString(),
                    totalCount: songs.length,
                    description: '虚拟主播歌单数据文件',
                    migratedFrom: 'data.js',
                    migrationDate: new Date().toISOString()
                }
            };

            await fs.writeFile(this.songsFile, JSON.stringify(songsData, null, 2));
            console.log(`✅ 迁移歌曲数据完成: ${songs.length} 首歌曲`);
            
            return songs.length;
        } catch (error) {
            console.error('❌ 迁移歌曲数据失败:', error);
            return 0;
        }
    }

    /**
     * 迁移个人资料数据
     */
    async migrateProfile(oldData) {
        try {
            const profile = {
                websiteTitle: oldData?.profile?.websiteTitle || '虚拟主播歌单',
                vtuberName: oldData?.profile?.vtuberName || '虚拟主播',
                vtuberUid: oldData?.profile?.vtuberUid || 'VT-001',
                vtuberBirthday: oldData?.profile?.vtuberBirthday || '01/01',
                liveRoomUrl: oldData?.profile?.liveRoomUrl || '',
                vtuberDesc: oldData?.profile?.vtuberDesc || '欢迎来到我的歌单空间！',
                avatar: oldData?.profile?.avatar || '',
                background: oldData?.profile?.background || ''
            };

            const profileData = {
                profile,
                metadata: {
                    version: '1.0',
                    lastModified: new Date().toISOString(),
                    description: '虚拟主播个人资料数据文件',
                    migratedFrom: 'data.js',
                    migrationDate: new Date().toISOString()
                }
            };

            await fs.writeFile(this.profileFile, JSON.stringify(profileData, null, 2));
            console.log('✅ 迁移个人资料数据完成');
            
            return true;
        } catch (error) {
            console.error('❌ 迁移个人资料数据失败:', error);
            return false;
        }
    }

    /**
     * 创建默认设置
     */
    async createDefaultSettings() {
        try {
            const settingsData = {
                settings: {
                    commandPrefix: '/点歌',
                    commandSuffix: '',
                    theme: 'light',
                    autoSave: true,
                    backupEnabled: true,
                    maxSongsPerPage: 50,
                    allowGuestView: true,
                    enableSearch: true,
                    enableFilter: true
                },
                metadata: {
                    version: '1.0',
                    lastModified: new Date().toISOString(),
                    description: '系统设置数据文件',
                    createdDate: new Date().toISOString()
                }
            };

            await fs.writeFile(this.settingsFile, JSON.stringify(settingsData, null, 2));
            console.log('✅ 创建默认设置文件');
            
            return true;
        } catch (error) {
            console.error('❌ 创建设置文件失败:', error);
            return false;
        }
    }

    /**
     * 备份旧数据文件
     */
    async backupOldData() {
        try {
            if (fsSync.existsSync(this.oldDataFile)) {
                const backupFile = path.join(__dirname, `data.js.backup.${Date.now()}`);
                await fs.copyFile(this.oldDataFile, backupFile);
                console.log('✅ 备份旧数据文件:', backupFile);
                return backupFile;
            }
            return null;
        } catch (error) {
            console.error('❌ 备份旧数据文件失败:', error);
            return null;
        }
    }

    /**
     * 执行完整迁移
     */
    async migrate() {
        console.log('🚀 开始数据迁移...\n');

        try {
            // 1. 确保数据目录存在
            await this.ensureDataDir();

            // 2. 读取旧数据
            const oldData = await this.readOldDataFile();

            // 3. 备份旧数据
            const backupFile = await this.backupOldData();

            // 4. 迁移数据
            let songsCount = 0;
            let profileMigrated = false;
            let settingsCreated = false;

            if (oldData) {
                songsCount = await this.migrateSongs(oldData);
                profileMigrated = await this.migrateProfile(oldData);
            } else {
                console.log('⚠️  未找到旧数据，创建默认数据文件');
                
                // 创建空的歌曲文件
                await fs.writeFile(this.songsFile, JSON.stringify({
                    songs: [],
                    metadata: {
                        version: '1.0',
                        lastModified: new Date().toISOString(),
                        totalCount: 0,
                        description: '虚拟主播歌单数据文件'
                    }
                }, null, 2));

                // 创建默认个人资料
                await fs.writeFile(this.profileFile, JSON.stringify({
                    profile: {
                        websiteTitle: '虚拟主播歌单',
                        vtuberName: '虚拟主播',
                        vtuberUid: 'VT-001',
                        vtuberBirthday: '01/01',
                        liveRoomUrl: '',
                        vtuberDesc: '欢迎来到我的歌单空间！',
                        avatar: '',
                        background: ''
                    },
                    metadata: {
                        version: '1.0',
                        lastModified: new Date().toISOString(),
                        description: '虚拟主播个人资料数据文件'
                    }
                }, null, 2));

                profileMigrated = true;
            }

            // 5. 创建设置文件
            settingsCreated = await this.createDefaultSettings();

            // 6. 输出迁移结果
            console.log('\n📊 迁移结果:');
            console.log(`   歌曲数据: ${songsCount} 首歌曲`);
            console.log(`   个人资料: ${profileMigrated ? '✅ 成功' : '❌ 失败'}`);
            console.log(`   系统设置: ${settingsCreated ? '✅ 成功' : '❌ 失败'}`);
            
            if (backupFile) {
                console.log(`   备份文件: ${backupFile}`);
            }

            console.log('\n🎉 数据迁移完成！');
            console.log('\n📁 新的数据文件位置:');
            console.log(`   歌曲数据: ${this.songsFile}`);
            console.log(`   个人资料: ${this.profileFile}`);
            console.log(`   系统设置: ${this.settingsFile}`);

            return true;
        } catch (error) {
            console.error('❌ 数据迁移失败:', error);
            return false;
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const migrator = new DataMigrator();
    migrator.migrate().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = DataMigrator;
