import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../components/HomePage.vue';
import GameManager from '../components/GameManager.vue';
import GameDetail from '../components/GameDetail.vue';
import SettingsPage from '../components/SettingsPage.vue';
import GameInfo from '../components/GameInfo.vue';

const routes = [
  { path: '/', component: Home, meta: { keepAlive: true } }, // 确保路径无重复定义
  { path: '/info', component: GameInfo },
  { path: '/settings', component: SettingsPage },
  { path: '/manage', component: GameManager },
  { path: '/game-detail/:cover', component: GameDetail }
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.VITE_RES_URL || './'), // 修复点
  routes,
});

export default router;