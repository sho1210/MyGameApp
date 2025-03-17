const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 主题相关
  getTheme: () => ipcRenderer.sendSync('get-theme'),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getThemeColor: () => ipcRenderer.sendSync('get-theme-color'),
  setThemeColor: (color) => ipcRenderer.send('set-theme-color', color),
  
  // 游戏库管理
  getAllGames: () => ipcRenderer.send('get-all-games'),
  onGamesData: (callback) => ipcRenderer.on('games-data', callback),
  removeGamesDataListener: () => ipcRenderer.removeAllListeners('games-data'),
  
  addGame: (gameData) => ipcRenderer.send('add-game', gameData),
  updateGame: (gameData) => ipcRenderer.send('update-game', gameData),
  deleteGame: (gameId) => ipcRenderer.send('delete-game', gameId),
  onOperationResult: (callback) => ipcRenderer.on('operation-result', callback),
  removeOperationResultListener: () => ipcRenderer.removeAllListeners('operation-result'),
  
  // 文件对话框
  openFileDialog: (fileType) => ipcRenderer.send('open-file-dialog', fileType),
  onSelectedFile: (callback) => ipcRenderer.once('selected-file', callback),
  openDirectoryDialog: () => ipcRenderer.send('open-directory-dialog'),
  onSelectedDirectory: (callback) => ipcRenderer.once('selected-directory', callback),
  
  // 游戏详情
  getGameByCover: (coverPath) => ipcRenderer.send('get-game-by-cover', coverPath),
  onGetGameByCoverReply: (callback) => ipcRenderer.once('get-game-by-cover-reply', callback),
  removeGetGameByCoverReplyListener: () => ipcRenderer.removeAllListeners('get-game-by-cover-reply'),
  
  // 游戏启动和终止
  launchGame: (gameInfo) => ipcRenderer.send('launch-game', gameInfo),
  onGameLaunched: (callback) => ipcRenderer.once('game-launched', callback),
  removeGameLaunchedListener: () => ipcRenderer.removeAllListeners('game-launched'),
  
  onGameExited: (callback) => ipcRenderer.on('game-exited', callback),
  removeGameExitedListener: () => ipcRenderer.removeAllListeners('game-exited'),
  
  terminateGame: (gameName) => ipcRenderer.send('terminate-game', gameName),
  onTerminateGameReply: (callback) => ipcRenderer.once('terminate-game-reply', callback),
  removeTerminateGameReplyListener: () => ipcRenderer.removeAllListeners('terminate-game-reply'),
  
  // 封面管理
  getAllCovers: () => ipcRenderer.send('get-all-covers'),
  onGetAllCoversReply: (callback) => ipcRenderer.on('get-all-covers-reply', callback),
  removeGetAllCoversReplyListener: () => ipcRenderer.removeAllListeners('get-all-covers-reply'),
  
  // IGDB游戏信息相关
  getIGDBConfig: () => ipcRenderer.invoke('get-igdb-config'),
  saveIGDBConfig: (config) => ipcRenderer.invoke('save-igdb-config', config),
  testIGDBConnection: () => ipcRenderer.invoke('test-igdb-connection'),
  getGameInfo: (gameName) => ipcRenderer.invoke('get-game-info', gameName),
  saveGameInfo: (gameInfo) => ipcRenderer.invoke('save-game-info', gameInfo),
  // 游戏信息获取进度监听
  onGameInfoProgress: (callback) => ipcRenderer.on('game-info-progress', callback),
  removeGameInfoProgressListener: () => ipcRenderer.removeAllListeners('game-info-progress'),
  
  // 翻译功能
  translateText: (text) => ipcRenderer.send('translate-text', text),
  onTranslationResult: (callback) => ipcRenderer.on('translation-result', callback),
  removeTranslationResultListener: () => ipcRenderer.removeAllListeners('translation-result'),
  checkTranslationModel: () => ipcRenderer.invoke('check-translation-model'),
  onTranslationModelProgress: (callback) => ipcRenderer.on('translation-model-progress', callback),
  removeTranslationModelProgressListener: () => ipcRenderer.removeAllListeners('translation-model-progress'),
  // 强制检查并安装翻译模型和依赖
  forceCheckAndInstallModel: () => ipcRenderer.send('force-check-and-install-model'),
  
  // 重试下载模型（可选择使用备用源）
  retryModelDownload: (useAlternative = false) => ipcRenderer.send('retry-model-download', useAlternative),
  
  // 翻译模型相关API
  getTranslationModelStatus: () => ipcRenderer.invoke('get-translation-model-status'),
  onTranslationModelStatusUpdate: (callback) => ipcRenderer.on('translation-model-status-update', callback),
  removeTranslationModelStatusUpdateListener: () => ipcRenderer.removeAllListeners('translation-model-status-update'),
  
  // 数据备份和恢复
  backupData: () => ipcRenderer.send('backup-data'),
  onBackupDataReply: (callback) => ipcRenderer.once('backup-data-reply', callback),
  restoreData: () => ipcRenderer.send('restore-data'),
  onRestoreDataReply: (callback) => ipcRenderer.once('restore-data-reply', callback),
  
  // 应用重启
  restartApp: () => ipcRenderer.send('restart-app'),
  
  // 导出翻译模型
  exportTranslationModels: () => ipcRenderer.send('export-translation-models'),
  onExportTranslationModelsReply: (callback) => ipcRenderer.on('export-translation-models-reply', callback),
  
  // 导入翻译模型
  importTranslationModels: () => ipcRenderer.send('import-translation-models'),
  onImportTranslationModelsReply: (callback) => ipcRenderer.on('import-translation-models-reply', callback),
  
  // 日志相关
  log: (level, ...args) => {
    // 确保args中的所有对象都是可序列化的
    const serializableArgs = args.map(arg => {
      if (arg instanceof Error) {
        // 错误对象特殊处理
        return { 
          message: arg.message, 
          stack: arg.stack,
          name: arg.name,
          isError: true 
        };
      } else if (typeof arg === 'object' && arg !== null) {
        try {
          // 尝试序列化和反序列化，确保对象可以被克隆
          JSON.parse(JSON.stringify(arg));
          return arg;
        } catch (e) {
          // 如果对象不可序列化，返回字符串表示
          return `[不可序列化对象]: ${String(arg)}`;
        }
      }
      return arg;
    });
    
    ipcRenderer.send('log', { level, args: serializableArgs });
  },
  getLogConfig: () => ipcRenderer.invoke('get-log-config'),
  updateLogLevel: (level) => ipcRenderer.invoke('update-log-level', level),
  onLogConfigUpdated: (callback) => ipcRenderer.on('log-config-updated', callback),
  
  // 移除事件监听器
  removeListener: (channel, callback) => {
    if (allowedChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});

// 允许的IPC通道
const allowedChannels = [
  'games-data',
  'operation-result',
  'selected-file',
  'selected-directory',
  'get-game-by-cover-reply',
  'game-launched',
  'game-exited',
  'terminate-game-reply',
  'get-all-covers-reply',
  'translation-result',
  'translation-model-progress',
  'translation-model-status-update',
  'backup-data-reply',
  'restore-data-reply',
  'export-translation-models-reply',
  'import-translation-models-reply',
  'game-info-progress',
  'log-config-updated'
];