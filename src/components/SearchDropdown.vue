<template>
  <div class="search-dropdown-container">
    <input 
      type="text" 
      class="search-input" 
      placeholder="搜索..." 
      v-model="searchQuery"
      @input="onSearch"
      @focus="showDropdown = true"
      @blur="onBlur"
    />
    <div class="search-dropdown" v-if="showDropdown && filteredGames.length > 0">
      <div 
        v-for="(game, index) in filteredGames" 
        :key="index" 
        class="search-item"
        @mousedown="selectGame(game)"
      >
        <div class="search-item-icon" v-if="game.cover">
          <img :src="formatPath(game.cover)" alt="游戏封面" />
        </div>
        <div class="search-item-icon" v-else>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="7" y1="2" x2="7" y2="22"></line>
            <line x1="17" y1="2" x2="17" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="2" y1="7" x2="7" y2="7"></line>
            <line x1="2" y1="17" x2="7" y2="17"></line>
            <line x1="17" y1="17" x2="22" y2="17"></line>
            <line x1="17" y1="7" x2="22" y2="7"></line>
          </svg>
        </div>
        <div class="search-item-name">{{ game.name }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';

export default {
  name: 'SearchDropdown',
  setup() {
    const router = useRouter();
    const searchQuery = ref('');
    const showDropdown = ref(false);
    const games = ref([]);
    const filteredGames = ref([]);
    
    // 获取所有游戏数据
    const fetchGames = async () => {
      try {
        // 使用安全的electronAPI获取所有游戏数据
        window.electronAPI.getAllGames();
        
        window.electronAPI.onGamesData((event, response) => {
          if (response && Array.isArray(response)) {
            games.value = response;
          }
        });
      } catch (error) {
        console.error('获取游戏数据失败:', error);
      }
    };
    
    // 搜索处理
    const onSearch = () => {
      if (!searchQuery.value.trim()) {
        filteredGames.value = [];
        return;
      }
      
      const query = searchQuery.value.toLowerCase().trim();
      filteredGames.value = games.value
        .filter(game => game.name && game.name.toLowerCase().includes(query))
        .slice(0, 5); // 限制显示前5个结果
    };
    
    // 选择游戏
    const selectGame = (game) => {
      if (game && game.cover) {
        router.push({
          path: `/game-detail/${encodeURIComponent(game.cover)}`
        });
      }
      searchQuery.value = '';
      showDropdown.value = false;
    };
    
    // 处理失焦事件
    const onBlur = () => {
      // 延迟关闭下拉菜单，确保点击事件能够触发
      setTimeout(() => {
        showDropdown.value = false;
      }, 200);
    };
    
    // 格式化路径，处理Windows路径中的反斜杠问题
    const formatPath = (path) => {
      if (!path) return '';
      
      // 将所有反斜杠替换为正斜杠
      let formattedPath = path.replace(/\\/g, '/');
      
      // 如果是本地文件路径但没有file://前缀，则添加
      if (formattedPath.match(/^[A-Za-z]:\//)) {
        formattedPath = `file:///${formattedPath}`;
      }
      
      return formattedPath;
    };
    
    // 监听搜索查询变化
    watch(searchQuery, () => {
      onSearch();
    });
    
    // 组件挂载时获取游戏数据
    onMounted(() => {
        console.log('SearchDropdown组件已挂载');
        fetchGames();
    });
    
    return {
      searchQuery,
      showDropdown,
      filteredGames,
      onSearch,
      selectGame,
      onBlur,
      formatPath
    };
  }
};
</script>

<style scoped>
.search-dropdown-container {
  position: relative;
  width: 100%;
}

.search-input {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  width: 100%;
  font-size: 14px;
  background-color: var(--search-bg);
  color: var(--text-search);
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--theme-color);
  box-shadow: 0 0 0 2px rgba(var(--theme-color-rgb), 0.2);
}

.search-input::placeholder {
  color: var(--text-search);
  opacity: 0.7;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 1500;
  margin-top: 4px;
  display: block;
}

.search-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-item:hover {
  background-color: rgba(var(--theme-color-rgb), 0.1);
}

.search-item-icon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
}

.search-item-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-item-name {
  font-size: 14px;
  color: var(--text-primary);
}

/* 滚动条样式 */
.search-dropdown::-webkit-scrollbar {
  width: 4px;
}

.search-dropdown::-webkit-scrollbar-track {
  background: rgba(240, 240, 240, 0.5);
}

.search-dropdown::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
}

.search-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>