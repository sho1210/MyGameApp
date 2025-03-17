const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ThemeConfig {
    constructor() {
        // 确保配置目录存在
        this.configDir = path.join(app.getPath('userData'), 'config');
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
        this.configPath = path.join(this.configDir, 'theme-config.json');
        
        // 初始化配置文件
        this.initConfig();
    }

    initConfig() {
        if (!fs.existsSync(this.configPath)) {
            const defaultConfig = {
                theme: 'light',
                themeColor: '#007AFF'
            };
            this.saveConfig(defaultConfig);
        }
    }

    getConfig() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('读取主题配置失败:', error);
            return {
                theme: 'light',
                themeColor: '#007AFF'
            };
        }
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            return true;
        } catch (error) {
            console.error('保存主题配置失败:', error);
            return false;
        }
    }

    getTheme() {
        return this.getConfig().theme;
    }

    getThemeColor() {
        return this.getConfig().themeColor;
    }

    setTheme(theme) {
        const config = this.getConfig();
        config.theme = theme;
        return this.saveConfig(config);
    }

    setThemeColor(color) {
        const config = this.getConfig();
        config.themeColor = color;
        return this.saveConfig(config);
    }
}

module.exports = new ThemeConfig();