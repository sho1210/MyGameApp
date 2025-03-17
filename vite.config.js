import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

// 自定义插件，用于复制Python脚本文件到正确位置
const copyPythonScripts = () => {
  return {
    name: 'copy-python-scripts',
    closeBundle() {
      // 在构建完成后复制Python脚本到dist目录
      const outDir = 'dist'
      const utilsDir = resolve(outDir, 'utils')
      
      // 确保目标目录存在
      if (!existsSync(utilsDir)) {
        mkdirSync(utilsDir, { recursive: true })
      }
      
      // 复制Python脚本
      const scripts = ['utils/translate.py', 'utils/download_model.py']
      for (const script of scripts) {
        try {
          const srcPath = resolve(script)
          const destPath = resolve(outDir, script)
          const destDir = resolve(destPath, '..')
          
          // 确保目标子目录存在
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true })
          }
          
          copyFileSync(srcPath, destPath)
          console.log(`复制 ${srcPath} 到 ${destPath}`)
        } catch (err) {
          console.error(`复制 ${script} 失败:`, err)
        }
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), copyPythonScripts()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'vuex']
        }
      }
    },
    assetsInlineLimit: 4096, // 小于4kb的资源将内联为base64
    chunkSizeWarningLimit: 1000, // 警告限制大小为1000kb
  }
})