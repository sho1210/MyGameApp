const log = require('electron-log');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// 配置日志文件路径
const configureLogPath = () => {
  // 确保日志文件存储在应用数据目录下
  const userDataPath = app ? app.getPath('userData') : '';
  if (userDataPath) {
    // 创建日志目录
    const logDir = path.join(userDataPath, 'logs');
    try {
      // 确保日志目录存在
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        log.info(`创建日志目录: ${logDir}`);
      }
      // 配置主进程日志文件路径
      log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');
      
      // 配置渲染进程日志文件路径
      // 创建一个渲染进程专用的日志文件
      const rendererLogPath = path.join(logDir, 'renderer.log');
      
      // 在electron-log 5.x版本中，需要使用scope创建独立的日志实例
      // 而不是直接修改transports
      log.scope('renderer').transports.file.resolvePathFn = () => rendererLogPath;
      log.scope('renderer').transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [Renderer] {level} {text}';
      
      // 将scope实例保存到log.transports.rendererFile以便于访问
      log.transports.rendererFile = log.scope('renderer');
    } catch (error) {
      console.error(`创建日志目录失败: ${error.message}`);
    }
  }
};

// 配置日志级别和格式
const configureLog = () => {
  // 配置文件日志
  configureLogPath();
  
  // 配置控制台日志
  // 在生产环境中禁用控制台日志
  if (app && app.isPackaged) {
    // 生产环境：只记录警告和错误
    log.transports.console.level = false; // 禁用控制台输出
    log.transports.file.level = 'warn';   // 文件只记录warn及以上级别
  } else {
    // 开发环境：记录所有级别
    log.transports.console.level = 'silly'; // 控制台显示所有日志
    log.transports.file.level = 'silly';    // 文件记录所有日志
  }
  
  // 配置日志格式
  log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';
  log.transports.console.format = '[{level}] {text}';
  
  // 设置日志文件大小和轮转
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
  log.transports.file.archiveLogFolderName = 'old_logs';
};

// 重写console方法，在生产环境中将console重定向到electron-log
const overrideConsole = () => {
  if (app && app.isPackaged) {
    // 在生产环境中重写console方法
    // 只保留warn和error级别的日志，其他级别设为空函数
    console.log = () => {};
    console.info = () => {};
    console.warn = (...args) => log.warn(...args);
    console.error = (...args) => log.error(...args);
    console.debug = () => {};
  }
};

// 提供一个更新日志配置的方法，可以在运行时动态调整日志级别
const updateLogLevel = (level) => {
  if (['error', 'warn', 'info', 'debug', 'verbose', 'silly'].includes(level)) {
    log.transports.file.level = level;
    // 通知所有窗口日志配置已更新
    const { BrowserWindow } = require('electron');
    // 确保传递的对象是可序列化的，只传递简单的字符串值
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('log-config-updated', { level: level });
      }
    });
    log.info(`日志级别已更新为: ${level}`);
    return true;
  }
  return false;
};

// 获取当前日志配置
const getLogConfig = () => {
  // 确保返回的对象是可序列化的，只包含简单的字符串值
  return {
    fileLevel: String(log.transports.file.level),
    consoleLevel: log.transports.console.level ? String(log.transports.console.level) : false
  };
};

// 初始化日志系统
const initLog = () => {
  configureLog();
  overrideConsole();
  log.info('日志系统已初始化');
};

module.exports = {
  log,
  initLog,
  updateLogLevel,
  getLogConfig
};