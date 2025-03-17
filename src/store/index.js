import { createStore } from 'vuex';

// 使用安全的electronAPI替代直接的ipcRenderer
// 从主进程获取初始主题设置
const savedTheme = window.electronAPI.getTheme();
// 从主进程获取初始主题色设置
const savedThemeColor = window.electronAPI.getThemeColor();

export default createStore({
  state: {
    // 主题相关状态
    theme: savedTheme,
    // 主题色状态
    themeColor: savedThemeColor,
  },
  getters: {
    // 获取当前主题
    currentTheme: (state) => state.theme,
    // 判断是否为深色主题
    isDarkTheme: (state) => state.theme === 'dark',
    // 获取当前主题色
    currentThemeColor: (state) => state.themeColor,
  },
  mutations: {
    // 设置主题
    SET_THEME(state, theme) {
      state.theme = theme;
      document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode';
      // 通过安全API将主题设置保存到主进程
      window.electronAPI.setTheme(theme);
    },
    // 设置主题色
    SET_THEME_COLOR(state, color) {
      state.themeColor = color;
      // 设置根元素的主题色变量
      document.documentElement.style.setProperty('--theme-color', color);
      
      // 将颜色转换为RGB格式并应用到CSS变量
      const hexToRgb = (hex) => {
        // 移除#号
        hex = hex.replace('#', '');
        // 解析RGB值
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
      };
      document.documentElement.style.setProperty('--theme-color-rgb', hexToRgb(color));
      
      // 确保深色模式下的主题色也被更新
      if (state.theme === 'dark') {
        document.documentElement.style.setProperty('--theme-color', color);
        document.documentElement.style.setProperty('--theme-color-rgb', hexToRgb(color));
      }
      
      // 通过安全API将主题色设置保存到主进程
      window.electronAPI.setThemeColor(color);
    },
  },
  actions: {
    // 初始化主题的action
    initTheme({ commit, state }) {
      // 应用主题设置
      commit('SET_THEME', state.theme);
      // 应用主题色设置
      commit('SET_THEME_COLOR', state.themeColor);
    },
    // 切换主题的action
    setTheme({ commit }, theme) {
      commit('SET_THEME', theme);
    },
    // 设置主题色的action
    setThemeColor({ commit }, color) {
      commit('SET_THEME_COLOR', color);
    },
  },
});