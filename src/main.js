import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js';
import store from './store';
import 'normalize.css'
import './assets/styles/global.css'
import loggerPlugin from './plugins/logger'

const app = createApp(App)
app.use(router)
app.use(store)
app.use(loggerPlugin)

// 初始化主题
store.dispatch('initTheme')

app.mount('#app')
