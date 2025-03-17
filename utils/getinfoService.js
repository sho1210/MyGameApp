const path = require('path');
const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
const { app } = require('electron');
const translationService = require('./translationService');
const database = require('./database');

// IGDB API配置
let clientId = '';
let clientSecret = '';
let accessToken = '';
let tokenExpiration = 0;

// 进度回调函数
let progressCallback = null;

// 设置进度回调
const setProgressCallback = (callback) => {
  progressCallback = callback;
};

// 清除进度回调
const clearProgressCallback = () => {
  progressCallback = null;
};

// 更新进度的辅助函数
const updateProgress = (percentage, operation, status = '正在获取') => {
  if (progressCallback && typeof progressCallback === 'function') {
    try {
      progressCallback(percentage, operation, status);
    } catch (error) {
      console.error('调用进度回调失败:', error);
    }
  }
};

// 默认配置文件路径
const getConfigPath = () => {
  // 使用electron应用的userData目录
  let userDataPath;
  if (app && app.getPath) {
    try {
      userDataPath = app.getPath('userData');
      console.log('应用数据目录: ' + userDataPath);
    } catch (e) {
      console.error('获取userData路径失败: ', e);
      userDataPath = process.env.APPDATA || 
                    (process.platform == 'darwin' ? 
                     process.env.HOME + '/Library/Preferences' : 
                     process.env.HOME + "/.local/share");
      console.log('使用备用数据目录: ' + userDataPath);
    }
  } else {
    // 如果app不可用，使用临时目录
    userDataPath = require('os').tmpdir();
    console.log('使用临时目录: ' + userDataPath);
  }
  
  const configPath = path.join(userDataPath, 'igdb_config.json');
  console.log('IGDB配置文件路径: ' + configPath);
  return configPath;
};

// 保存配置
const saveConfig = (config) => {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);
    
    // 确保目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 确保要写入的是有效数据
    if (!config || typeof config !== 'object') {
      throw new Error('无效的配置数据');
    }
    
    // 保存之前打印配置信息（隐藏敏感信息）
    console.log('即将保存的配置: ', {
      clientId: config.clientId ? config.clientId.substring(0, 3) + '...' : '未设置',
      clientSecret: config.clientSecret ? '已设置(隐藏)' : '未设置',
      accessToken: config.accessToken ? '已设置(隐藏)' : '未设置',
      tokenExpiration: config.tokenExpiration ? new Date(config.tokenExpiration).toLocaleString() : '未设置'
    });
    
    // 写入配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    // 验证文件是否成功写入
    if (fs.existsSync(configPath)) {
      const stats = fs.statSync(configPath);
      console.log(`配置已保存，文件大小: ${stats.size} 字节`);
      return true;
    } else {
      console.error('配置文件保存失败，文件不存在');
      return false;
    }
  } catch (error) {
    console.error('保存IGDB配置失败:', error);
    return false;
  }
};

// 加载配置
const loadConfig = () => {
  try {
    const configPath = getConfigPath();
    
    if (fs.existsSync(configPath)) {
      // 读取文件内容
      const fileContent = fs.readFileSync(configPath, 'utf8');
      console.log(`配置文件已找到，大小: ${fileContent.length} 字符`);
      
      // 解析JSON内容
      const config = JSON.parse(fileContent);
      
      // 更新全局变量
      clientId = config.clientId || '';
      clientSecret = config.clientSecret || '';
      accessToken = config.accessToken || '';
      tokenExpiration = config.tokenExpiration || 0;
      
      console.log('配置加载成功，状态:', {
        clientId: clientId ? clientId.substring(0, 3) + '...' : '未设置',
        clientSecret: clientSecret ? '已设置' : '未设置',
        accessToken: accessToken ? '已设置' : '未设置',
        tokenExpiration: tokenExpiration ? new Date(tokenExpiration).toLocaleString() : '未设置'
      });
      
      return config;
    } else {
      console.log('配置文件不存在，将使用默认配置');
      return { clientId: '', clientSecret: '', accessToken: '', tokenExpiration: 0 };
    }
  } catch (error) {
    console.error('加载IGDB配置失败:', error);
    return { clientId: '', clientSecret: '', accessToken: '', tokenExpiration: 0 };
  }
};

// 设置API凭据
const setCredentials = (id, secret) => {
  try {
    if (!id || !secret) {
      console.error('设置凭据失败: Client ID或Client Secret为空');
      return false;
    }
    
    console.log('设置IGDB凭据: ', {
      clientId: id ? id.substring(0, 3) + '...' : '未提供',
      clientSecret: secret ? '已提供' : '未提供'
    });
    
    // 更新全局变量
    clientId = id;
    clientSecret = secret;
    
    // 重置token信息
    accessToken = '';
    tokenExpiration = 0;
    
    // 创建配置对象
    const config = {
      clientId,
      clientSecret,
      accessToken,
      tokenExpiration
    };
    
    // 保存配置
    const result = saveConfig(config);
    
    // 验证保存后的配置
    if (result) {
      const savedConfig = loadConfig();
      if (savedConfig.clientId === id && savedConfig.clientSecret === secret) {
        console.log('凭据已成功保存并验证');
        return true;
      } else {
        console.error('凭据保存验证失败');
        return false;
      }
    }
    
    return result;
  } catch (error) {
    console.error('设置IGDB凭据失败:', error);
    return false;
  }
};

// 直接从Twitch获取OAuth令牌
const getTwitchToken = async () => {
  try {
    console.log('正在从Twitch获取OAuth令牌...');
    
    const tokenUrl = `https://id.twitch.tv/oauth2/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    });
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      body: params
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`获取令牌失败，状态码: ${response.status}, 响应:`, errorText);
      throw new Error(`无法获取访问令牌，状态码: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      console.error('获取令牌失败，响应:', data);
      throw new Error('无法获取访问令牌');
    }
    
    console.log('成功获取Twitch令牌');
    
    // 获取令牌的自然有效期（通常是14400秒，即4小时）
    const originalExpiresIn = data.expires_in || 14400;
    
    // 我们将令牌视为有效期为30天，无论其实际过期时间如何
    // 但我们在内部存储实际过期时间的80%，以确保在令牌实际过期前刷新
    const safeExpiresIn = Math.floor(originalExpiresIn * 0.8);
    
    console.log(`令牌原始有效期: ${originalExpiresIn}秒，安全有效期: ${safeExpiresIn}秒`);
    console.log(`设置令牌有效期为30天，将在 ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleString()} 过期`);
    
    return {
      accessToken: data.access_token,
      expiresIn: 30 * 24 * 60 * 60, // 30天（秒为单位）
      originalExpiresIn: originalExpiresIn,
      safeExpiresIn: safeExpiresIn
    };
  } catch (error) {
    console.error('获取Twitch令牌失败:', error.message);
    throw new Error(`获取Twitch令牌失败: ${error.message}`);
  }
};

// 使用fetch调用IGDB API
const makeIGDBRequest = async (endpoint, query) => {
  try {
    console.log(`请求IGDB API - 端点: ${endpoint}, 查询:`, query);
    
    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      },
      body: query
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`IGDB API请求失败，状态码: ${response.status}, 响应:`, errorText);
      throw new Error(`IGDB API请求失败，状态码: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`IGDB API请求失败(${endpoint}):`, error.message);
    throw new Error(`IGDB API请求失败: ${error.message}`);
  }
};

// 获取IGDB API连接状态
const getApiStatus = async () => {
  try {
    // 确保有凭据
    if (!clientId || !clientSecret) {
      console.log('缺少API凭据，尝试从配置加载...');
      const config = loadConfig();
      
      if (!config.clientId || !config.clientSecret) {
        console.error('配置中没有有效的API凭据');
        throw new Error('缺少IGDB API凭据，请在设置中配置');
      } else {
        clientId = config.clientId;
        clientSecret = config.clientSecret;
        accessToken = config.accessToken;
        tokenExpiration = config.tokenExpiration;
        console.log('从配置中加载了凭据');
      }
    }
    
    console.log('凭据状态: ', {
      clientId: clientId ? '已设置' : '未设置',
      clientSecret: clientSecret ? '已设置' : '未设置',
      token: accessToken ? '已设置' : '未设置',
      tokenExpires: tokenExpiration ? new Date(tokenExpiration).toLocaleString() : '未设置'
    });
    
    // 检查是否需要获取新令牌
    const now = Date.now();
    
    // 当距离上次获取令牌超过25天时，无论是否过期都重新获取
    // 这确保了我们最多每25天刷新一次令牌，保持令牌的长期有效性
    const TOKEN_REFRESH_INTERVAL = 25 * 24 * 60 * 60 * 1000; // 25天（毫秒为单位）
    const shouldRefreshByTime = accessToken && tokenExpiration && 
                               (now - (tokenExpiration - (30 * 24 * 60 * 60 * 1000))) > TOKEN_REFRESH_INTERVAL;
    
    if (!accessToken || now >= tokenExpiration || shouldRefreshByTime) {
      const reason = !accessToken ? '令牌不存在' : 
                    now >= tokenExpiration ? '令牌已过期' : 
                    '令牌接近30天自动刷新期';
      console.log(`需要获取新令牌，原因: ${reason}`);
      
      try {
        // 获取Twitch令牌
        const tokenData = await getTwitchToken();
        
        accessToken = tokenData.accessToken;
        // 设置令牌过期时间为30天后
        tokenExpiration = Date.now() + (tokenData.expiresIn * 1000);
        
        console.log(`令牌获取成功，过期时间: ${new Date(tokenExpiration).toLocaleString()} (30天后)`);
        
        // 保存新令牌到配置
        saveConfig({
          clientId,
          clientSecret,
          accessToken,
          tokenExpiration
        });
      } catch (error) {
        console.error('获取令牌失败:', error);
        throw new Error(`获取访问令牌失败: ${error.message}`);
      }
    } else {
      // 计算令牌剩余有效期
      const remainingTime = tokenExpiration - now;
      const remainingDays = Math.floor(remainingTime / (24 * 60 * 60 * 1000));
      const remainingHours = Math.floor((remainingTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      
      console.log(`当前令牌仍然有效，剩余时间: ${remainingDays}天${remainingHours}小时 (${new Date(tokenExpiration).toLocaleString()})`);
    }
    
    return true;
  } catch (error) {
    console.error('获取API状态失败:', error);
    throw error;
  }
};

// 测试API连接
const testConnection = async () => {
  try {
    console.log('测试IGDB API连接...');
    
    // 强制重新加载配置
    loadConfig();
    
    // 检查凭据是否存在
    if (!clientId || !clientSecret) {
      console.error('测试连接失败: 没有设置API凭据');
      return {
        success: false,
        message: '未设置API凭据，请先在设置中配置Client ID和Client Secret'
      };
    }
    
    // 获取API状态，确保有有效的令牌
    await getApiStatus();
    
    // 执行简单查询
    console.log('执行测试查询...');
    const data = await makeIGDBRequest('games', 'fields name; limit 1;');
    
    console.log('查询结果:', data);
    return {
      success: true,
      message: '连接成功',
      data: data
    };
  } catch (error) {
    console.error('测试连接失败:', error);
    // 处理特定类型的错误
    if (error.message.includes('缺少IGDB API凭据')) {
      return {
        success: false,
        message: '请先在设置中配置IGDB API凭据'
      };
    }
    
    return {
      success: false,
      message: `连接失败: ${error.message}`,
      error: error.toString()
    };
  }
};

// 翻译游戏描述信息
const translateGameDescription = async (description) => {
  try {
    if (!description) {
      return "暂无描述";
    }
    
    console.log('翻译游戏描述...');
    const result = await translationService.translateText(description);
    
    if (result && result.translatedText) {
      console.log('翻译成功');
      return result.translatedText;
    } else {
      console.log('翻译失败，使用原始描述');
      return description;
    }
  } catch (error) {
    console.error('翻译游戏描述失败:', error);
    return description; // 翻译失败时返回原始描述
  }
};

// 将游戏信息保存到数据库
const saveGameToDatabase = async (gameInfo) => {
  try {
    console.log('保存游戏信息到数据库:', gameInfo.name);
    
    // 检查数据库中是否已存在此游戏
    const existingGame = database.getGameByName(gameInfo.name);
    
    // 准备游戏数据
    const gameData = {
      name: gameInfo.name,
      cover: gameInfo.cover,
      back: gameInfo.background,
      description: gameInfo.description,
      workingDirectory: '',  // 初始设为空
      fileName: '',  // 初始设为空
      use_shell: 0  // 默认为0
    };
    
    let result;
    if (existingGame) {
      // 更新现有游戏
      console.log('更新现有游戏:', existingGame.id);
      result = database.updateGame(existingGame.id, gameData);
    } else {
      // 添加新游戏
      console.log('添加新游戏');
      result = database.addGame(gameData);
    }
    
    console.log('保存游戏信息结果:', result);
    return {
      success: true,
      message: existingGame ? '游戏信息已更新' : '游戏已添加到库',
      gameId: existingGame ? existingGame.id : result.lastInsertRowid
    };
  } catch (error) {
    console.error('保存游戏信息到数据库失败:', error);
    return {
      success: false,
      message: `保存失败: ${error.message}`
    };
  }
};

// 搜索游戏信息
const searchGame = async (gameName) => {
  try {
    if (!gameName || typeof gameName !== 'string' || !gameName.trim()) {
      return { 
        success: false, 
        message: '请输入有效的游戏名称'
      };
    }
    
    console.log(`搜索游戏: "${gameName}"`);
    updateProgress(15, '验证搜索参数');
    
    // 确保有有效的令牌
    updateProgress(20, '获取API令牌');
    await getApiStatus();
    
    // 构建查询 - 现在获取4个结果而不是5个
    const query = `search "${gameName}"; fields name,summary,cover.url,screenshots.url,first_release_date; limit 4;`;
    
    // 执行搜索查询
    console.log('发送查询...');
    updateProgress(30, '向IGDB发送搜索请求');
    const responseData = await makeIGDBRequest('games', query);
    
    if (responseData && responseData.length > 0) {
      console.log(`找到 ${responseData.length} 个结果`);
      updateProgress(40, `找到 ${responseData.length} 个结果`);
      
      // 存储所有处理后的游戏结果
      const processedResults = [];
      
      // 处理每个游戏结果
      for (let i = 0; i < responseData.length; i++) {
        const game = responseData[i];
        const progressPercentage = 40 + Math.floor((i / responseData.length) * 40); // 40% - 80%的进度
        
        console.log(`处理游戏: ${game.name} (ID: ${game.id})`);
        updateProgress(progressPercentage, `处理游戏: ${game.name}`);
        
        // 获取用户数据目录用于保存图片
        const userDataPath = app.getPath('userData');
        const imagesDir = path.join(userDataPath, 'game_images', game.id.toString());
        
        // 确保图片目录存在
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        // 处理结果数据
        const result = {
          name: game.name,
          description: game.summary || '暂无描述',
          originalDescription: game.summary || '暂无描述', // 保存原始描述
          releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toLocaleDateString() : '未知',
          cover: null,
          background: null
        };
        
        // 如果没有封面或截图，则获取更多数据
        if (!game.cover || !game.screenshots) {
          try {
            console.log(`获取额外游戏媒体资源, ID: ${game.id}`);
            updateProgress(progressPercentage + 1, `获取游戏 ${game.name} 的媒体资源`);
            
            // 获取封面
            if (!game.cover) {
              console.log('获取游戏封面...');
              updateProgress(progressPercentage + 2, `获取游戏 ${game.name} 的封面`);
              const coverQuery = `fields url; where game = ${game.id}; limit 1;`;
              const coverData = await makeIGDBRequest('covers', coverQuery);
              
              if (coverData && coverData.length > 0) {
                game.cover = coverData[0];
                console.log('成功获取封面');
              }
            }
            
            // 获取截图
            if (!game.screenshots) {
              console.log('获取游戏截图...');
              updateProgress(progressPercentage + 3, `获取游戏 ${game.name} 的截图`);
              const screenshotsQuery = `fields url; where game = ${game.id}; limit 5;`;
              const screenshotsData = await makeIGDBRequest('screenshots', screenshotsQuery);
              
              if (screenshotsData && screenshotsData.length > 0) {
                game.screenshots = screenshotsData;
                console.log(`成功获取 ${screenshotsData.length} 张截图`);
              }
            }
          } catch (error) {
            console.error('获取额外游戏信息失败:', error);
          }
        }
        
        // 下载封面图片
        if (game.cover && game.cover.url) {
          // 转换图片URL为高清版本
          const hdCoverUrl = game.cover.url.replace('t_thumb', 't_cover_big');
          const coverUrl = `https:${hdCoverUrl}`;
          const coverPath = path.join(imagesDir, 'cover.jpg');
          
          try {
            console.log(`下载封面图片: ${coverUrl}`);
            updateProgress(progressPercentage + 4, `下载游戏 ${game.name} 的封面图片`);
            result.cover = await downloadImage(coverUrl, coverPath);
            console.log('封面图片已保存至:', result.cover);
          } catch (err) {
            console.error('下载封面图片失败:', err);
          }
        }
        
        // 下载背景图片
        if (game.screenshots && game.screenshots.length > 0) {
          // 使用第一张截图作为背景
          const hdScreenshotUrl = game.screenshots[0].url.replace('t_thumb', 't_screenshot_huge');
          const backgroundUrl = `https:${hdScreenshotUrl}`;
          const backgroundPath = path.join(imagesDir, 'background.jpg');
          
          try {
            console.log(`下载背景图片: ${backgroundUrl}`);
            updateProgress(progressPercentage + 5, `下载游戏 ${game.name} 的背景图片`);
            result.background = await downloadImage(backgroundUrl, backgroundPath);
            console.log('背景图片已保存至:', result.background);
          } catch (err) {
            console.error('下载背景图片失败:', err);
          }
        }
        
        // 翻译游戏描述到中文
        try {
          updateProgress(progressPercentage + 6, `翻译游戏 ${game.name} 的描述`);
          result.description = await translateGameDescription(result.description);
        } catch (err) {
          console.error('翻译游戏描述失败:', err);
          // 保持原始描述
        }
        
        // 添加处理后的结果
        processedResults.push(result);
      }
      
      updateProgress(90, '完成所有游戏处理');
      
      return {
        success: true,
        data: processedResults
      };
    } else {
      console.log(`未找到游戏: "${gameName}"`);
      updateProgress(50, '未找到任何游戏', '失败');
      return {
        success: false,
        message: '未找到游戏'
      };
    }
  } catch (error) {
    console.error('搜索游戏信息失败:', error);
    updateProgress(50, `搜索失败: ${error.message}`, '错误');
    return {
      success: false,
      message: error.message || '搜索游戏信息失败',
      error: error.toString()
    };
  }
};

// 下载图片 - 使用 node-fetch 替代原来的 https 模块
const downloadImage = async (url, targetPath) => {
  try {
    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`无法下载图片，状态码: ${response.status}`);
    }
    
    const fileStream = fs.createWriteStream(targetPath);
    const buffer = await response.buffer();
    
    // 写入文件
    fs.writeFileSync(targetPath, buffer);
    
    return targetPath;
  } catch (error) {
    console.error('下载图片失败:', error);
    throw error;
  }
};

// 初始化 - 加载配置并设置定时检查令牌
loadConfig();

// 添加一个函数，用于定期检查和刷新令牌
const setupTokenRefresh = () => {
  // 每12小时检查一次令牌状态
  const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12小时（毫秒）
  
  console.log('设置令牌自动刷新，检查间隔: 12小时');
  
  // 定义检查函数
  const checkAndRefreshToken = async () => {
    try {
      console.log('执行定期令牌检查...');
      const now = Date.now();
      
      // 如果没有令牌或凭据，则跳过
      if (!clientId || !clientSecret) {
        console.log('未配置API凭据，跳过令牌检查');
        return;
      }
      
      // 如果令牌将在3天内过期，则刷新
      const THREE_DAYS = 3 * 24 * 60 * 60 * 1000; // 3天（毫秒）
      if (accessToken && tokenExpiration && (tokenExpiration - now < THREE_DAYS)) {
        console.log('令牌将在3天内过期，执行预防性刷新');
        await getApiStatus(); // 这将刷新令牌
      } else if (accessToken && tokenExpiration) {
        // 计算剩余时间
        const remainingTime = tokenExpiration - now;
        const remainingDays = Math.floor(remainingTime / (24 * 60 * 60 * 1000));
        const remainingHours = Math.floor((remainingTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        console.log(`令牌检查: 有效期还剩 ${remainingDays}天${remainingHours}小时`);
      } else {
        console.log('未找到有效令牌，将在下次API调用时获取');
      }
    } catch (error) {
      console.error('定期令牌检查失败:', error);
      // 错误不抛出，让定时器继续运行
    }
  };
  
  // 立即执行一次检查
  checkAndRefreshToken();
  
  // 设置定期检查
  setInterval(checkAndRefreshToken, CHECK_INTERVAL);
};

// 启动令牌刷新机制
setupTokenRefresh();

module.exports = {
  setCredentials,
  testConnection,
  searchGame,
  loadConfig,
  saveConfig,
  saveGameToDatabase,
  setProgressCallback,
  clearProgressCallback
};
