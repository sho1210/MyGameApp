<template>
  <div class="settings-container">
    <div class="settings-card">
      <h2 class="settings-title">主题设置</h2>
      <div class="theme-options">
        <div 
          class="theme-option" 
          :class="{ 'active': currentTheme === 'light' }" 
          @click="setTheme('light')"
        >
          <div class="theme-preview light-theme"></div>
          <span>浅色主题</span>
        </div>
        <div 
          class="theme-option" 
          :class="{ 'active': currentTheme === 'dark' }" 
          @click="setTheme('dark')"
        >
          <div class="theme-preview dark-theme"></div>
          <span>深色主题</span>
        </div>
      </div>
      
      <h3 class="settings-subtitle">主题色</h3>
      <div class="color-picker-container">
        <div 
          v-for="color in themeColors" 
          :key="color" 
          class="color-option" 
          :class="{ 'active': currentThemeColor === color }" 
          :style="{ backgroundColor: color }" 
          @click="setThemeColor(color)"
        ></div>
        <div class="color-input-container">
          <input 
            type="color" 
            v-model="customColor" 
            @change="setThemeColor(customColor)" 
            class="color-input" 
          />
          <span>自定义</span>
        </div>
      </div>
    </div>

    <!-- 新增 IGDB API 设置 -->
    <div class="settings-card">
      <h2 class="settings-title">游戏信息API设置</h2>
      <div class="api-config-container">
        <p class="api-info">要使用IGDB获取游戏信息，您需要在<a href="https://dev.twitch.tv/console/apps" target="_blank">Twitch开发者控制台</a>创建应用并获取API凭据。</p>
        <div class="input-group">
          <label for="client-id">Client ID</label>
          <input type="text" id="client-id" v-model="igdbConfig.clientId" placeholder="输入您的IGDB Client ID" />
        </div>
        <div class="input-group">
          <label for="client-secret">Client Secret</label>
          <input type="password" id="client-secret" v-model="igdbConfig.clientSecret" placeholder="输入您的IGDB Client Secret" />
        </div>
        <div class="api-buttons">
          <button class="action-button save-button" @click="saveIGDBConfig">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>保存设置</span>
          </button>
          <button class="action-button test-button" @click="testIGDBConnection">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
            <span>测试连接</span>
          </button>
        </div>
        <div class="api-status" v-if="igdbTestResult">
          <div class="api-status-message" :class="{'api-success': igdbTestResult.success, 'api-error': !igdbTestResult.success}">
            {{ igdbTestResult.message }}
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <h2 class="settings-title">翻译模型管理</h2>
      <div class="model-status" v-if="modelStatus">
        <p>模型状态: <span :class="{'status-ready': modelStatus.isReady, 'status-downloading': modelStatus.isDownloading}">
          {{ modelStatus.isReady ? '已安装' : modelStatus.isDownloading ? '下载中' : '未安装' }}
        </span></p>
        <p v-if="modelStatus.modelDir">模型路径: {{ modelStatus.modelDir }}</p>
        <div v-if="modelStatus.isDownloading" class="download-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{width: `${modelStatus.progress.percentage}%`}"></div>
          </div>
          <p>{{ modelStatus.progress.currentModelName }} - {{ modelStatus.progress.percentage }}%</p>
        </div>
      </div>
      <div class="data-actions">
        <button class="action-button export-button" @click="exportModels" :disabled="!modelStatus || !modelStatus.isReady">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>导出翻译模型</span>
        </button>
        <button class="action-button import-button" @click="importModels">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>导入翻译模型</span>
        </button>
      </div>
    </div>

    <div class="settings-card">
      <h2 class="settings-title">数据管理</h2>
      <div class="data-actions">
        <button class="action-button backup-button" @click="backupData">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>备份数据</span>
        </button>
        <button class="action-button restore-button" @click="restoreData">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>恢复数据</span>
        </button>
      </div>
    </div>

    <div class="status-message" v-if="statusMessage">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'SettingsPage',
  setup() {
    const store = useStore();
    const statusMessage = ref('');
    const customColor = ref(store.getters.currentThemeColor);
    const modelStatus = ref(null);
    const igdbConfig = ref({
      clientId: '',
      clientSecret: ''
    });
    const igdbTestResult = ref(null);
    
    // 预定义的主题色选项
    const themeColors = [
      '#007AFF', // 默认蓝色
      '#FF2D55', // 粉红色
      '#5856D6', // 紫色
      '#FF9500', // 橙色
      '#4CD964', // 绿色
      '#FF3B30'  // 红色
    ];

    // 从Vuex获取当前主题
    const currentTheme = computed(() => store.getters.currentTheme);
    
    // 从Vuex获取当前主题色
    const currentThemeColor = computed(() => store.getters.currentThemeColor);
    
    // 设置主题
    const setTheme = (theme) => {
      store.dispatch('setTheme', theme);
    };
    
    // 设置主题色
    const setThemeColor = (color) => {
      store.dispatch('setThemeColor', color);
      customColor.value = color;
    };
    
    // 获取IGDB配置
    const getIGDBConfig = async () => {
      try {
        const config = await window.electronAPI.getIGDBConfig();
        if (config && !config.error) {
          igdbConfig.value.clientId = config.clientId || '';
          igdbConfig.value.clientSecret = config.clientSecret || '';
        }
      } catch (error) {
        console.error('获取IGDB配置失败:', error);
      }
    };
    
    // 保存IGDB配置
    const saveIGDBConfig = async () => {
      try {
        // 检查输入
        if (!igdbConfig.value.clientId || !igdbConfig.value.clientSecret) {
          statusMessage.value = '请输入Client ID和Client Secret';
          setTimeout(() => {
            statusMessage.value = '';
          }, 3000);
          return;
        }
        
        console.log('保存IGDB配置...');
        statusMessage.value = '正在保存IGDB配置...';
        
        // 使用trim()清除可能的空格
        const configToSave = {
          clientId: igdbConfig.value.clientId.trim(),
          clientSecret: igdbConfig.value.clientSecret.trim()
        };
        
        console.log('发送保存请求:', configToSave);
        const result = await window.electronAPI.saveIGDBConfig(configToSave);
        
        if (result.success) {
          statusMessage.value = 'IGDB配置已保存';
          console.log('IGDB配置保存成功');
          
          // 保存成功后自动测试连接
          await testIGDBConnection();
        } else {
          statusMessage.value = `保存失败: ${result.error || '未知错误'}`;
          console.error('保存失败:', result.error);
        }
        
        setTimeout(() => {
          statusMessage.value = '';
        }, 5000);
      } catch (error) {
        console.error('保存IGDB配置失败:', error);
        statusMessage.value = `保存失败: ${error.message || '未知错误'}`;
        
        setTimeout(() => {
          statusMessage.value = '';
        }, 5000);
      }
    };
    
    // 测试IGDB连接
    const testIGDBConnection = async () => {
      try {
        console.log('测试IGDB连接...');
        igdbTestResult.value = { success: false, message: '测试中...' };
        
        const result = await window.electronAPI.testIGDBConnection();
        console.log('测试结果:', result);
        
        igdbTestResult.value = result;
      } catch (error) {
        console.error('测试IGDB连接失败:', error);
        igdbTestResult.value = {
          success: false,
          message: `连接测试失败: ${error.message || '未知错误'}`
        };
      }
    };
    
    // 获取翻译模型状态
    const getModelStatus = async () => {
      try {
        const status = await window.electronAPI.getTranslationModelStatus();
        console.log('获取到模型状态:', status);
        modelStatus.value = status;
      } catch (error) {
        console.error('获取模型状态失败:', error);
        statusMessage.value = '获取模型状态失败';
        setTimeout(() => {
          statusMessage.value = '';
        }, 3000);
      }
    };
    
    // 导出翻译模型
    const exportModels = () => {
      statusMessage.value = '正在导出翻译模型...';
      window.electronAPI.exportTranslationModels();
    };
    
    // 导入翻译模型
    const importModels = () => {
      if (confirm('导入翻译模型将覆盖当前模型，确定要继续吗？')) {
        statusMessage.value = '正在导入翻译模型...';
        window.electronAPI.importTranslationModels();
      }
    };
    
    // 备份数据
    const backupData = () => {
      statusMessage.value = '正在备份数据...';
      // 使用安全的electronAPI备份数据
      window.electronAPI.backupData();
      
      window.electronAPI.onBackupDataReply((event, response) => {
        if (response.success) {
          statusMessage.value = '数据备份成功！';
        } else {
          statusMessage.value = `备份失败: ${response.message}`;
        }
        
        // 3秒后清除状态消息
        setTimeout(() => {
          statusMessage.value = '';
        }, 3000);
      });
    };
    
    // 恢复数据
    const restoreData = () => {
      if (confirm('恢复数据将覆盖当前所有游戏数据，确定要继续吗？')) {
        statusMessage.value = '正在恢复数据...';
        // 使用安全的electronAPI恢复数据
        window.electronAPI.restoreData();
        
        window.electronAPI.onRestoreDataReply((event, response) => {
          if (response.success) {
            statusMessage.value = '数据恢复成功！应用将在3秒后重启...';
            
            // 3秒后重启应用
            setTimeout(() => {
              window.electronAPI.restartApp();
            }, 3000);
          } else {
            statusMessage.value = `恢复失败: ${response.message}`;
            
            // 3秒后清除状态消息
            setTimeout(() => {
              statusMessage.value = '';
            }, 3000);
          }
        });
      }
    };
    
    // 监听模型状态更新
    const handleModelStatusUpdate = (event, status) => {
      modelStatus.value = status;
    };
    
    // 监听模型导入导出结果
    const handleModelExportResult = (event, result) => {
      if (result.success) {
        statusMessage.value = '翻译模型导出成功！';
      } else {
        statusMessage.value = `导出失败: ${result.message}`;
      }
      
      // 3秒后清除状态消息
      setTimeout(() => {
        statusMessage.value = '';
      }, 3000);
    };
    
    const handleModelImportResult = (event, result) => {
      if (result.success) {
        statusMessage.value = '翻译模型导入成功！应用将在3秒后重启...';
        
        // 3秒后重启应用
        setTimeout(() => {
          window.electronAPI.restartApp();
        }, 3000);
      } else {
        statusMessage.value = `导入失败: ${result.message}`;
        
        // 3秒后清除状态消息
        setTimeout(() => {
          statusMessage.value = '';
        }, 3000);
      }
    };
    
    // 组件挂载时注册事件监听
    onMounted(() => {
      window.electronAPI.onTranslationModelStatusUpdate(handleModelStatusUpdate);
      window.electronAPI.onExportTranslationModelsReply(handleModelExportResult);
      window.electronAPI.onImportTranslationModelsReply(handleModelImportResult);
      
      // 获取初始模型状态
      getModelStatus();
      
      // 获取IGDB配置
      getIGDBConfig();
    });
    
    // 组件卸载时移除事件监听
    onUnmounted(() => {
      window.electronAPI.removeListener('translation-model-status-update', handleModelStatusUpdate);
      window.electronAPI.removeListener('export-translation-models-reply', handleModelExportResult);
      window.electronAPI.removeListener('import-translation-models-reply', handleModelImportResult);
    });
    
    return {
      currentTheme,
      currentThemeColor,
      themeColors,
      customColor,
      statusMessage,
      modelStatus,
      igdbConfig,
      igdbTestResult,
      setTheme,
      setThemeColor,
      saveIGDBConfig,
      testIGDBConnection,
      exportModels,
      importModels,
      backupData,
      restoreData
    };
  }
};
</script>

<style scoped>
/* 全局样式 */
body {
  font-family: 'Arial', sans-serif;
  background-color: #f9f9f9;
  color: #333;
  margin: 0;
  padding: 0;
}

.settings-container {
  padding: 30px;
  /*max-width: 800px;*/
  margin: 0 0;
  background-color: var(--bg-primary);
  min-height: 100vh;
}

.settings-card {
  background-color: var(--card-bg);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 25px;
  margin-bottom: 25px;
}

.settings-title {
  font-size: 18px;
  margin-bottom: 20px;
  color: var(--text-primary);
  font-weight: 600;
}

/* 主题选项样式 */
.theme-options {
  display: flex;
  gap: 20px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.theme-option:hover {
  background-color: var(--bg-transparent);
}

.theme-option.active {
  background-color: rgba(var(--theme-color-rgb), 0.1);
  border: 2px solid var(--theme-color);
}

.theme-preview {
  width: 100px;
  height: 70px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.theme-preview::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 15px;
}

.light-theme {
  background-color: #f9fafb;
}

.light-theme::before {
  background-color: #f0f0f0;
}

.dark-theme {
  background-color: #1a1a1a;
}

.dark-theme::before {
  background-color: #333;
}

/* 数据操作按钮样式 */
.data-actions {
  display: flex;
  gap: 15px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 主题色选择器样式 */
.settings-subtitle {
  font-size: 16px;
  margin: 20px 0 10px;
  color: var(--text-primary);
  font-weight: 500;
}

.color-picker-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

.color-option {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  border: 2px solid var(--text-primary);
  box-shadow: 0 0 0 2px var(--bg-primary);
}

.color-input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.color-input {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
  padding: 0;
}

.color-input::-webkit-color-swatch-wrapper {
  border: none;
  border-radius: 50%;
  padding: 0;
}

.backup-button {
  background-color: var(--theme-color);
  color: white;
}

.backup-button:hover {
  background-color: var(--theme-color);
  opacity: 0.8;
}

.restore-button {
  background-color: #5AC8FA;
  color: white;
}

.restore-button:hover {
  background-color: #4BA8D5;
}

.export-button {
  background-color: var(--theme-color);
  color: white;
}

.export-button:hover {
  background-color: var(--theme-color);
  opacity: 0.8;
}

.import-button {
  background-color: #5AC8FA;
  color: white;
}

.import-button:hover {
  background-color: #4BA8D5;
}

/* 状态消息样式 */
.status-message {
  margin-top: 20px;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border-left: 4px solid var(--theme-color);
  border-radius: 4px;
  color: var(--text-primary);
}

/* 模型状态样式 */
.model-status {
  margin-bottom: 20px;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  color: var(--text-primary);
}

.status-ready {
  color: #4CD964;
  font-weight: bold;
}

.status-downloading {
  color: #FF9500;
  font-weight: bold;
}

.download-progress {
  margin-top: 10px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--bg-transparent);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 5px;
}

.progress-fill {
  height: 100%;
  background-color: var(--theme-color);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* IGDB API 设置相关样式 */
.api-config-container {
  margin-bottom: 15px;
}

.api-info {
  margin-bottom: 15px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.api-info a {
  color: var(--theme-color);
  text-decoration: none;
}

.api-info a:hover {
  text-decoration: underline;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.input-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
}

.api-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.save-button {
  background-color: var(--theme-color);
  color: white;
}

.save-button:hover {
  background-color: var(--theme-color);
  opacity: 0.9;
}

.test-button {
  background-color: #34C759;
  color: white;
}

.test-button:hover {
  background-color: #2DB74E;
}

.api-status {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.api-status-message {
  font-size: 14px;
  line-height: 1.5;
}

.api-success {
  color: #34C759;
}

.api-error {
  color: #FF3B30;
}
</style>