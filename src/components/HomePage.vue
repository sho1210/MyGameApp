<template>
  <div class="home-page">
    <div class="header">
      <h1>游戏库</h1>
      <div class="sort-controls">
        <span>排序方式：</span>
        <select v-model="sortMethod" @change="sortGames">
          <option value="id">ID</option>
          <option value="name">名称</option>
          <option value="created_at">安装时间</option>
          <option value="last_played">最后启动时间</option>
        </select>
        <button @click="toggleSortDirection" class="sort-direction-btn">
          {{ sortDirection === 'asc' ? '升序' : '降序' }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading">加载中...</div>
    <div v-else-if="!games.length" class="empty-tip">暂无游戏数据</div>

    <!-- 游戏卡片网格 -->
    <div class="game-grid">
      <VueDraggable
        v-model="games"
        :animation="200"
        @end="onDragEnd"
        class="draggable-container"
      >
        <div 
          v-for="element in games" 
          :key="element.id"
          class="card" 
          @click="navigateToGameDetail(element)"
        >
          <div 
            class="card-cover" 
            :style="element.cover ? { backgroundImage: `url(${formatPath(element.cover)})` } : {}"
          >
            <div v-if="!element.cover" class="no-cover">无封面</div>
          </div>
        </div>
      </VueDraggable>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { VueDraggable } from 'vue-draggable-plus';

export default {
  name: 'HomePage',
  components: {
    VueDraggable
  },
  setup() {
    const router = useRouter();
    const games = ref([]);
    const isLoading = ref(true);
    const sortMethod = ref('id'); // 默认按ID排序
    const sortDirection = ref('asc'); // 默认升序

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

    // 获取所有游戏数据
    const fetchGames = () => {
      isLoading.value = true;
      // 使用安全的electronAPI获取所有游戏
      window.electronAPI.getAllGames();
    };

    // 处理游戏数据响应
    const handleGamesResponse = (event, data) => {
      console.log('收到游戏数据', data);
      games.value = data;
      
      // 从localStorage获取保存的游戏顺序
      const savedOrder = localStorage.getItem('gameOrder');
      if (savedOrder) {
        try {
          const orderIds = JSON.parse(savedOrder);
          // 根据保存的顺序重新排列游戏数组
          games.value.sort((a, b) => {
            const indexA = orderIds.indexOf(a.id);
            const indexB = orderIds.indexOf(b.id);
            // 如果ID不在保存的顺序中，将其排在后面
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        } catch (error) {
          console.error('解析保存的游戏顺序出错:', error);
        }
      } else {
        // 如果没有保存的顺序，应用默认排序
        sortGames();
      }
      
      isLoading.value = false;
      console.log('处理后的游戏数据:', games.value);
    };

    // 切换排序方向
    const toggleSortDirection = () => {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
      sortGames();
    };

    // 排序游戏
    const sortGames = () => {
      const method = sortMethod.value;
      const direction = sortDirection.value;

      games.value.sort((a, b) => {
        let valueA, valueB;

        // 根据排序方法获取比较值
        if (method === 'id') {
          valueA = a.id;
          valueB = b.id;
        } else if (method === 'name') {
          valueA = a.name || '';
          valueB = b.name || '';
        } else if (method === 'created_at') {
          valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
          valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
        } else if (method === 'last_played') {
          valueA = a.last_played ? new Date(a.last_played).getTime() : 0;
          valueB = b.last_played ? new Date(b.last_played).getTime() : 0;
        }

        // 根据排序方向进行比较
        if (direction === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
    };

    // 拖拽结束后的处理
    const onDragEnd = () => {
      // 保存新顺序到localStorage
      console.log('拖拽结束，新顺序:', games.value);
      // 提取游戏ID数组用于保存顺序
      const gameOrder = games.value.map(game => game.id);
      localStorage.setItem('gameOrder', JSON.stringify(gameOrder));
      // 同时保存当前的排序方法和方向
      localStorage.setItem('sortMethod', sortMethod.value);
      localStorage.setItem('sortDirection', sortDirection.value);
    };

    // 导航到游戏详情页
    const navigateToGameDetail = (game) => {
      if (!game || !game.cover) return;
      
      // 编码封面路径，确保URL安全
      const encodedCover = encodeURIComponent(game.cover);
      router.push(`/game-detail/${encodedCover}`);
    };

    // 生命周期钩子
    onMounted(() => {
        console.log('HomePage 组件已挂载');
        
        // 从localStorage获取保存的排序方法和方向
        const savedSortMethod = localStorage.getItem('sortMethod');
        const savedSortDirection = localStorage.getItem('sortDirection');
        
        if (savedSortMethod) {
          sortMethod.value = savedSortMethod;
        }
        
        if (savedSortDirection) {
          sortDirection.value = savedSortDirection;
        }
        
        fetchGames();
      
        // 添加事件监听器
        window.electronAPI.onGamesData(handleGamesResponse);
      
        // 确保事件监听器正确注册
        console.log('已注册事件监听器: onGamesData');
        console.log('这是渲染进程日志');
    });
    
    onBeforeUnmount(() => {
      // 移除事件监听器
      window.electronAPI.removeGamesDataListener();
    });

    return {
      games,
      isLoading,
      sortMethod,
      sortDirection,
      formatPath,
      toggleSortDirection,
      sortGames,
      onDragEnd,
      navigateToGameDetail
    };
  }
};
</script>

<style scoped>
.home-page {
  padding: 0px;
  margin: 0 0;
  background-color: var(--bg-primary);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 5px;
  margin-bottom: -5px;
  padding-left: 20px;
  padding-right: 20px;
}

.header h1 {
  font-size: 0px;
  font-weight: 500;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-controls select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

.sort-direction-btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sort-direction-btn:hover {
  background-color: var(--bg-hover);
}

.game-grid {
  display: flex;
  flex-wrap: wrap;
  /*gap: 20px;*/
  margin-top: 0px;
  width: 100%;
}

.draggable-container {
  display: flex;
  flex-wrap: wrap;
  /*gap: 20px;*/
  width: 100%;
}

.card {
  width: 136px;
  height: 204px;
  margin-top: 11px;
  margin-bottom: 11px;
  margin-left: 21px;
  margin-right: 19px;
  /* 设置视距 */
  perspective: 1000px;
  border: 2px solid transparent;
  position: relative;
  cursor: pointer;
}

/* 投影效果 */
.card::before {
  content: "";
  width: 90%;
  height: 90%;
  background-color: var(--bg-transparent);
  /* 绝对定位 */
  position: absolute;
  left: 5%;
  top: 5%;
  /* 投影 */
  box-shadow: 0 5px 12px 12px rgba(0, 0, 0, 0.18), 
              0 8px 24px 24px rgba(0, 0, 0, 0.01);
  opacity: 1;
  /* 设置旋转元素的基点位置 */
  transform-origin: top center;
  /* 设置过渡:时长 加速后减速 */
  transition: 0.3s ease-in-out;
}

/* 鼠标移上,投影的变化 */
.card:hover::before {
  opacity: 0.5;
  transform: rotateX(7deg) translateY(-6px) scale(1.05);
}

/* 封面 */
.card-cover {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  /* 溢出隐藏 */
  overflow: hidden;
  /* 开启3D */
  transform-style: preserve-3d;
  /* 设置旋转元素的基点位置 */
  transform-origin: top center;
  /* 设置过渡 */
  transition: transform 0.35s ease-in-out;
}

.card-cover::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 120%;
  /* 背景渐变(高光效果) */
  background: linear-gradient(rgba(255, 255, 255, 0.03) 70%, rgba(255, 255, 255, 0.36) 72%, rgba(255, 255, 255, 0.26) 100%);
  transform: rotate(-145deg) scale(1.8);
  /* 设置过渡 */
  transition: transform 0.65s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.card:hover .card-cover {
  transform: rotateX(7deg) translateY(-6px);
  /*border-color: var(--theme-color);*/
}

.card:hover .card-cover::after {
  transform: rotate(-145deg) scale(2.3) translateY(-16.5%);
}

.no-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 14px;
}

.loading, .empty-tip {
  text-align: center;
  padding: 40px;
  font-size: 16px;
  color: var(--text-secondary);
}
</style>