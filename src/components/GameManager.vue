<template>
  <div class="game-manager">
    <div class="header">
      <h1>游戏库管理</h1>
      <button class="add-button" @click="showAddForm = true">添加游戏</button>
    </div>
    
    <!-- 状态消息显示 -->
    <div class="status-message" v-if="statusMessage">
      {{ statusMessage }}
    </div>

    <!-- 游戏列表 -->
    <div class="game-list" v-if="games.length && !showAddForm && !editingGame">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>封面</th>
            <th>背景</th>
            <th>工作目录</th>
            <th>文件名</th>
            <th>描述</th>
            <th>创建时间</th>
            <th>最后游玩</th>
            <th>Shell启动</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="game in games" :key="game.id">
            <td>{{ game.id }}</td>
            <td>{{ game.name }}</td>
            <td class="image-cell">
              <img v-if="game.cover" :src="`file://${game.cover}`" alt="封面" />
              <span v-else>无封面</span>
            </td>
            <td class="image-cell">
              <img v-if="game.back" :src="`file://${game.back}`" alt="背景" />
              <span v-else>无背景</span>
            </td>
            <td :title="game.workingDirectory || '无'">{{ truncateText(game.workingDirectory, 20) || '无' }}</td>
            <td>{{ game.fileName || '无' }}</td>
            <td :title="game.description || '无'">{{ truncateText(game.description, 15) || '无' }}</td>
            <td>{{ formatDateShort(game.created_at) }}</td>
            <td>{{ formatDateShort(game.last_played) }}</td>
            <td>{{ game.use_shell ? '是' : '否' }}</td>
            <td class="actions">
              <button class="edit-button" @click="editGame(game)">编辑</button>
              <button class="delete-button" @click="confirmDelete(game)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 加载状态 -->
    <div v-if="!games.length && !isLoading" class="empty-tip">暂无游戏数据</div>
    <div v-if="isLoading" class="loading">加载中...</div>

    <!-- 添加游戏表单 -->
    <div class="game-form" v-if="showAddForm">
      <h2>添加新游戏</h2>
      <form @submit.prevent="(e) => { e.preventDefault(); addGame(); }">
        <div class="form-group">
          <label for="name">游戏名称</label>
          <div class="input-wrapper">
            <input type="text" id="name" v-model="newGame.name" required />
          </div>
        </div>

        <div class="form-group">
          <label for="cover">封面图片路径</label>
          <div class="input-wrapper">
            <input type="text" id="cover" v-model="newGame.cover" />
            <button type="button" class="browse-button" @click="browseCover">浏览...</button>
          </div>
        </div>

        <div class="form-group">
          <label for="back">背景图片路径</label>
          <div class="input-wrapper">
            <input type="text" id="back" v-model="newGame.back" />
            <button type="button" class="browse-button" @click="browseBack">浏览...</button>
          </div>
        </div>

        <div class="form-group">
          <label for="workingDirectory">工作目录</label>
          <div class="input-wrapper">
            <input type="text" id="workingDirectory" v-model="newGame.workingDirectory" />
            <button type="button" class="browse-button" @click="browseWorkingDir">浏览...</button>
          </div>
        </div>

        <div class="form-group">
          <label for="fileName">可执行文件名</label>
          <div class="input-wrapper">
            <input type="text" id="fileName" v-model="newGame.fileName" />
          </div>
        </div>

        <div class="form-group">
          <label for="use_shell">使用Shell启动</label>
          <div class="input-wrapper">
            <input type="checkbox" id="use_shell" v-model="newGame.use_shell" />
          </div>
        </div>

        <div class="form-group">
          <label for="description">游戏描述</label>
          <div class="input-wrapper">
            <textarea id="description" v-model="newGame.description"></textarea>
          </div>
        </div>

        <!-- 表单底部的保存和取消按钮 -->
        <div class="form-actions">
          <button type="submit" class="submit-button">保存</button>
          <button type="button" class="cancel-button" @click="cancelAdd">取消</button>
        </div>
      </form>
    </div>

    <!-- 编辑游戏表单 -->
    <div class="game-form" v-if="editingGame">
      <h2>编辑游戏</h2>
      <form @submit.prevent="(e) => { e.preventDefault(); updateGame(); }">
        <div class="form-group">
          <label for="edit-name">游戏名称</label>
          <div class="input-wrapper">
            <input type="text" id="edit-name" v-model="editingGame.name" required />
          </div>
        </div>

        <div class="form-group">
          <label for="edit-cover">封面图片路径</label>
          <div class="input-wrapper">
            <input type="text" id="edit-cover" v-model="editingGame.cover" />
            <button type="button" class="browse-button" @click="browseEditCover">浏览...</button>
          </div>
        </div>

        <div class="form-group">
          <label for="edit-back">背景图片路径</label>
          <div class="input-wrapper">
            <input type="text" id="edit-back" v-model="editingGame.back" />
            <button type="button" class="browse-button" @click="browseEditBack">浏览...</button>
          </div>
        </div>

        <div class="form-group">
          <label for="edit-workingDirectory">工作目录</label>
          <div class="input-wrapper">
            <input type="text" id="edit-workingDirectory" v-model="editingGame.workingDirectory" />
            <button type="button" class="browse-button" @click="browseEditWorkingDir">浏览...</button>
          </div>
        </div>

        <div class="form-group">
          <label for="edit-fileName">可执行文件名</label>
          <div class="input-wrapper">
            <input type="text" id="edit-fileName" v-model="editingGame.fileName" />
          </div>
        </div>

        <div class="form-group">
          <label for="edit-use_shell">使用Shell启动</label>
          <div class="input-wrapper">
            <input type="checkbox" id="edit-use_shell" v-model="editingGame.use_shell" />
          </div>
        </div>

        <div class="form-group">
          <label for="edit-description">游戏描述</label>
          <div class="input-wrapper">
            <textarea id="edit-description" v-model="editingGame.description"></textarea>
          </div>
        </div>

        <!-- 表单底部的更新和取消按钮 -->
        <div class="form-actions">
          <button type="submit" class="submit-button">更新</button>
          <button type="button" class="cancel-button" @click="cancelEdit">取消</button>
        </div>
      </form>
    </div>

    <!-- 确认删除对话框 -->
    <div class="confirm-dialog" v-if="showDeleteConfirm">
      <div class="confirm-content">
        <h3>确认删除</h3>
        <p>确定要删除游戏 "{{ gameToDelete?.name }}" 吗？此操作不可撤销。</p>
        <div class="confirm-actions">
          <button class="confirm-button" @click="deleteGame">确认</button>
          <button class="cancel-button" @click="cancelDelete">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';

export default {
  name: 'GameManager',
  setup() {
    // 状态变量
    const games = ref([]);
    const isLoading = ref(true);
    const showAddForm = ref(false);
    const editingGame = ref(null);
    const gameToDelete = ref(null);
    const showDeleteConfirm = ref(false);
    const statusMessage = ref('');
    
    // 新游戏表单数据
    const newGame = reactive({
      name: '',
      cover: '',
      back: '',
      workingDirectory: '',
      fileName: '',
      description: '',
      use_shell: false
    });
    
    // 获取所有游戏数据
    const fetchGames = () => {
      isLoading.value = true;
      // 使用安全的electronAPI获取所有游戏
      window.electronAPI.getAllGames();
    };
    
    // 添加游戏
    const addGame = () => {
      if (!newGame.name) {
        alert('游戏名称不能为空');
        return;
      }
      
      const gameDataToSend = {
        ...newGame,
        created_at: new Date().toISOString(),
        last_played: null,
        // 将布尔值转换为整数，以符合SQLite3的数据绑定要求
        use_shell: newGame.use_shell ? 1 : 0
      };
      
      // 使用安全的electronAPI添加游戏
      window.electronAPI.addGame(gameDataToSend);
      
      // 显示临时状态消息
      statusMessage.value = '正在添加游戏...';
      console.log('已发送添加游戏请求:', gameDataToSend);
    };
    
    // 编辑游戏
    const editGame = (game) => {
      editingGame.value = { ...game };
      showAddForm.value = false;
    };
    
    // 更新游戏
    const updateGame = () => {
      if (!editingGame.value.name) {
        alert('游戏名称不能为空');
        return;
      }
      
      const gameDataToSend = { 
        ...editingGame.value,
        // 将布尔值转换为整数，以符合SQLite3的数据绑定要求
        use_shell: editingGame.value.use_shell ? 1 : 0 
      };
      
      // 使用安全的electronAPI更新游戏
      window.electronAPI.updateGame(gameDataToSend);
    };
    
    // 确认删除
    const confirmDelete = (game) => {
      gameToDelete.value = game;
      showDeleteConfirm.value = true;
    };
    
    // 删除游戏
    const deleteGame = () => {
      if (!gameToDelete.value) return;
      
      // 使用安全的electronAPI删除游戏
      window.electronAPI.deleteGame(gameToDelete.value.id);
    };
    
    // 浏览封面图片
    const browseCover = () => {
      // 使用安全的electronAPI打开文件对话框
      window.electronAPI.openFileDialog('image');
      window.electronAPI.onSelectedFile((event, path) => {
        newGame.cover = path;
      });
    };
    
    // 浏览背景图片
    const browseBack = () => {
      // 使用安全的electronAPI打开文件对话框
      window.electronAPI.openFileDialog('image');
      window.electronAPI.onSelectedFile((event, path) => {
        newGame.back = path;
      });
    };
    
    // 浏览工作目录
    const browseWorkingDir = () => {
      // 使用安全的electronAPI打开目录对话框
      window.electronAPI.openDirectoryDialog();
      window.electronAPI.onSelectedDirectory((event, path) => {
        newGame.workingDirectory = path;
      });
    };
    
    // 浏览编辑模式下的封面图片
    const browseEditCover = () => {
      // 使用安全的electronAPI打开文件对话框
      window.electronAPI.openFileDialog('image');
      window.electronAPI.onSelectedFile((event, path) => {
        editingGame.value.cover = path;
      });
    };
    
    // 浏览编辑模式下的背景图片
    const browseEditBack = () => {
      // 使用安全的electronAPI打开文件对话框
      window.electronAPI.openFileDialog('image');
      window.electronAPI.onSelectedFile((event, path) => {
        editingGame.value.back = path;
      });
    };
    
    // 浏览编辑模式下的工作目录
    const browseEditWorkingDir = () => {
      // 使用安全的electronAPI打开目录对话框
      window.electronAPI.openDirectoryDialog();
      window.electronAPI.onSelectedDirectory((event, path) => {
        editingGame.value.workingDirectory = path;
      });
    };
    
    // 处理游戏数据响应
    const handleGamesResponse = (event, data) => {
      games.value = data;
      isLoading.value = false;
    };
    
    // 处理操作结果响应
    const handleOperationResult = (event, result) => {
      statusMessage.value = result.message;
      
      if (result.success) {
        // 重新获取游戏列表
        fetchGames();
        
        // 重置表单
        if (showAddForm.value) {
          resetForm();
          showAddForm.value = false;
        }
        
        // 重置编辑状态
        if (editingGame.value) {
          editingGame.value = null;
        }
        
        // 重置删除确认
        if (showDeleteConfirm.value) {
          gameToDelete.value = null;
          showDeleteConfirm.value = false;
        }
      }
      
      // 3秒后清除状态消息
      setTimeout(() => {
        statusMessage.value = '';
      }, 3000);
    };
    
    // 重置表单
    const resetForm = () => {
      Object.keys(newGame).forEach(key => {
        if (key === 'use_shell') {
          newGame[key] = false;
        } else {
          newGame[key] = '';
        }
      });
    };
    
    // 取消添加
    const cancelAdd = () => {
      resetForm();
      showAddForm.value = false;
    };
    
    // 取消编辑
    const cancelEdit = () => {
      editingGame.value = null;
    };
    
    // 取消删除
    const cancelDelete = () => {
      gameToDelete.value = null;
      showDeleteConfirm.value = false;
    };
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '从未';
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    };
    
    // 格式化短日期
    const formatDateShort = (dateString) => {
      if (!dateString) return '从未';
      const date = new Date(dateString);
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    };
    
    // 截断文本
    const truncateText = (text, maxLength) => {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };
    
    // 生命周期钩子
    onMounted(() => {
      fetchGames();
      
      // 添加事件监听器
      window.electronAPI.onGamesData(handleGamesResponse);
      window.electronAPI.onOperationResult(handleOperationResult);
      
      // 确保事件监听器正确注册
      console.log('已注册事件监听器: onGamesData, onOperationResult');
    });
    
    onBeforeUnmount(() => {
      // 移除事件监听器
      window.electronAPI.removeGamesDataListener();
      window.electronAPI.removeOperationResultListener();
    });
    
    return {
      games,
      isLoading,
      showAddForm,
      editingGame,
      newGame,
      gameToDelete,
      showDeleteConfirm,
      statusMessage,
      fetchGames,
      addGame,
      editGame,
      updateGame,
      confirmDelete,
      deleteGame,
      browseCover,
      browseBack,
      browseWorkingDir,
      browseEditCover,
      browseEditBack,
      browseEditWorkingDir,
      cancelAdd,
      cancelEdit,
      cancelDelete,
      formatDate,
      formatDateShort,
      truncateText,
      resetForm
    };
  }
};
</script>

<style lang="css" scoped>
.game-manager {
  padding: 20px;
  /*max-width: 1200px;*/
  margin: 0 auto;
  background-color: var(--bg-primary);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status-message {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  padding: 10px 15px;
  border-radius: 5px;
  margin-bottom: 15px;
  text-align: center;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.game-list {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}

th, td {
  padding: 8px 12px;
  border-bottom: 1px solid #e5e5e9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

/* ID列 */
th:nth-child(1), td:nth-child(1) { width: 40px; }

/* 名称列 */
th:nth-child(2), td:nth-child(2) { width: 100px; }

/* 封面列 */
th:nth-child(3), td:nth-child(3) { width: 80px; }

/* 背景列 */
th:nth-child(4), td:nth-child(4) { width: 80px; }

/* 工作目录列 */
th:nth-child(5), td:nth-child(5) { width: 110px; }

/* 文件名列 */
th:nth-child(6), td:nth-child(6) { width: 80px; }

/* 描述列 */
th:nth-child(7), td:nth-child(7) { width: 110px; }

/* 创建时间列 */
th:nth-child(8), td:nth-child(8) { width: 110px; }

/* 最后游玩列 */
th:nth-child(9), td:nth-child(9) { width: 110px; }

/* Shell启动列 */
th:nth-child(10), td:nth-child(10) { width: 80px; }

/* 操作列 */
th:nth-child(11), td:nth-child(11) { width: 120px; }

.image-cell img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center; 
  height: 100%;
  min-height: 70px;
}

button {
  border-radius: 6px;
  font-family: -apple-system;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.add-button {
  background-color: var(--theme-color);
  color: white;
  border: none;
  padding: 8px 16px;
}

.add-button:hover {
  background-color: #0077ed;
  transform: scale(1.03);
}

.edit-button, .delete-button {
  padding: 4px 8px;
  font-size: 12px;
  /*transform: translateY(1px);*/
}

.edit-button {
  background-color: var(--theme-color);
  color: white;
}

.delete-button {
  background-color: #ffebee;
  color: #e53935;
}

.game-form {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 24px;
  max-width: 680px;
  margin: 0 auto;
}

.game-form h2 {
  font-size: 20px;
  color: #1d1d1f;
  margin-bottom: 28px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #86868b;
  font-weight: 400;
}

.input-wrapper {
  position: relative;
  display: flex;
  gap: 8px;
}

input, textarea {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-input-color);
  border-radius: 8px;
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

input:focus, textarea:focus {
  border-color: #0071e3;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
  outline: none;
}

/* 浏览按钮样式 */
.browse-button {
  background: rgba(var(--theme-color-rgb), 0.8);
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: white;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.browse-button:hover {
  background: #e5e5e7;
}

/* 表单操作按钮 */
.form-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.submit-button {
  background: var(--theme-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.submit-button:hover {
  background: #0077ed;
  transform: translateY(-1px);
}

.cancel-button {
  background: transparent;
  border: 1px solid #d2d2d7;
  color: #1d1d1f;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.cancel-button:hover {
  background: #f5f5f7;
}

/* 复选框样式调整 */
input[type="checkbox"] {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #d2d2d7;
  margin-left: 8px;
}

input[type="checkbox"]:checked {
  background-color: #0071e3;
  border-color: #0071e3;
}

.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-content {
  background-color: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>