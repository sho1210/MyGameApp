<template>
  <div class="game-detail" v-if="game" :style="backgroundStyle">
    <div class="game-info">
      <div class="book">
        <div class="inner">
          <div class="dvd-disc">
            <div class="dvd-ring outer" :style="cdBackgroundStyle"></div>
            <div class="dvd-ring middle"></div>
            <div class="dvd-ring-inner"></div>
            <div class="dvd-center"></div>
          </div>
        </div>
        <div class="cover">
          <img :src="coverPath" alt="游戏封面" />
        </div>
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

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.loading {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0px;
  color: var(--text-secondary);
  background-color: var(--bg-transparent);
}


/* 保留原有的.book样式不变 */
.book {
  position: relative;
  border-radius: 10px;
  width: 260px;
  height: 390px;
  background-color: whitesmoke;
  -webkit-box-shadow: 1px 1px 12px #00000036;
  box-shadow: 1px 1px 12px #0000004a;
  -webkit-transform: preserve-3d;
  -ms-transform: preserve-3d;
  transform: preserve-3d;
  -webkit-perspective: 2000px;
  perspective: 600px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  color: #000;
  transition-duration: 0.5s;
  margin-right: 20px;
}

/* 保留原有的.cover样式不变 */
.cover,
.inner {
  top: 0;
  position: absolute;
  background-color: lightgray;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  cursor: pointer;
  -webkit-transition: all 0.5s;
  transition: all 0.5s;
  -webkit-transform-origin: 0;
  -ms-transform-origin: 0;
  transform-origin: 0;
  -webkit-box-shadow: 1px 1px 12px #00000057;
  box-shadow: 1px 1px 12px #00000054;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
}

/* DVD光盘样式 */
.dvd-disc {
  position: relative;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  background: linear-gradient(45deg, #1e90ff, #00bfff, #87cefa);
  display: flex;
  justify-content: center;
  align-items: center;
}

.dvd-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.dvd-ring.outer {
  width: 230px;
  height: 230px;
  border-color: rgba(255, 255, 255, 0.8);
}

.dvd-ring.middle {
  width: 36px;
  height: 36px;
  background-color: var(--dvd-middle-color);
  border-color: #ccc;
}

.dvd-ring-inner {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.5);
  width: 30px;
  height: 30px;
  background-color: var(--dvd-inner-color);
  border: none;
}

.dvd-center {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #000;
}

/* 保留原有的动画效果不变 */
.book:hover .cover {
  -webkit-transition: all 0.5s;
  transition: all 0.5s;
  -webkit-transform: rotatey(70deg);
  -ms-transform: rotatey(70deg);
  transform: rotatey(-70deg);
}

.inner {
  transform-origin: 100%;
}
.book:hover .inner {
  -webkit-transition: all 0.5s;
  transition: all 0.5s;
  -webkit-transform: rotateZ(25deg) rotateX(-30deg) rotateY(-10deg)
    translateX(140px);
  -ms-transform: rotateZ(25deg) rotateX(-30deg) rotateY(-10deg)
    translateX(140px);
  transform: rotateZ(25deg) rotateX(-30deg) rotateY(-10deg) translateX(140px);
  -webkit-box-shadow: 1px 1px 20px #000a;
  box-shadow: 1px 1px 20px #000a;
}

.book:hover {
  transform: rotateZ(-10deg);
}
.text {
  font-size: 20px;
  font-weight: 100;
}

</style>