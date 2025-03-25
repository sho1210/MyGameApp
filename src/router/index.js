import { createRouter, createWebHashHistory } from 'vue-router';
const Home = () => import('../components/HomePage.vue'); 
const GameManager = () => import('../components/GameManager.vue');
const GameDetail = () =>import('../components/GameDetail.vue');
const SettingsPage = () =>import('../components/SettingsPage.vue');
const GameInfo = () =>import('../components/GameInfo.vue');

const routes = [
  { path: '/', component: Home, meta: { keepAlive: true } }, // 确保路径无重复定义
  { path: '/info', component: GameInfo, meta: { keepAlive: false } },
  { path: '/settings', component: SettingsPage, meta: { keepAlive: false } },
  { path: '/manage', component: GameManager, meta: { keepAlive: false } },
  { path: '/game-detail/:cover', component: GameDetail, meta: { keepAlive: false } }
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.VITE_RES_URL || './'), // 修复点
  routes,
});

export default router;