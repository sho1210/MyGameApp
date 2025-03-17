<template>
  <div class="game-info-container">
    <div class="info-section">
      <h2>游戏信息获取</h2>
      <div class="input-group">
        <input 
          type="text" 
          v-model="inputText" 
          placeholder="请输入要获取信息的游戏英文名" 
          class="getInfo-input"
        />
        <button @click="getInfo" class="getInfo-btn" :disabled="isGettingInfo">
          {{ isGettingInfo ? '获取中...' : '获取' }}
        </button>
      </div>
      
      <!-- 游戏信息获取进度显示 -->
      <div v-if="showGameInfoProgress" class="game-info-progress">
        <h3>游戏信息获取进度</h3>
        <div class="download-status">
          <span>状态: {{ gameInfoProgress.status }}</span>
        </div>
        <div class="download-details">
          <span>当前操作: {{ gameInfoProgress.currentOperation }}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${gameInfoProgress.percentage}%` }"></div>
          <span class="progress-text">{{ gameInfoProgress.percentage }}%</span>
        </div>
      </div>
      
      <!-- 翻译模型下载进度显示 -->
      <div v-if="showModelDownloadProgress" class="model-download-progress">
        <h3>翻译模型下载</h3>
        <div class="download-status">
          <span>状态: {{ getModelStatusText() }}</span>
        </div>
        <div class="download-details">
          <span>当前任务: {{ modelDownloadInfo.currentModelName }}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${modelDownloadInfo.percentage}%` }"></div>
          <span class="progress-text">{{ modelDownloadInfo.percentage }}%</span>
        </div>
        <div class="download-stage">
          <span>阶段: {{ getStageText(modelDownloadInfo.stage) }}</span>
        </div>
      </div>
      
      <!-- 游戏信息显示 -->
      <div v-if="gameInfoError" class="info-error">
        <p>{{ gameInfoError }}</p>
      </div>
      
      <!-- 游戏信息结果弹窗 -->
      <div v-if="showGameInfoModal" class="game-info-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>游戏信息</h3>
            <button class="close-btn" @click="closeModal">×</button>
          </div>
          <div class="modal-body">
            <div class="game-info-details">
              <div class="game-images">
                <div class="game-cover" v-if="currentGameInfo.cover">
                  <img :src="'file://' + currentGameInfo.cover" alt="游戏封面" />
                </div>
                <div class="game-background" v-if="currentGameInfo.background">
                  <img :src="'file://' + currentGameInfo.background" alt="游戏背景" />
                </div>
              </div>
              <div class="game-data">
                <h4>{{ currentGameInfo.name }}</h4>
                <p class="release-date" v-if="currentGameInfo.releaseDate">发行日期: {{ currentGameInfo.releaseDate }}</p>
                <div class="description">
                  <p>{{ currentGameInfo.description }}</p>
                </div>
                <div class="game-navigation" v-if="gameResults.length > 1">
                  <p class="result-counter">当前结果: {{ currentGameIndex + 1 }} / {{ gameResults.length }}</p>
                </div>
              </div>
            </div>
            
            <!-- 保存结果消息 -->
            <div v-if="saveGameResult" class="save-result" :class="{ 'save-success': saveGameResult.success, 'save-error': !saveGameResult.success }">
              <p>{{ saveGameResult.message }}</p>
            </div>
            
            <div class="action-buttons">
              <button class="next-game-btn" @click="showNextGame" v-if="hasMoreResults">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="M12 5l7 7-7 7"></path>
                </svg>
                查看下一条信息
              </button>
              <button class="add-game-btn" @click="useGameInfo" :disabled="isSavingGame">
                {{ isSavingGame ? '保存中...' : '使用此信息' }}
              </button>
              <button class="cancel-btn" @click="closeModal">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';

export default {
  name: 'GameInfo',
  setup() {
    const inputText = ref('');
    const isGettingInfo = ref(false);
    const gameInfoError = ref('');
    const showModelDownloadProgress = ref(false);
    const modelDownloadInfo = ref({
      stage: '',
      currentModelName: '',
      percentage: 0
    });
    
    // 游戏信息获取进度
    const showGameInfoProgress = ref(false);
    const gameInfoProgress = ref({
      status: '准备中',
      currentOperation: '初始化',
      percentage: 0
    });
    
    const isSavingGame = ref(false);
    const saveGameResult = ref(null);
    
    // 存储所有搜索结果
    const gameResults = ref([]);
    const currentGameIndex = ref(0);
    const showGameInfoModal = ref(false);
    
    // 当前显示的游戏信息
    const currentGameInfo = computed(() => {
      if (gameResults.value.length === 0) {
        return {
          name: '',
          description: '',
          releaseDate: '',
          cover: null,
          background: null
        };
      }
      return gameResults.value[currentGameIndex.value];
    });
    
    // 是否有更多结果可以显示
    const hasMoreResults = computed(() => {
      return gameResults.value.length > 1 && currentGameIndex.value < gameResults.value.length - 1;
    });
    
    // 显示下一个游戏信息
    const showNextGame = () => {
      if (currentGameIndex.value < gameResults.value.length - 1) {
        currentGameIndex.value++;
      }
    };

    // 检查模型状态
    const checkModelStatus = async () => {
      try {
        const status = await window.electronAPI.checkTranslationModel();
        
        // 如果模型正在下载或未准备好，显示进度条
        if (status.isDownloading || !status.isReady) {
          showModelDownloadProgress.value = true;
          modelDownloadInfo.value = status.progress || {
            stage: 'checking',
            currentModelName: '检查模型状态中',
            percentage: 0
          };
        }
      } catch (error) {
        console.error('检查模型状态失败:', error);
      }
    };

    // 获取模型状态文本
    const getModelStatusText = () => {
      const stage = modelDownloadInfo.value.stage;
      
      if (stage === 'error') {
        return '错误';
      } else if (stage === 'completed') {
        return '完成';
      } else if (stage === 'dependencies') {
        return '安装依赖中';
      } else if (stage === 'preparing') {
        return '准备中';
      } else if (stage === 'downloading' || stage === 'tokenizer' || stage === 'model') {
        return '下载中';
      } else {
        return '检查中';
      }
    };
    
    // 获取阶段文本
    const getStageText = (stage) => {
      switch (stage) {
        case 'dependencies':
          return '安装依赖';
        case 'preparing':
          return '准备下载';
        case 'downloading':
          return '下载模型';
        case 'tokenizer':
          return '下载分词器';
        case 'model':
          return '下载模型';
        case 'completed':
          return '模型下载已完成，校验中...';
        case 'error':
          return '错误';
        default:
          return '检查中';
      }
    };

    // 获取游戏信息
    const getInfo = async () => {
      if (!inputText.value.trim()) {
        gameInfoError.value = '请输入游戏英文名';
        return;
      }

      gameInfoError.value = '';
      isGettingInfo.value = true;
      
      // 显示游戏信息获取进度
      showGameInfoProgress.value = true;
      gameInfoProgress.value = {
        status: '正在获取',
        currentOperation: '连接IGDB API',
        percentage: 10
      };

      try {
        console.log('正在获取游戏信息:', inputText.value);
        
        // 模拟进度更新 - 实际应用中会通过IPC获取真实进度
        updateGameInfoProgress(30, '搜索游戏信息');
        
        // 调用主进程的获取游戏信息方法
        const result = await window.electronAPI.getGameInfo(inputText.value);
        
        updateGameInfoProgress(70, '处理搜索结果');
        
        if (!result.success) {
          gameInfoError.value = result.message || '获取游戏信息失败';
          updateGameInfoProgress(100, '获取失败', '失败');
          setTimeout(() => {
            showGameInfoProgress.value = false;
          }, 3000);
          isGettingInfo.value = false;
          return;
        }
        
        updateGameInfoProgress(90, '准备显示结果');
        
        // 重置当前游戏索引
        currentGameIndex.value = 0;
        
        // 根据返回数据类型处理结果
        if (Array.isArray(result.data)) {
          // 如果返回的是数组，直接使用
          gameResults.value = result.data;
        } else {
          // 如果返回的是单个对象，转换为数组
          gameResults.value = [result.data];
        }
        
        updateGameInfoProgress(100, '完成', '完成');
        
        // 显示结果弹窗
        showGameInfoModal.value = true;
        
        // 完成后3秒隐藏进度条
        setTimeout(() => {
          showGameInfoProgress.value = false;
        }, 3000);
        
      } catch (error) {
        console.error('获取游戏信息失败:', error);
        gameInfoError.value = `获取游戏信息失败: ${error.message}`;
        updateGameInfoProgress(100, '发生错误', '错误');
        setTimeout(() => {
          showGameInfoProgress.value = false;
        }, 3000);
      } finally {
        isGettingInfo.value = false;
      }
    };
    
    // 更新游戏信息获取进度
    const updateGameInfoProgress = (percentage, operation, status = '正在获取') => {
      gameInfoProgress.value = {
        status: status,
        currentOperation: operation,
        percentage: percentage
      };
    };

    // 关闭游戏信息弹窗
    const closeModal = () => {
      showGameInfoModal.value = false;
      saveGameResult.value = null;
    };
    
    // 使用获取到的游戏信息，保存到数据库
    const useGameInfo = async () => {
      if (!currentGameInfo.value) {
        return;
      }
      
      isSavingGame.value = true;
      
      try {
        console.log('正在保存游戏信息到数据库:', currentGameInfo.value.name);
        
        // 创建一个可序列化的游戏信息对象，确保没有循环引用和不可克隆的属性
        const serializableGameInfo = {
          name: currentGameInfo.value.name || '',
          description: currentGameInfo.value.description || '',
          cover: currentGameInfo.value.cover || null,
          background: currentGameInfo.value.background || null,
          // 不包含可能不可序列化的属性
          releaseDate: currentGameInfo.value.releaseDate || ''
        };
        
        // 调用主进程保存游戏信息
        const result = await window.electronAPI.saveGameInfo(serializableGameInfo);
        
        console.log('保存结果:', result);
        saveGameResult.value = result;
        
        if (result.success) {
          // 延迟关闭弹窗，让用户能看到保存成功的消息
          setTimeout(() => {
            closeModal();
            
            // 通知主页面刷新游戏列表
            window.electronAPI.getAllGames();
          }, 2000);
        }
      } catch (error) {
        console.error('保存游戏信息失败:', error);
        saveGameResult.value = {
          success: false,
          message: `保存失败: ${error.message}`
        };
      } finally {
        isSavingGame.value = false;
      }
    };

    onMounted(() => {
      // 检查模型状态
      checkModelStatus();
      
      // 监听下载进度
      window.electronAPI.onTranslationModelProgress((event, progress) => {
        console.log('收到模型下载进度:', progress);
        showModelDownloadProgress.value = true;
        modelDownloadInfo.value = progress;
        
        // 如果下载完成，先检查模型是否真正准备好，再隐藏进度条
        if (progress.stage === 'completed' && progress.percentage === 100) {
          // 延迟检查模型状态，确保模型真正安装完成
          setTimeout(async () => {
            try {
              // 再次检查模型状态，确认模型已完全准备好
              const status = await window.electronAPI.checkTranslationModel();
              if (status.isReady) {
                console.log('模型已完全准备好，隐藏进度条');
                showModelDownloadProgress.value = false;
              } else {
                console.log('模型尚未完全准备好，保持进度条显示');
              }
            } catch (error) {
              console.error('检查模型状态失败:', error);
            }
          }, 3000);
        }
      });
      
      // 监听游戏信息获取进度
      // 注：此处为示例，如果你的electronAPI中没有此方法，需要先在preload.js中添加
      if (window.electronAPI.onGameInfoProgress) {
        window.electronAPI.onGameInfoProgress((event, progress) => {
          console.log('收到游戏信息获取进度:', progress);
          showGameInfoProgress.value = true;
          
          // 更新进度信息
          gameInfoProgress.value = {
            status: progress.status || '正在获取',
            currentOperation: progress.operation || '处理中',
            percentage: progress.percentage || 0
          };
          
          // 如果获取完成，延迟3秒后隐藏进度条
          if (progress.status === '完成' && progress.percentage === 100) {
            setTimeout(() => {
              showGameInfoProgress.value = false;
            }, 3000);
          }
        });
      }
    });

    // 组件卸载时移除监听器
    onUnmounted(() => {
      window.electronAPI.removeTranslationModelProgressListener();
      
      // 移除游戏信息获取进度监听器
      if (window.electronAPI.removeGameInfoProgressListener) {
        window.electronAPI.removeGameInfoProgressListener();
      }
    });
    
    return {
      inputText,
      isGettingInfo,
      gameInfoError,
      showModelDownloadProgress,
      modelDownloadInfo,
      gameResults,
      currentGameIndex,
      currentGameInfo,
      hasMoreResults,
      showGameInfoModal,
      isSavingGame,
      saveGameResult,
      showGameInfoProgress,
      gameInfoProgress,
      updateGameInfoProgress,
      getModelStatusText,
      getStageText,
      getInfo,
      closeModal,
      useGameInfo,
      showNextGame
    };
  }
};
</script>

<style scoped>
.game-info-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.info-section {
  background-color: var(--bg-card);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.info-section h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.input-group {
  display: flex;
  margin-bottom: 20px;
}

.getInfo-input {
  flex: 1;
  padding: 10px 15px;
  border: 1px solid var(--theme-color);
  border-radius: 4px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 1rem;
}

.getInfo-btn {
  margin-left: 10px;
  padding: 10px 20px;
  background-color: var(--theme-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.getInfo-btn:hover {
  background-color: rgba(var(--theme-color-rgb), 0.8);
}

.getInfo-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.info-error {
  margin-top: 20px;
  padding: 15px;
  background-color: rgba(255, 0, 0, 0.1);
  border-radius: 4px;
  border-left: 4px solid #ff3333;
  color: #ff3333;
}

.info-error p {
  color: #ff4d4f;
  font-size: 0.9rem;
}

/* 游戏信息获取进度样式 */
.game-info-progress {
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: rgba(var(--theme-color-rgb), 0.05);
  border-radius: 8px;
  border-left: 4px solid var(--theme-color);
}

.game-info-progress h3 {
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 1.1rem;
}

/* 从根目录的 GameInfo.vue 合并的样式 */
.model-download-progress {
  margin-top: 1rem;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.model-download-progress h3 {
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 1.1rem;
}

.download-status {
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.download-details {
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.progress-bar-container {
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  flex-grow: 1;
}

.progress-bar {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8rem;
  text-align: right;
}

.download-stage {
  margin-top: 10px;
  font-size: 0.9rem;
}

/* 游戏信息弹窗样式 */
.game-info-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--bg-modal);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-modal);
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.modal-body {
  padding: 20px;
}

.game-info-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.game-images {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.game-cover {
  flex: 0 0 150px;
}

.game-cover img {
  width: 150px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.game-background {
  flex: 1;
  max-width: 100%;
}

.game-background img {
  width: 100%;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.game-data {
  margin-top: 20px;
}

.game-data h4 {
  margin: 0 0 10px;
  font-size: 1.3rem;
  color: var(--text-primary);
}

.release-date {
  margin: 5px 0 15px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.description {
  margin-top: 15px;
  line-height: 1.6;
  color: var(--text-primary);
}

.game-navigation {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.result-counter {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}

.add-game-btn {
  padding: 10px 20px;
  background-color: var(--theme-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.next-game-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-right: auto;
}

.next-game-btn svg {
  width: 16px;
  height: 16px;
}

.cancel-btn {
  padding: 10px 20px;
  background-color: #e0e0e0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* 响应式调整 */
@media (min-width: 768px) {
  .game-info-details {
    flex-direction: row;
  }
  
  .game-images {
    flex: 0 0 300px;
    flex-direction: column;
  }
  
  .game-data {
    flex: 1;
    margin-top: 0;
  }
}

/* 添加保存结果消息样式 */
.save-result {
  margin-top: 15px;
  padding: 10px 15px;
  border-radius: 4px;
  text-align: center;
}

.save-success {
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 4px solid #4caf50;
  color: #4caf50;
}

.save-error {
  background-color: rgba(244, 67, 54, 0.1);
  border-left: 4px solid #f44336;
  color: #f44336;
}

.add-game-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>