const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Database {
    constructor() {
        // 使用electron的app.getPath获取用户数据目录，这在打包后更可靠
        const userDataPath = app ? app.getPath('userData') : (process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.local/share'));
        const dbPath = path.join(userDataPath, 'games.db');

        // 确保数据库目录存在
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });

        this.db = new sqlite3(dbPath);

        // 创建游戏表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cover TEXT,
                back TEXT,
                workingDirectory TEXT,
                fileName TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_played TIMESTAMP,
                use_shell INTEGER DEFAULT 0
            )
        `);
        
        // 检查并添加use_shell列（如果不存在）
        const tableInfo = this.db.prepare("PRAGMA table_info(games)").all();
        if (!tableInfo.some(col => col.name === 'use_shell')) {
            this.db.exec('ALTER TABLE games ADD COLUMN use_shell INTEGER DEFAULT 0');
        }

        // 添加索引
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_games_name ON games(name)');
    }

    // 获取所有游戏
    getAllGames() {
        return this.db.prepare('SELECT * FROM games').all();
    }

    // 获取游戏总数
    getGamesCount() {
        return this.db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    }

    // 获取单个游戏
    getGameByName(name) {
        return this.db.prepare('SELECT * FROM games WHERE name = ?').get(name);
    }

    // 添加新游戏
    addGame(gameData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO games (name, cover, back, workingDirectory, fileName, description, use_shell)
                VALUES (@name, @cover, @back, @workingDirectory, @fileName, @description, @use_shell)
            `);            
            const result = stmt.run(gameData);
            console.log('添加游戏成功，参数:', JSON.stringify(gameData));
            return result;
        } catch (error) {
            console.error('添加游戏失败:', error.message);
            console.error('参数:', JSON.stringify(gameData));
            throw error;
        }
    }

    // 更新游戏
    updateGame(id, gameData) {
        try {
            const stmt = this.db.prepare(`
                UPDATE games
                SET name = @name,
                    cover = @cover,
                    back = @back,
                    workingDirectory = @workingDirectory,
                    fileName = @fileName,
                    description = @description,
                    use_shell = @use_shell,
                    last_played = CURRENT_TIMESTAMP
                WHERE id = @id
            `);
            const result = stmt.run({ ...gameData, id });
            console.log('更新游戏成功，参数:', JSON.stringify({ ...gameData, id }));
            return result;
        } catch (error) {
            console.error('更新游戏失败:', error.message);
            console.error('参数:', JSON.stringify({ ...gameData, id }));
            throw error;
        }
    }

    // 删除游戏
    deleteGame(id) {
        return this.db.prepare('DELETE FROM games WHERE id = ?').run(id);
    }

    // 更新最后游玩时间
    updateLastPlayed(id) {
        return this.db.prepare('UPDATE games SET last_played = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    }

    // 关闭数据库连接
    close() {
        this.db.close();
    }
}

module.exports = new Database();