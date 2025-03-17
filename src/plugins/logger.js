// Vue日志插件

// 创建一个日志对象，将日志转发到主进程
const logger = {
  error: (...args) => {
    if (window.electronAPI) {
      window.electronAPI.log('error', ...args);
    } else {
      console.error(...args);
    }
  },
  warn: (...args) => {
    if (window.electronAPI) {
      window.electronAPI.log('warn', ...args);
    } else {
      console.warn(...args);
    }
  },
  info: (...args) => {
    // 在生产环境中不输出info级别日志
    if (process.env.NODE_ENV !== 'production') {
      if (window.electronAPI) {
        window.electronAPI.log('info', ...args);
      } else {
        console.info(...args);
      }
    }
  },
  debug: (...args) => {
    // 在生产环境中不输出debug级别日志
    if (process.env.NODE_ENV !== 'production') {
      if (window.electronAPI) {
        window.electronAPI.log('debug', ...args);
      } else {
        console.debug(...args);
      }
    }
  },
  log: (...args) => {
    // 在生产环境中不输出log级别日志
    if (process.env.NODE_ENV !== 'production') {
      if (window.electronAPI) {
        window.electronAPI.log('info', ...args);
      } else {
        console.log(...args);
      }
    }
  },
  // 获取日志配置
  getConfig: async () => {
    if (window.electronAPI) {
      return await window.electronAPI.getLogConfig();
    }
    return null;
  },
  // 更新日志级别
  updateLevel: async (level) => {
    if (window.electronAPI) {
      return await window.electronAPI.updateLogLevel(level);
    }
    return false;
  },
  // 监听日志配置更新
  onConfigUpdated: (callback) => {
    if (window.electronAPI) {
      window.electronAPI.onLogConfigUpdated((event, config) => {
        callback(config);
      });
    }
  }
};

// 创建Vue插件
export default {
  install: (app) => {
    // 添加全局属性
    app.config.globalProperties.$log = logger;
    
    // 添加到Vue实例
    app.provide('logger', logger);
    
    // 在开发环境中，保留原始console方法
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    
    // 在生产环境中，重写console方法
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    // 重写console方法
    console.log = (...args) => logger.log(...args);
    console.info = (...args) => logger.info(...args);
    console.warn = (...args) => logger.warn(...args);
    console.error = (...args) => logger.error(...args);
    console.debug = (...args) => logger.debug(...args);
    
    // 保存原始console
    window._originalConsole = originalConsole;
  }
};