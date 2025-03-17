<template>
  <div class="game-detail" v-if="game" :style="backgroundStyle">
    <div class="game-info">
      <div class="game-cover">
        <img :src="coverPath" alt="游戏封面" />
      </div>
      <div class="game-content">
        <h1 class="game-title">{{ game.name }}</h1>
        <p class="game-description">{{ game.description || '暂无描述' }}</p>
        <div class="game-actions">
          <button v-if="!isGameRunning" class="start-button" @click="startGame">启动游戏</button>
          <button v-else class="stop-button" @click="terminateGame">停止游戏</button>
        </div>
      </div>
    </div>
    <div class="cd-container" :class="{ 'rotating': isGameRunning }">
      <div class="cd-disk" :style="cdBackgroundStyle">
        <div class="cd-inner"></div>
      </div>
    </div>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';

export default {
  name: 'GameDetail',
  setup() {
    const route = useRoute();
    const game = ref(null);
    const isGameRunning = ref(false);
    const coverPath = decodeURIComponent(route.params.cover);

    // 格式化路径，处理Windows路径中的反斜杠问题
    const formatPath = (path) => {
      if (!path) return '';
      // 将反斜杠替换为正斜杠
      let formattedPath = path.replace(/\\/g, '/');
      // 确保路径以file://开头
      if (!formattedPath.startsWith('file://')) {
        formattedPath = `file://${formattedPath}`;
      }
      return formattedPath;
    };

    // 背景样式计算
    const backgroundStyle = computed(() => {
      if (game.value && game.value.background) {
        return {
          backgroundImage: `url(${formatPath(game.value.background)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      }
      return {};
    });

    // CD背景样式计算
    const cdBackgroundStyle = computed(() => {
      if (game.value && game.value.background) {
        return {
          backgroundImage: `url(${formatPath(game.value.background)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      }
      return {};
    });

    // 获取游戏信息
    const fetchGameInfo = () => {
      console.log('获取游戏信息，封面路径:', coverPath);
      // 使用安全的electronAPI获取游戏信息
      window.electronAPI.getGameByCover(coverPath);
      
      window.electronAPI.onGetGameByCoverReply((event, response) => {
        console.log('收到游戏信息:', response);
        // 处理两种可能的响应格式：
        // 1. 标准格式：{success: true, data: {...}}
        // 2. 直接返回游戏对象：{name: '游戏名', ...}
        if (response && typeof response === 'object') {
          if (response.success && response.data) {
            // 标准响应格式
            game.value = response.data;
          } else if (response.name) {
            // 直接返回游戏对象
            game.value = response;
          } else {
            // 响应格式不正确
            let errorMsg = '未知错误';
            if (response.message) {
              errorMsg = response.message;
            } else if (typeof response === 'string') {
              errorMsg = response;
            }
            console.error('获取游戏信息失败:', errorMsg);
            alert(`获取游戏信息失败: ${errorMsg}`);
          }
        } else {
          console.error('获取游戏信息失败: 响应格式不正确');
          alert('获取游戏信息失败: 响应格式不正确');
        }
      });
    };

    // 启动游戏
    const startGame = () => {
      if (!game.value) return;
      if (isGameRunning.value) {
        alert('游戏已经在运行中');
        return;
      }

      console.log('启动游戏:', game.value.name);
      // 使用安全的electronAPI启动游戏
      window.electronAPI.launchGame({
        id: game.value.id,
        name: game.value.name,
        fileName: game.value.fileName,
        workingDirectory: game.value.workingDirectory,
        args: game.value.args
      });
      
      window.electronAPI.onGameLaunched((event, response) => {
        console.log('游戏启动结果:', response);
        if (response.success) {
          isGameRunning.value = true;
          console.log('游戏已启动，进程ID:', response.pid);
        } else {
          alert(`启动游戏失败: ${response.message}`);
        }
      });
    };

    // 终止游戏
    const terminateGame = () => {
      if (!game.value) return;
      if (!isGameRunning.value) {
        alert('游戏未在运行中');
        return;
      }

      console.log('终止游戏:', game.value.name);
      // 使用安全的electronAPI终止游戏
      window.electronAPI.terminateGame(game.value.name);
      
      window.electronAPI.onTerminateGameReply((event, response) => {
        console.log('终止游戏结果:', response);
        if (!response.success) {
          alert(`终止游戏失败: ${response.message}`);
        }
        // 不在这里设置isGameRunning为false，因为会通过onGameExited事件处理
      });
    };

    // 添加游戏退出事件监听器函数
    const addGameExitedListener = () => {
      // 先移除可能存在的旧监听器，确保不会重复添加
      window.electronAPI.removeGameExitedListener();
      
      // 添加新的监听器
      window.electronAPI.onGameExited((event, exitInfo) => {
        console.log('游戏已退出:', exitInfo);
        // 强制更新状态，确保DVD控件停止旋转
        isGameRunning.value = false;
        
        // 如果是异常退出，显示错误信息
        if (exitInfo.code !== undefined && exitInfo.code !== 0) {
          alert(`游戏异常退出，退出码: ${exitInfo.code}`);
        }
      });
    };
    
    // 生命周期钩子
    onMounted(() => {
      fetchGameInfo();
      
      // 监听游戏退出事件
      addGameExitedListener();
      
      // 确保初始状态正确
      isGameRunning.value = false;
    });


    onBeforeUnmount(() => {
      if (isGameRunning.value && game.value) {
        console.log('组件卸载前终止游戏:', game.value.name);
        window.electronAPI.terminateGame(game.value.name);
        
        // 确保游戏状态被重置
        isGameRunning.value = false;
      }
      
      // 移除所有事件监听器
      window.electronAPI.removeGetGameByCoverReplyListener();
      window.electronAPI.removeGameLaunchedListener();
      window.electronAPI.removeGameExitedListener();
      window.electronAPI.removeTerminateGameReplyListener();
      
      console.log('GameDetail组件已卸载，所有事件监听器已移除');
    });

    return {
      game,
      isGameRunning,
      backgroundStyle,
      coverPath,
      cdBackgroundStyle,
      startGame,
      terminateGame
    };
  }
};
</script>

<style scoped>
.game-detail {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--text-primary);
  padding: 30px;
  box-sizing: border-box;
  background-color: var(--bg-transparent);
  overflow: hidden;
}

.game-detail::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--bg-gd-transparent);
  backdrop-filter: blur(10px);
  z-index: 1;
  overflow-y: hidden;
}

.game-info {
  display: flex;
  z-index: 2;
  margin-top: 50px;
}

.game-cover {
  flex: 0 0 300px;
  margin-right: 40px;
}

.game-cover img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.game-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.game-title {
  font-size: 36px;
  margin-bottom: 20px;
  color: var(--text-primary);
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.game-description {
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 30px;
  color: var(--text-secondary);
}

.game-actions {
  margin-top: auto;
}

.start-button, .stop-button {
  border-radius: 20px;
  padding: 10px 25px;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.start-button {
  background: var(--theme-color);
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.start-button:hover {
  background: #0063CC;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.stop-button {
  background: #ff3b30;
  color: white;
}

.stop-button:hover {
  background: #e63329;
}

.cd-container {
  position: absolute;
  right: -60px;
  bottom: -60px;
  transform: scale(1.2);
  z-index: 2;
}

.cd-disk {
  width: 300px;
  height: 300px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  z-index: 2;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.cd-inner {
  width: 70px;
  height: 70px;
  background: var(--bg-secondary);
  border-radius: 50%;
  /*box-shadow: 
    0 0 10px rgba(0, 0, 0, 0.05) inset,
    0 2px 8px rgba(0, 0, 0, 0.1);*/
  position: relative;
  z-index: 3;
}

.cd-inner::after {
  content: '';
  position: absolute;
  width: 58px;
  height: 58px;
  background: var(--bg-primary);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05) inset;
}

.rotating {
  animation: rotate 8s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg) scale(1.2); }
  to { transform: rotate(360deg) scale(1.2); }
}

.loading {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0px;
  color: var(--text-secondary);
  background-color: var(--bg-secondary);
}
</style>