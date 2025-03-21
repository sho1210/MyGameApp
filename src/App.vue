<template>
  <div class="app-container">
    <div class="content-container">
      <!-- 侧边栏 -->
      <div class="sidebar" :class="{ 'expanded': sidebarExpanded }">
        <div class="sidebar-header">
          <button class="menu-button" @click="toggleSidebar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sidebar-content">
          <div class="main-menu">
            <router-link to="/" class="sidebar-item">
              <div class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <span class="sidebar-text">库</span>
            </router-link>
            <router-link to="/manage" class="sidebar-item">
              <div class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <span class="sidebar-text">库管理</span>
            </router-link>
            <router-link to="/info" class="sidebar-item">
              <div class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <span class="sidebar-text">游戏信息</span>
            </router-link>
            <router-link to="/game-detail/1" class="sidebar-item">
              <div class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </div>
              <span class="sidebar-text">启动页面</span>
            </router-link>
          </div>
          <div class="bottom-menu">
            <router-link to="/settings" class="sidebar-item">
              <div class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <span class="sidebar-text">设置</span>
            </router-link>
          </div>
        </div>
      </div>
      
      <!-- 页面标题栏 -->
      <div class="page-header">
        <div class="page-title">
          <span>{{ getActiveMenuName() }}</span>
        </div>
        <div class="search-container">
          <SearchDropdown />
        </div>
      </div>
      
      <!-- 主内容区域 -->
      <div class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive :include="['HomePage']">
            <component :is="Component" v-if="$route.meta.keepAlive" />
          </keep-alive>
          <component :is="Component" v-if="!$route.meta.keepAlive" />
        </router-view>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import SearchDropdown from './components/SearchDropdown.vue';

export default {
  name: 'App',
  components: { SearchDropdown },
  setup() {
    const sidebarExpanded = ref(false);
    const route = useRoute();
    
    const toggleSidebar = () => {
      sidebarExpanded.value = !sidebarExpanded.value;
    };
    
    // 获取当前活动菜单名称
    const getActiveMenuName = () => {
      const path = route.path;
      
      if (path === '/') return '库';
      if (path === '/manage') return '库管理';
      if (path === '/settings') return '设置';
      if (path === '/info') return '游戏信息';
      if (path.startsWith('/game-detail')) return '启动页面';
      
      return '首页';
    };
    
    return {
      sidebarExpanded,
      toggleSidebar,
      route,
      getActiveMenuName
    }
  }
};
</script>

<style>

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  overflow: hidden;
  background-color: var(--bg-transparent);
  color: var(--text-primary);
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-transparent);
}

/* 内容容器 */
.content-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-transparent);
}

/* 侧边栏样式 */
.sidebar {
  display: flex;
  flex-direction: column;
  width: 35px;
  height: 100%;
  background-color: var(--sidebar-bg);
  transition: width 0.3s ease;
  overflow: hidden;
  z-index: 10;
}

.sidebar.expanded {
  width: 200px;
}

.sidebar-header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  padding: 8px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: space-between;
}

.sidebar-item {
  display: flex;
  align-items: center;
  padding: 10px 8px;
  color: var(--text-primary);
  text-decoration: none;
  transition: background-color 0.2s;
}

.sidebar-item:hover {
  background-color: var(--bg-transparent);
}

.sidebar-item.router-link-active {
  background-color: rgba(var(--theme-color-rgb), 0.1);
  color: var(--theme-color);
}

.sidebar-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  margin-right: 12px;
}

.sidebar-text {
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-size: 14px;
}

.sidebar.expanded .sidebar-text {
  opacity: 1;
}

/* 页面标题栏 */
.page-header {
  position: absolute;
  top: 0;
  left: 35px; /* 默认侧边栏宽度 */
  right: 0;
  height: 40px;
  background-color: var(--header-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  border-bottom: 1px solid var(--border-color);
  z-index: 5;
  transition: left 0.3s ease; /* 添加过渡效果 */
}

/* 当侧边栏展开时，页面标题栏自动避让 */
.sidebar.expanded ~ .page-header {
  left: 200px; /* 与展开后的侧边栏宽度一致 */
}

.page-title {
  font-weight: bold;
  color: var(--text-primary);
}

.search-container {
  display: flex;
  align-items: center;
  width: 200px;
  position: relative;
  z-index: 1000;
  margin-left: auto;
}


/* 主内容区域 */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background-color: transparent;
  margin-top: 40px; /* 为页面标题栏留出空间 */
  margin-left: 0;
  width: calc(100% - 35px);
  transition: width 0.3s ease, margin-left 0.3s ease; /* 添加过渡效果 */
}

/* 当侧边栏展开时，主内容区域自动调整 */
.sidebar.expanded ~ .main-content {
  width: calc(100% - 200px);
  margin-left: 0px;
}
/* 滚动条样式 */
::-webkit-scrollbar {
  width: 2px;
  height: 2px;
}

::-webkit-scrollbar-track {
  background: rgba(240, 240, 240, 0.5);
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.main-menu {
  display: flex;
  flex-direction: column;
}

.bottom-menu {
  margin-top: auto;
}
</style>