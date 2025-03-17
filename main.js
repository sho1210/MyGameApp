const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const database = require('./utils/database');
const psTree = require('ps-tree');
const { spawn } = require('child_process');
const themeConfig = require('./utils/themeConfig');
const translationService = require('./utils/translationService');
const gameInfoService = require('./utils/getinfoService');
const { log, initLog } = require('./utils/logConfig');

// 帮助函数：获取Python脚本的正确路径
function getPythonScriptPath(scriptName) {
  // 判断当前是否为打包后的应用
  const isPacked = app.isPackaged;
  
  // 开发环境下的路径
  const devPath = path.join(__dirname, 'utils', scriptName);
  
  // 生产环境下的路径（从extraResources目录查找）
  const prodPath = path.join(process.resourcesPath, 'app', 'utils', scriptName);
  
  // 备选路径（如果extraResources配置没生效）
  const altProdPath = path.join(app.getAppPath(), 'utils', scriptName);
  
  // 打包后，首先检查extraResources路径
  if (isPacked) {
    if (fs.existsSync(prodPath)) {
      console.log(`找到Python脚本(生产环境主路径): ${prodPath}`);
      return prodPath;
    }
    
    // 如果主路径不存在，检查备选路径
    if (fs.existsSync(altProdPath)) {
      console.log(`找到Python脚本(生产环境备选路径): ${altProdPath}`);
      return altProdPath;
    }
    
    // 尝试在当前目录和其子目录搜索脚本文件
    console.warn(`无法在预期路径找到脚本: ${scriptName}，尝试搜索...`);
    // 这里可以添加搜索逻辑，但可能会很慢，暂不实现
  }
  
  // 开发环境直接使用开发路径
  console.log(`使用Python脚本路径: ${isPacked ? prodPath : devPath}, 文件存在: ${fs.existsSync(isPacked ? prodPath : devPath)}`);
  return isPacked ? prodPath : devPath;
}

// 使用自定义themeConfig模块处理主题配置

// 主题相关的IPC处理
// 获取主题设置
ipcMain.on('get-theme', (event) => {
  event.returnValue = themeConfig.getTheme();
});

// 设置主题
ipcMain.on('set-theme', (event, theme) => {
  themeConfig.setTheme(theme);
});

// 获取主题色设置
ipcMain.on('get-theme-color', (event) => {
  event.returnValue = themeConfig.getThemeColor();
});

// 设置主题色
ipcMain.on('set-theme-color', (event, color) => {
  themeConfig.setThemeColor(color);
});

// 日志相关的IPC处理
// 从渲染进程接收日志
ipcMain.on('log', (event, { level, args }) => {
  // 处理来自渲染进程的日志，写入renderer.log
  try {
    // 处理可能的错误对象
    const processedArgs = args.map(arg => {
      if (arg && typeof arg === 'object' && arg.isError) {
        // 重建错误对象
        const error = new Error(arg.message);
        error.stack = arg.stack;
        error.name = arg.name;
        return error;
      }
      return arg;
    });
    
    if (['error', 'warn', 'info', 'debug', 'verbose', 'silly'].includes(level)) {
      // 使用渲染进程专用的日志通道
      if (log.transports.rendererFile) {
        // 使用scope实例的日志方法
        log.transports.rendererFile[level](...processedArgs);
      } else {
        // 如果渲染进程日志通道不可用，使用主进程日志
        log[level]('[Renderer]', ...processedArgs);
      }
    } else {
      // 默认使用info级别
      if (log.transports.rendererFile) {
        log.transports.rendererFile.info(...processedArgs);
      } else {
        log.info('[Renderer]', ...processedArgs);
      }
    }
  } catch (error) {
    // 记录处理日志时的错误
    log.error('处理渲染进程日志时出错:', error);
  }
});

// 获取日志配置
ipcMain.handle('get-log-config', () => {
  const { getLogConfig } = require('./utils/logConfig');
  return getLogConfig();
});

// 更新日志级别
ipcMain.handle('update-log-level', (event, level) => {
  const { updateLogLevel } = require('./utils/logConfig');
  return updateLogLevel(level);
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 930,  // 直接设置默认宽度
    height: 700, // 直接设置默认高度
    show: false, // 先隐藏窗口
    maximizable: true,
    frame: true,                                 // 添加标准窗口框架
    transparent: false,                          // 关闭透明
    backgroundMaterial: 'acrylic',               // Windows亚克力效果
    backgroundColor: '#1AFFFFFF',                // ARGB格式背景色（含透明度）
    visualEffectState: 'active',                 // 保持效果激活状态
    roundedCorners: true,                        // Windows 11圆角
    webPreferences: {
      webSecurity: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });
  win.setMenu(null);

  // 加载页面
  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, 'dist', 'index.html')
    : path.join(__dirname, 'dist', 'index.html');
  win.loadFile(indexPath).catch((err) => {
    console.error('Failed to load index.html:', err);
    app.quit();
  });

  // 页面加载完成后显示窗口
  win.once('ready-to-show', () => {
      // 确保窗口状态重置
    win.setMaximizable(true);
    win.setResizable(true);

    // 如果使用Windows系统，可以尝试强制刷新窗口
    if (process.platform === 'win32') {
      win.setBounds(win.getBounds());
    }
    win.show();
  });

  // 开发者工具（仅在开发环境中打开）
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }

  // 处理加载失败
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} - ${errorDescription}`);
    app.quit();
  });

};

app.whenReady().then(() => {
  // 初始化日志系统
  initLog();
  log.info('应用启动');
  
  // 获取Python脚本路径
  const translateScriptPath = getPythonScriptPath('translate.py');
  const downloadScriptPath = getPythonScriptPath('download_model.py');
  
  // 设置脚本路径
  translationService.setPythonScriptPaths({
    translateScript: translateScriptPath,
    downloadScript: downloadScriptPath
  });
  
  // 创建窗口
  createWindow();
  
  // 应用启动时，设置翻译模型进度监听器
  translationService.on('download-progress', (progress) => {
    log.info('应用启动时模型下载进度更新:', progress);
    // 广播进度到所有窗口
    BrowserWindow.getAllWindows().forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('translation-model-progress', progress);
      }
    });
  });

  // 启动时检查并安装依赖和模型
  translationService.autoCheckAndInstall();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});



// 游戏库管理相关的IPC处理

// 获取所有游戏
ipcMain.on('get-all-games', (event) => {
  try {
    const games = database.getAllGames();
    event.sender.send('games-data', games);
  } catch (error) {
    log.error('获取所有游戏失败:', error);
    event.sender.send('games-data', []);
  }
});

// 添加游戏
ipcMain.on('add-game', (event, gameData) => {
  try {
    const result = database.addGame(gameData);
    event.sender.send('operation-result', {
      success: true,
      message: '游戏添加成功',
      data: result
    });
  } catch (error) {
    console.error('添加游戏失败:', error);
    event.sender.send('operation-result', {
      success: false,
      message: `添加游戏失败: ${error.message}`
    });
  }
});
// 更新游戏
ipcMain.on('update-game', (event, gameData) => {
  try {
    // 净化数据对象，确保数据可序列化
    const sanitizedData = JSON.parse(JSON.stringify(gameData));
    const result = database.updateGame(sanitizedData.id, sanitizedData);
    
    // 确保返回数据可序列化，只发送一次响应
    const response = {
      success: true,
      message: '游戏更新成功',
      data: JSON.parse(JSON.stringify(result))
    };
    event.sender.send('operation-result', response);
  } catch (error) {
    console.error('更新游戏失败:', error);
    event.sender.send('operation-result', {
      success: false,
      message: `更新游戏失败: ${error.message}`
    });
  }
});

// 删除游戏
ipcMain.on('delete-game', (event, gameId) => {
  try {
    const result = database.deleteGame(gameId);
    event.sender.send('operation-result', {
      success: true,
      message: '游戏删除成功',
      data: result
    });
  } catch (error) {
    console.error('删除游戏失败:', error);
    event.sender.send('operation-result', {
      success: false,
      message: `删除游戏失败: ${error.message}`
    });
  }
});

// 翻译相关的IPC处理
// 翻译文本
ipcMain.on('translate-text', async (event, text) => {
  try {
    log.info(`收到翻译请求: "${text}"`);
    
    // 检查模型状态
    const status = translationService.getModelStatus();
    
    if (!status.isReady) {
      // 如果模型未准备好，开始下载
      if (!status.isDownloading) {
        log.info('翻译模型未准备好，开始下载...');
        translationService.downloadModel();
        
        // 监听下载进度
        translationService.on('download-progress', (progress) => {
          log.info('模型下载进度更新:', progress);
          event.sender.send('translation-model-progress', progress);
        });
      }
      
      // 通知前端模型未准备好
      event.sender.send('translation-result', {
        error: '翻译模型正在下载中，请稍后再试'
      });
      return;
    }
    
    // 模型已准备好，执行翻译
    log.info('开始翻译文本...');
    try {
      const result = await translationService.translateText(text);
      log.info('翻译成功:', result);
      
      // 发送翻译结果到渲染进程
      event.sender.send('translation-result', {
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage
      });
    } catch (translationError) {
      log.error('翻译过程中出错:', translationError);
      event.sender.send('translation-result', {
        error: translationError.message
      });
    }
  } catch (error) {
    log.error('处理翻译请求时出错:', error);
    event.sender.send('translation-result', {
      error: error.message
    });
  }
});

// 修复翻译模型下载进度监听器的编码问题
translationService.on('download-progress', (progress) => {
  try {
    // 创建深拷贝，避免对象引用问题
    const progressCopy = {
      stage: progress.stage,
      currentModelName: progress.currentModelName,
      percentage: progress.percentage
    };
    
    // 使用JSON.stringify确保对象能正确序列化，并保存一份可读的日志
    const progressStr = JSON.stringify(progressCopy, null, 2);
    log.info('模型下载进度更新:', progressStr);
    
    // 向所有窗口广播下载进度
    BrowserWindow.getAllWindows().forEach(window => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('translation-model-progress', progressCopy);
      }
    });
    
    // 如果状态变为完成，更新模型状态信息
    if (progressCopy.stage === 'completed' && progressCopy.percentage === 100) {
      // 确保状态信息也被更新
      const modelStatus = translationService.getModelStatus();
      log.info('翻译模型状态更新:', JSON.stringify(modelStatus, null, 2));
      
      BrowserWindow.getAllWindows().forEach(window => {
        if (window && !window.isDestroyed()) {
          window.webContents.send('translation-model-status-update', modelStatus);
        }
      });
    }
  } catch (error) {
    log.error('发送下载进度时出错:', error);
  }
});

// 检查翻译模型
ipcMain.handle('check-translation-model', () => {
    const status = translationService.getModelStatus();
  return status;
});

// 强制检查并安装翻译模型和依赖
ipcMain.on('force-check-and-install-model', () => {
  translationService.autoCheckAndInstall();
});

// 重试下载翻译模型
ipcMain.on('retry-model-download', (event, useAlternative = false) => {
  if (useAlternative) {
    // 使用备用源下载
    translationService.downloadModelFromAlternativeSource();
  } else {
    // 使用默认方式下载
        translationService.downloadModel();
  }
});

// 获取翻译模型状态
ipcMain.handle('get-translation-model-status', () => {
  return translationService.getModelStatus();
});

// 文件选择对话框
ipcMain.on('open-file-dialog', (event, fileType) => {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: fileType === 'image' ? [
      { name: '图片', extensions: ['jpg', 'png', 'jpeg', 'gif', 'webp'] }
    ] : []
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('selected-file', result.filePaths[0]);
    }
  }).catch(err => {
    log.error('打开文件对话框失败:', err);
  });
});

// 目录选择对话框
ipcMain.on('open-directory-dialog', (event) => {
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('selected-directory', result.filePaths[0]);
    }
  }).catch(err => {
    log.error('打开目录对话框失败:', err);
  });
});
// 获取所有游戏封面
ipcMain.on('get-all-covers', (event) => {
  try {
    log.info('主进程收到get-all-covers请求');
    const games = database.getAllGames();
    log.info('数据库查询结果', games);
    const covers = games.map(g => ({ cover: g.cover }));
    log.info('处理后的封面数据:', covers);
    event.sender.send('get-all-covers-reply', covers);
    log.info('已发送get-all-covers-reply响应');
  } catch (error) {
    log.error('获取所有游戏封面失败:', error);
    event.sender.send('get-all-covers-reply', {
      error: true,
      message: error.message
    });
  }
});
// 根据封面获取游戏信息
ipcMain.on('get-game-by-cover', (event, cover) => {
  try {
    log.info('收到根据封面获取游戏信息请求，封面路径:', cover);
    const games = database.getAllGames();
    
    // 标准化路径比较，忽略正反斜杠差异
    const normalizedCover = cover.replace(/\\/g, '/').toLowerCase();
    log.info('标准化后的请求封面路径:', normalizedCover);
    
    const game = games.find(g => {
      if (!g.cover) return false;
      const normalizedGameCover = g.cover.replace(/\\/g, '/').toLowerCase();
      log.info('比较游戏封面:', normalizedGameCover);
      return normalizedGameCover === normalizedCover;
    });
    
    log.info('查找结果:', game ? '找到游戏' : '未找到游戏');
    
    event.sender.send('get-game-by-cover-reply', game ? {
      name: game.name,
      background: game.back, 
      cover: game.cover,
      workingDirectory: game.workingDirectory,
      fileName: game.fileName,
      description: game.description
    } : null);
  } catch (error) {
    log.error('根据封面获取游戏信息失败:', error);
    event.sender.send('get-game-by-cover-reply', {
      error: true,
      message: error.message
    });
  }
});

// 获取游戏总数
ipcMain.on('get-game-count', (event) => {
  try {
    const count = database.getGamesCount();
    event.sender.send('get-game-count-reply', { count });
  } catch (error) {
    log.error('获取游戏总数失败:', error);
    event.sender.send('get-game-count-reply', {
      error: true,
      message: error.message
    });
  }
});

// 获取所有游戏名称
ipcMain.on('get-all-names', (event) => {
  try {
    const names = database.getAllGames().map(g => ({ name: g.name }));
    event.sender.send('get-all-names-reply', names);
  } catch (error) {
    log.error('获取所有游戏名称失败:', error);
    event.sender.send('get-all-names-reply', {
      error: true,
      message: error.message
    });
  }
});

// 根据名称获取游戏信息
ipcMain.handle('get-game-info', async (event, gameName) => {
  try {
    log.info(`正在获取游戏信息: ${gameName}`);
    
    // 发送初始进度信息
    sendGameInfoProgress(event, 10, '连接IGDB API', '正在获取');
    
    // 设置监听游戏信息获取进度的函数
    const progressCallback = (percentage, operation, status) => {
      sendGameInfoProgress(event, percentage, operation, status);
    };
    
    // 添加游戏信息服务的进度回调
    gameInfoService.setProgressCallback(progressCallback);
    
    // 调用搜索游戏函数
    sendGameInfoProgress(event, 20, '发送搜索请求', '正在获取');
    const result = await gameInfoService.searchGame(gameName);
    
    // 移除进度回调
    gameInfoService.clearProgressCallback();
    
    // 搜索完成发送进度信息
    if (result.success) {
      sendGameInfoProgress(event, 100, '搜索完成', '完成');
    } else {
      sendGameInfoProgress(event, 100, '搜索失败', '失败');
    }
    
    return result;
  } catch (error) {
    log.error('获取游戏信息失败:', error);
    // 发送错误进度信息
    sendGameInfoProgress(event, 100, '发生错误', '错误');
    return { 
      success: false, 
      message: error.message || '获取游戏信息失败'
    };
  }
});

// 发送游戏信息获取进度的辅助函数
function sendGameInfoProgress(event, percentage, operation, status) {
  if (!event || !event.sender) return;
  
  try {
    event.sender.send('game-info-progress', {
      percentage: percentage,
      operation: operation,
      status: status
    });
    log.info(`游戏信息获取进度: ${percentage}% - ${operation} (${status})`);
  } catch (error) {
    log.error('发送游戏信息进度失败:', error);
  }
}

// 保存游戏信息到数据库
ipcMain.handle('save-game-info', async (event, gameInfo) => {
  try {
    log.info('主进程收到保存游戏信息请求:', gameInfo?.name || '未知游戏');
    
    // 验证gameInfo是否是有效对象
    if (!gameInfo || typeof gameInfo !== 'object') {
      throw new Error('无效的游戏信息数据');
    }
    
    // 确保所有必需字段存在且格式正确
    const validatedGameInfo = {
      name: gameInfo.name || '未命名游戏',
      description: gameInfo.description || '',
      cover: gameInfo.cover || null,
      background: gameInfo.background || null,
      releaseDate: gameInfo.releaseDate || ''
    };
    
    log.info('验证游戏数据成功，调用保存函数');
    const result = await gameInfoService.saveGameToDatabase(validatedGameInfo);
    return result;
  } catch (error) {
    log.error('保存游戏信息失败:', error);
    return {
      success: false,
      message: `保存失败: ${error.message}`
    };
  }
});

// 存储当前运行的游戏进程信息
const runningGames = new Map();

// 获取进程树中的所有子进程
const getProcessTree = (pid) => {
  return new Promise((resolve) => {
    psTree(pid, (err, children) => {
      if (err) {
        log.error('获取进程树失败:', err);
        resolve([]);
      } else {
        resolve(children);
      }
    });
  });
};

// 终止进程及其所有子进程
const killProcessTree = async (pid) => {
  try {
    log.info(`正在终止进程树，主进程PID: ${pid}`);
    const children = await getProcessTree(pid);
    
    // 先终止所有子进程
    for (const child of children) {
      try {
        process.kill(child.PID);
        log.info(`已终止子进程: ${child.PID} (${child.COMMAND})`);
      } catch (err) {
        log.error(`终止子进程 ${child.PID} 失败:`, err);
      }
    }
    
    // 最后终止主进程
    try {
      process.kill(pid);
      log.info(`已终止主进程: ${pid}`);
    } catch (err) {
      log.error(`终止主进程 ${pid} 失败:`, err);
    }
    
    return true;
  } catch (error) {
    log.error('终止进程树失败:', error);
    return false;
  }
};

// 启动游戏
ipcMain.on('launch-game', (event, gameInfo) => {
  try {
    log.info('正在启动游戏:', gameInfo.name);
    
    // 检查必要参数
    if (!gameInfo.workingDirectory || !gameInfo.fileName) {
      throw new Error('缺少必要的游戏启动信息');
    }
    
    // 记录启动时间
    const launchTime = new Date().toLocaleString();
    log.info(`游戏启动时间: ${launchTime}`);
    
    // 定义启动游戏的函数
    const launchGameProcess = (useShell) => {
      return new Promise((resolve, reject) => {
        log.info(`尝试启动游戏 ${gameInfo.name}，使用shell: ${useShell}`);
        
        // 检查文件扩展名
        const fileExt = path.extname(gameInfo.fileName).toLowerCase();
        log.info(`游戏文件扩展名: ${fileExt}`);
        
        // 对.bat、.sh和.link文件强制使用shell执行
        const shouldUseShell = useShell || fileExt === '.bat' || fileExt === '.sh' || fileExt === '.link';
        
        // 设置启动选项，类似于C#中的ProcessStartInfo
        const gameProcess = spawn(gameInfo.fileName, [], {
          cwd: gameInfo.workingDirectory,  // 设置工作目录
          shell: shouldUseShell,          // 是否使用shell执行
          detached: false,                // 是否分离进程
        });
        
        // 保存进程信息
        const processInfo = {
          id: gameProcess.pid,
          name: gameInfo.name,
          startTime: launchTime,
          useShell: shouldUseShell,
          process: gameProcess  // 保存进程对象以便后续操作
        };
        
        // 将进程信息存储到全局Map中
        runningGames.set(gameInfo.name, processInfo);
        
        // 监听进程退出事件
        gameProcess.on('exit', async (code) => {
          const exitTime = new Date();
          const runTime = (exitTime - new Date(launchTime)) / 1000;
          
          log.info(`游戏 ${gameInfo.name} 主进程已退出：
            - 退出码: ${code}
            - 运行时间: ${runTime.toFixed(2)}秒
            - 使用shell: ${shouldUseShell}
            - 工作目录: ${gameInfo.workingDirectory}
            - 可执行文件: ${gameInfo.fileName}`);
          
          // 获取并终止所有子进程
          const children = await getProcessTree(gameProcess.pid);
          log.info(`游戏 ${gameInfo.name} 有 ${children.length} 个子进程需要清理`);
          
          // 终止所有子进程
          for (const child of children) {
            try {
              process.kill(child.PID);
              log.info(`已终止子进程: ${child.PID} (${child.COMMAND})`);
            } catch (err) {
              log.error(`终止子进程 ${child.PID} 失败:`, err);
            }
          }
          
          // 从运行中的游戏列表中移除
          runningGames.delete(gameInfo.name);
          
          // 检查游戏是否快速退出
          const exitDiagnostics = {
            quickExit: runTime < 1,
            exitCode: code,
            workingDirectoryExists: true,
            fileExists: true
          };
          
          try {
            // 检查工作目录是否存在
            exitDiagnostics.workingDirectoryExists = require('fs').existsSync(gameInfo.workingDirectory);
            // 检查可执行文件是否存在
            const fullPath = path.join(gameInfo.workingDirectory, gameInfo.fileName);
            exitDiagnostics.fileExists = require('fs').existsSync(fullPath);
          } catch (err) {
            log.error('检查文件系统时出错:', err);
          }
          
          // 如果游戏快速退出，更新启动方式偏好
          if (exitDiagnostics.quickExit) {
            try {
              // 获取游戏信息
              const game = database.getGameByName(gameInfo.name);
              if (game && game.id) {
                // 如果当前使用的是非shell模式且快速退出，则下次使用shell模式
                // 如果当前使用的是shell模式且快速退出，则保持shell模式
                const newUseShell = shouldUseShell ? 1 : 1; // 如果当前非shell且失败，切换到shell
                
                // 更新数据库中的启动方式偏好
                database.db.prepare('UPDATE games SET use_shell = ? WHERE id = ?').run(newUseShell, game.id);
                log.info(`游戏 ${gameInfo.name} 快速退出，已更新启动方式偏好为: ${newUseShell ? 'shell' : '非shell'}`);
              } else {
                log.info(`游戏 ${gameInfo.name} 在数据库中不存在或ID无效，无法更新启动方式偏好`);
              }
            } catch (err) {
              log.error('更新游戏启动方式偏好失败:', err);
            }
          }
          
          // 通知渲染进程游戏已退出
          event.sender.send('game-exited', {
            name: gameInfo.name,
            exitCode: code,
            exitTime: exitTime.toLocaleString(),
            useShell: shouldUseShell,
            childProcessCount: children.length,
            runTime: runTime,
            diagnostics: exitDiagnostics
          });
        });
        
        // 监听错误事件
        gameProcess.on('error', (err) => {
          log.error(`游戏 ${gameInfo.name} 启动错误，使用shell: ${shouldUseShell}:`, err);
          runningGames.delete(gameInfo.name);
          reject(err);
        });
        
        // 设置一个短暂的延时来检查进程是否成功启动
        setTimeout(() => {
          if (gameProcess.pid) {
            resolve(processInfo);
          }
        }, 1000);
      });
    };
    
    // 尝试启动游戏的主函数
    const tryLaunchGame = async () => {
      try {
        let processInfo;
        
        // 获取游戏的启动方式偏好
        const gameRecord = database.getGameByName(gameInfo.name);
        const preferUseShell = gameRecord && gameRecord.use_shell === 1;
        log.info(`游戏 ${gameInfo.name} 的启动方式偏好: ${preferUseShell ? 'shell' : '默认'}`);
        
        // 如果游戏记录不存在，记录日志
        if (!gameRecord) {
          log.info(`警告：游戏 ${gameInfo.name} 在数据库中不存在，将使用默认启动方式`);
        }
        
        // 检查文件扩展名
        const fileExt = path.extname(gameInfo.fileName).toLowerCase();
        
        // 对.bat、.sh和.link文件强制使用shell执行
        const shouldUseShell = fileExt === '.bat' || fileExt === '.sh' || fileExt === '.link';
        
        if (shouldUseShell) {
          // 如果是特殊脚本文件，直接使用shell启动
          log.info(`检测到脚本文件(${fileExt})，使用shell模式启动游戏 ${gameInfo.name}`);
          processInfo = await launchGameProcess(true);
        } else if (preferUseShell) {
          // 如果有使用shell的偏好设置，直接使用shell启动
          log.info(`根据之前的运行记录，使用shell模式启动游戏 ${gameInfo.name}`);
          processInfo = await launchGameProcess(true);
        } else {
          try {
            // 首先尝试不使用shell启动
            processInfo = await launchGameProcess(false);
          } catch (error) {
            // 如果失败，尝试使用shell启动
            log.info('第一次启动失败，尝试使用shell重新启动');
            processInfo = await launchGameProcess(true);
          }
        }
        
        // 游戏成功启动后，更新最后游玩时间
        if (gameRecord && gameRecord.id) {
          log.info(`更新游戏 ${gameInfo.name} (ID: ${gameRecord.id}) 的最后游玩时间`);
          database.updateLastPlayed(gameRecord.id);
        }
        
        // 只在成功启动后发送一次消息
        const responseInfo = {
          success: true,
          message: `游戏 ${gameInfo.name} 已成功启动`,
          processInfo: {
            id: processInfo.id,
            name: processInfo.name,
            startTime: processInfo.startTime,
            useShell: processInfo.useShell
          }
        };
        
        event.sender.send('game-launched', responseInfo);
      } catch (error) {
        // 所有尝试都失败后，发送错误消息
        event.sender.send('game-launched', {
          success: false,
          message: `启动游戏失败: ${error.message}`
        });
      }
    };
    
    // 开始尝试启动游戏
    tryLaunchGame();
  } catch (error) {
    log.error('启动游戏失败:', error);
    event.sender.send('game-launched', {
      success: false,
      message: `启动游戏失败: ${error.message}`
    });
  }
});

// 手动终止游戏进程
ipcMain.on('terminate-game', async (event, gameName) => {
  try {
    log.info(`收到终止游戏请求: ${gameName}`);
    
    const gameInfo = runningGames.get(gameName);
    if (!gameInfo) {
      throw new Error(`找不到运行中的游戏: ${gameName}`);
    }
    
    const pid = gameInfo.process.pid;
    const result = await killProcessTree(pid);
    
    event.sender.send('terminate-game-reply', {
      success: result,
      message: result ? `游戏 ${gameName} 已成功终止` : `终止游戏 ${gameName} 失败`,
      gameName
    });
  } catch (error) {
    log.error('终止游戏失败:', error);
    event.sender.send('terminate-game-reply', {
      success: false,
      message: `终止游戏失败: ${error.message}`,
      gameName
    });
  }
});

// IGDB配置获取处理程序
ipcMain.handle('get-igdb-config', async () => {
  log.info('获取IGDB配置');
  try {
    return gameInfoService.loadConfig();
          } catch (error) {
    log.error('获取IGDB配置失败:', error);
    return { 
      error: true, 
      message: error.message || '获取IGDB配置失败'
    };
  }
});

// IGDB连接测试处理程序
ipcMain.handle('test-igdb-connection', async () => {
  log.info('测试IGDB API连接');
  try {
    const result = await gameInfoService.testConnection();
    log.info('IGDB连接测试结果:', result);
    return result;
  } catch (error) {
    log.error('测试IGDB连接失败:', error);
    return {
      success: false,
      message: error.message || '测试IGDB连接失败'
    };
  }
});

// IGDB配置保存处理程序
ipcMain.handle('save-igdb-config', async (event, config) => {
  log.info('保存IGDB配置');
  try {
    if (!config || !config.clientId || !config.clientSecret) {
      throw new Error('缺少客户端ID或密钥');
    }
    
    const result = gameInfoService.setCredentials(config.clientId, config.clientSecret);
    log.info('IGDB配置保存结果:', result);
    return {
      success: true,
      message: 'IGDB配置保存成功'
    };
  } catch (error) {
    log.error('保存IGDB配置失败:', error);
    return {
      success: false,
      message: error.message || '保存IGDB配置失败'
    };
  }
});

// 备份数据处理程序
ipcMain.on('backup-data', async (event) => {
  try {
    log.info('正在备份数据...');
    
    // 打开文件保存对话框，让用户选择备份文件的保存位置
    const result = await dialog.showSaveDialog({
      title: '保存备份',
      defaultPath: path.join(app.getPath('documents'), 'mygameapp_backup.db'),
      filters: [
        { name: '数据库文件', extensions: ['db'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      log.info('用户取消了备份操作');
      event.sender.send('backup-data-reply', {
        success: false,
        message: '备份操作已取消'
      });
      return;
    }
    
    // 获取数据库路径
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'games.db');
    
    // 确保数据库连接关闭（为了安全复制）
    database.close();
    
    // 复制数据库文件到用户选择的位置
    fs.copyFileSync(dbPath, result.filePath);
    
    // 重新打开数据库连接（这里假设数据库模块有一个init或connect方法，根据实际情况调整）
    database.connect && database.connect();
    
    log.info(`数据成功备份到: ${result.filePath}`);
    event.sender.send('backup-data-reply', {
      success: true,
      message: `数据已成功备份到: ${result.filePath}`
    });
  } catch (error) {
    log.error('备份数据失败:', error);
    event.sender.send('backup-data-reply', {
      success: false,
      message: `备份失败: ${error.message}`
    });
    
    // 确保数据库连接重新打开
    try {
      database.connect && database.connect();
    } catch (e) {
      log.error('重新打开数据库连接失败:', e);
    }
  }
});

// 恢复数据处理程序
ipcMain.on('restore-data', async (event) => {
  try {
    log.info('正在恢复数据...');
    
    // 打开文件选择对话框，让用户选择备份文件
    const result = await dialog.showOpenDialog({
      title: '选择备份文件',
      properties: ['openFile'],
      filters: [
        { name: '数据库文件', extensions: ['db'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      log.info('用户取消了恢复操作');
      event.sender.send('restore-data-reply', {
        success: false,
        message: '恢复操作已取消'
      });
      return;
    }
    
    const backupPath = result.filePaths[0];
    
    // 获取数据库路径
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'games.db');
    
    // 确保数据库连接关闭
    database.close();
    
    // 创建当前数据库的备份，以防恢复出问题
    const currentBackupPath = `${dbPath}.backup_${Date.now()}`;
    fs.copyFileSync(dbPath, currentBackupPath);
    
    // 复制备份文件到数据库位置
    fs.copyFileSync(backupPath, dbPath);
    
    // 重新打开数据库连接
    database.connect && database.connect();
    
    log.info(`数据已从 ${backupPath} 成功恢复`);
    event.sender.send('restore-data-reply', {
      success: true,
      message: '数据已成功恢复，应用需要重启以加载新数据'
    });
    
    // 延迟一下让用户看到成功消息，然后重启应用
    setTimeout(() => {
  app.relaunch();
      app.exit();
    }, 3000);
    
  } catch (error) {
    log.error('恢复数据失败:', error);
    event.sender.send('restore-data-reply', {
        success: false,
      message: `恢复失败: ${error.message}`
    });
    
    // 确保数据库连接重新打开
    try {
      database.connect && database.connect();
    } catch (e) {
      log.error('重新打开数据库连接失败:', e);
    }
  }
});

// 应用重启处理程序
ipcMain.on('restart-app', () => {
  log.info('重启应用...');
  //app.relaunch();
  //app.exit();
});

// 导出翻译模型处理程序
ipcMain.on('export-translation-models', async (event) => {
  try {
    log.info('正在导出翻译模型...');
    
    // 获取翻译模型目录
    const modelDir = path.join(app.getPath('userData'), 'translation_models');
    
    // 检查模型目录是否存在
    if (!fs.existsSync(modelDir)) {
      log.error('翻译模型目录不存在:', modelDir);
      event.sender.send('export-translation-models-reply', {
        success: false,
        message: '翻译模型目录不存在，请先下载模型'
      });
      return;
    }
    
    // 打开文件夹选择对话框
    const result = await dialog.showOpenDialog({
      title: '选择导出目标文件夹',
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      log.info('用户取消了导出操作');
      event.sender.send('export-translation-models-reply', {
        success: false,
        message: '导出操作已取消'
      });
      return;
    }
    
    const exportPath = path.join(result.filePaths[0], 'translation_models');
    
    // 确保目标目录存在
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
    
    // 使用fs-extra的复制功能
    const fsExtra = require('fs-extra');
    await fsExtra.copy(modelDir, exportPath, {
      overwrite: true,
      recursive: true,
      errorOnExist: false
    });
    
    log.info(`翻译模型已导出到: ${exportPath}`);
    event.sender.send('export-translation-models-reply', {
      success: true,
      message: `翻译模型已成功导出到: ${exportPath}`
    });
  } catch (error) {
    log.error('导出翻译模型失败:', error);
    event.sender.send('export-translation-models-reply', {
      success: false,
      message: `导出失败: ${error.message}`
    });
  }
});

// 导入翻译模型处理程序
ipcMain.on('import-translation-models', async (event) => {
  try {
    log.info('正在导入翻译模型...');
    
    // 获取翻译模型目录
    const modelDir = path.join(app.getPath('userData'), 'translation_models');
    
    // 打开文件夹选择对话框
    const result = await dialog.showOpenDialog({
      title: '选择包含翻译模型的文件夹',
      properties: ['openDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      log.info('用户取消了导入操作');
      event.sender.send('import-translation-models-reply', {
        success: false,
        message: '导入操作已取消'
      });
      return;
    }
    
    // 检查选择的文件夹是否包含模型文件
    const selectedDir = result.filePaths[0];
    let importSourceDir = selectedDir;
    
    // 检查是否选择了translation_models文件夹的父目录
    const possibleModelDir = path.join(selectedDir, 'translation_models');
    if (fs.existsSync(possibleModelDir)) {
      importSourceDir = possibleModelDir;
    }
    
    // 检查模型子目录是否存在
    const modelSubdirs = ['Helsinki-NLP/opus-mt-zh-en', 'Helsinki-NLP/opus-mt-en-zh'].map(name => 
      path.join(importSourceDir, name.replace('/', path.sep))
    );
    
    let hasModelFiles = false;
    for (const dir of modelSubdirs) {
      if (fs.existsSync(dir)) {
        const configPath = path.join(dir, 'config.json');
        if (fs.existsSync(configPath)) {
          hasModelFiles = true;
          break;
        }
      }
    }
    
    if (!hasModelFiles) {
      log.error('所选文件夹不包含有效的翻译模型文件');
      event.sender.send('import-translation-models-reply', {
        success: false,
        message: '所选文件夹不包含有效的翻译模型文件'
      });
      return;
    }
    
    // 备份原有模型文件夹（如果存在）
    if (fs.existsSync(modelDir)) {
      const backupDir = `${modelDir}_backup_${Date.now()}`;
      await fs.promises.rename(modelDir, backupDir);
      log.info(`已将原模型备份到: ${backupDir}`);
    }
    
    // 确保目标目录存在
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // 使用fs-extra的复制功能
    const fsExtra = require('fs-extra');
    await fsExtra.copy(importSourceDir, modelDir, {
      overwrite: true,
      recursive: true,
      errorOnExist: false
    });
    
    log.info(`翻译模型已导入到: ${modelDir}`);
    
    // 通知翻译服务重新加载模型
    translationService.isModelReady = false;
    translationService._checkModelExists();
    
    event.sender.send('import-translation-models-reply', {
      success: true,
      message: '翻译模型已成功导入，应用需要重启以加载新模型'
    });
  } catch (error) {
    log.error('导入翻译模型失败:', error);
    event.sender.send('import-translation-models-reply', {
      success: false,
      message: `导入失败: ${error.message}`
    });
  }
});

