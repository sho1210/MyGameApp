const path = require('path');
const fs = require('fs');
const os = require('os');
const electron = require('electron');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// 获取app对象，兼容主进程和渲染进程
const app = electron.app || (electron.remote && electron.remote.app);

class TranslationService extends EventEmitter {
  constructor() {
    super();
    
    // 应用目录 - 修复方法，提供备选方案
    this.appDir = require.main ? path.dirname(require.main.filename) : __dirname;
    
    // 模型目录
    this.modelDir = path.join(app.getPath('userData'), 'translation_models');
    
    // 模型名称
    this.modelName = 'Helsinki-NLP/opus-mt-zh-en';
    this.reverseModelName = 'Helsinki-NLP/opus-mt-en-zh';
    
    // 模型状态
    this.isModelReady = false;
    this.isDownloading = false;
    this.downloadProgress = {
      stage: 'checking',
      currentModelName: '',
      percentage: 0
    };
    
    // Python脚本路径（默认值）
    this.translateScriptPath = path.join(__dirname, 'translate.py');
    this.downloadScriptPath = path.join(__dirname, 'download_model.py');
    
    // 自动检查和安装模型
    this.autoCheckAndInstall();
  }
  
  // 设置Python脚本路径
  setPythonScriptPaths(paths) {
    if (paths.translateScript && fs.existsSync(paths.translateScript)) {
      this.translateScriptPath = paths.translateScript;
      console.log(`已设置翻译脚本路径: ${this.translateScriptPath}`);
    } else {
      console.warn(`警告: 提供的翻译脚本路径不存在: ${paths.translateScript}`);
    }
    
    if (paths.downloadScript && fs.existsSync(paths.downloadScript)) {
      this.downloadScriptPath = paths.downloadScript;
      console.log(`已设置下载脚本路径: ${this.downloadScriptPath}`);
    } else {
      console.warn(`警告: 提供的下载脚本路径不存在: ${paths.downloadScript}`);
    }
  }
  
  // 获取模型状态
  getModelStatus() {
    return {
      isReady: this.isModelReady,
      isDownloading: this.isDownloading,
      modelDir: this.modelDir,
      modelName: this.modelName,
      reverseModelName: this.reverseModelName,
      progress: this.downloadProgress
    };
  }
  
  // 自动检查和安装模型
  autoCheckAndInstall() {
    if (this.isDownloading) {
      console.log('已有下载任务正在进行中，跳过检查');
      return;
    }
    
    // 如果已经有下载和检查任务正在进行中，则跳过
    if (this._checkingInProgress) {
      console.log('已有检查任务正在进行中，跳过');
      return;
    }
    
    this._checkingInProgress = true;
    console.log('自动检查和安装依赖与模型...');
    
    // 先检查并安装 Python 依赖，再检查模型
    this._checkPythonDependencies()
      .then(dependencyStatus => {
        console.log('Python依赖检查结果:', dependencyStatus);
        
        // 如果有缺失的依赖，先安装它们
        if (dependencyStatus.missingDependencies && dependencyStatus.missingDependencies.length > 0) {
          console.log('检测到缺失的Python依赖，开始安装:', dependencyStatus.missingDependencies);
          
          // 更新下载进度为依赖安装中
          this.downloadProgress = {
            stage: 'dependencies',
            currentModelName: '安装Python依赖',
            percentage: 10
          };
          this.emit('download-progress', this.downloadProgress);
          
          return this._installPythonDependencies(dependencyStatus)
            .then(installResult => {
              console.log('Python依赖安装结果:', installResult);
              
              // 检查安装结果
              if (installResult && installResult.success) {
                console.log('Python依赖安装成功，继续检查模型');
                
                // 依赖安装成功，更新进度状态为检查模型
                this.downloadProgress = {
                  stage: 'checking',
                  currentModelName: '检查模型文件',
                  percentage: 20
                };
                this.emit('download-progress', this.downloadProgress);
                
                // 依赖安装成功，检查模型
                return this._checkModelExists();
              } else {
                // 依赖安装失败，记录错误
                const errorMessage = installResult ? installResult.message : '依赖安装失败';
                console.error('Python依赖安装失败:', errorMessage);
                
                // 更新下载进度为依赖安装失败
                this.downloadProgress = {
                  stage: 'error',
                  currentModelName: `依赖安装失败: ${errorMessage}`,
                  percentage: 0
                };
                this.emit('download-progress', this.downloadProgress);
                
                // 虽然依赖安装失败，但仍然检查模型是否存在
                return this._checkModelExists();
              }
            })
            .catch(error => {
              console.error('Python依赖安装过程发生错误:', error);
        
              // 更新下载进度为依赖安装失败
              this.downloadProgress = {
                stage: 'error',
                currentModelName: `依赖安装错误: ${error.message}`,
                percentage: 0
              };
              this.emit('download-progress', this.downloadProgress);
              
              // 继续检查模型
              return this._checkModelExists();
            });
        } else {
          console.log('Python依赖已安装，继续检查模型');
          
          // 依赖已安装，更新进度状态为检查模型
          this.downloadProgress = {
            stage: 'checking',
            currentModelName: '检查模型文件',
            percentage: 20
          };
          this.emit('download-progress', this.downloadProgress);
          
          return this._checkModelExists();
        }
      })
      .then(modelExists => {
        console.log('模型检查结果:', modelExists);
        
        if (!modelExists) {
          console.log('未找到翻译模型，开始下载');
          
          // 检查依赖安装状态，只有依赖安装成功或依赖早已安装完成的情况下才下载模型
          const canDownloadModel = 
            this.downloadProgress.stage !== 'error' || 
            !this.downloadProgress.currentModelName?.includes('依赖安装失败');
          
          if (canDownloadModel) {
            this.downloadModel();
          } else {
            console.error('由于依赖安装失败，跳过模型下载');
            // 发射错误事件
              this.emit('download-progress', {
              stage: 'error',
              currentModelName: '依赖安装失败，无法下载模型',
              percentage: 0
            });
          }
        } else {
          console.log('翻译模型已存在，标记为已准备好');
          this.isModelReady = true;
          
          // 更新进度为完成状态
          this.downloadProgress = {
            stage: 'completed',
            currentModelName: '模型检查完成',
            percentage: 100
          };
          this.emit('download-progress', this.downloadProgress);
          
          // 广播模型状态更新
          const modelStatus = this.getModelStatus();
          this.emit('model-status-update', modelStatus);
        }
        
        this._checkingInProgress = false;
      })
      .catch(error => {
        console.error('依赖和模型检查过程出错:', error);
        
        // 更新下载进度为错误
        this.downloadProgress = {
          stage: 'error',
          currentModelName: `检查过程出错: ${error.message}`,
          percentage: 0
        };
        this.emit('download-progress', this.downloadProgress);
        
        this._checkingInProgress = false;
      });
  }
  
  // 清理不完整的下载
  _cleanupIncompleteDownloads() {
    try {
      const zhEnModelPath = path.join(this.modelDir, this.modelName.replace('/', path.sep));
      const enZhModelPath = path.join(this.modelDir, this.reverseModelName.replace('/', path.sep));
      
      // 检查是否有不完整的下载
      const checkAndCleanup = (modelPath) => {
        if (fs.existsSync(modelPath)) {
          const requiredFiles = [
            'config.json',
            'special_tokens_map.json',
            'tokenizer_config.json',
            'vocab.json'
          ];
          
          // 检查模型文件
          const modelPath1 = path.join(modelPath, 'pytorch_model.bin');
          const modelPath2 = path.join(modelPath, 'model.safetensors');
          
          // 检查是否缺少任何必要文件
          let isIncomplete = !fs.existsSync(modelPath1) && !fs.existsSync(modelPath2);
          if (!isIncomplete) {
            for (const file of requiredFiles) {
              if (!fs.existsSync(path.join(modelPath, file))) {
                isIncomplete = true;
                break;
              }
            }
          }
          
          // 如果不完整，则清理
          if (isIncomplete) {
            console.log(`检测到不完整的模型下载: ${modelPath}，清理中...`);
            try {
              // 递归删除目录
              require('fs-extra').removeSync(modelPath);
              console.log(`已清理不完整的模型目录: ${modelPath}`);
            } catch (error) {
              console.warn(`清理模型目录失败: ${modelPath}`, error);
            }
          }
        }
      };
      
      // 检查和清理两个模型路径
      checkAndCleanup(zhEnModelPath);
      checkAndCleanup(enZhModelPath);
      
    } catch (error) {
      console.warn('清理不完整下载时出错:', error);
    }
  }
  
  // 直接备用下载尝试
  _tryDirectFallbackDownload() {
    return new Promise(async (resolve) => {
      try {
        console.log('尝试直接使用备用方法下载模型...');
        
        this.emit('download-progress', {
                stage: 'preparing',
          currentModelName: '使用备用方法下载模型',
                percentage: 10
        });
        
        // 设置下载超时（30分钟）
        const downloadTimeout = setTimeout(() => {
          console.error('备用下载超时，可能已经卡住');
          
          // 更新下载进度为错误
          this.emit('download-progress', {
            stage: 'error',
            currentModelName: '备用下载超时，请重试',
            percentage: 0
          });
          
          if (downloadProcess && !downloadProcess.killed) {
            try {
              downloadProcess.kill();
              console.log('已终止卡住的备用下载进程');
            } catch (err) {
              console.error('终止备用下载进程失败:', err);
            }
          }
          
          resolve(false);
        }, 30 * 60 * 1000); // 30分钟超时
        
        // 获取Python命令
        let pythonCmd;
        try {
          pythonCmd = await this._detectPythonCommand();
          if (!pythonCmd) {
            throw new Error('无法找到Python环境');
          }
          console.log(`使用Python命令: ${pythonCmd}`);
        } catch (error) {
          console.error('检测Python命令时出错:', error);
          
          this.emit('download-progress', {
            stage: 'error',
            currentModelName: `找不到Python环境: ${error.message}`,
            percentage: 0
          });
          
          clearTimeout(downloadTimeout);
          resolve(false);
          return;
        }
        
        // 直接下载
        const modelDir = this.modelDir;
        const zhEnModel = this.modelName;
        const enZhModel = this.reverseModelName;
        
        // 尝试使用直接调用transformers库的方式下载
        const tempPath = require('os').tmpdir();
        const directScriptPath = path.join(tempPath, 'direct_download.py');
        
        // Python脚本内容 - 注意确保脚本使用UTF-8编码
        const directScript = `
# -*- coding: utf-8 -*-
import os
import sys
import time
import json

def report_progress(stage, model_name, percentage, message=""):
    """向主进程报告下载进度"""
    progress_info = {
        "stage": stage,
        "model": model_name,
        "percentage": percentage,
        "message": message
    }
    print(json.dumps(progress_info, ensure_ascii=False), flush=True)
    time.sleep(0.1)  # 确保输出被处理

try:
    report_progress("preparing", "加载transformers库", 5, "正在加载依赖库")
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    print("Successfully imported transformers library")
    report_progress("preparing", "依赖库加载成功", 10, "开始准备下载")
except ImportError as e:
    error_msg = f"Failed to import transformers: {e}"
    print(error_msg)
    report_progress("error", "依赖库加载失败", 0, error_msg)
    sys.exit(1)

def download_model(model_name, output_dir):
    print(f"Downloading model: {model_name}")
    report_progress("downloading", model_name, 10, "初始化下载")
    
    try:
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Download tokenizer
        print(f"Downloading tokenizer for {model_name}")
        report_progress("tokenizer", model_name, 20, "下载分词器")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        tokenizer.save_pretrained(output_dir)
        print(f"Tokenizer saved to {output_dir}")
        report_progress("tokenizer", model_name, 40, "分词器下载完成")
        
        # Download model
        print(f"Downloading model weights for {model_name}")
        report_progress("model", model_name, 50, "下载模型权重")
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        model.save_pretrained(output_dir)
        print(f"Model saved to {output_dir}")
        report_progress("model", model_name, 90, "模型权重下载完成")
        
        # Verify files
        report_progress("verifying", model_name, 95, "验证文件")
        required_files = ['config.json', 'tokenizer_config.json', 'vocab.json']
        model_files = ['pytorch_model.bin', 'model.safetensors']
        
        # 检查必须的配置文件
        for file in required_files:
            if not os.path.exists(os.path.join(output_dir, file)):
                error_msg = f"Required file missing: {file}"
                print(error_msg)
                report_progress("error", model_name, 0, error_msg)
                return False
        
        # 检查至少一个模型文件存在
        has_model_file = False
        for file in model_files:
            if os.path.exists(os.path.join(output_dir, file)):
                has_model_file = True
                break
        
        if not has_model_file:
            error_msg = "No model weight file found"
            print(error_msg)
            report_progress("error", model_name, 0, error_msg)
            return False
            
        report_progress("completed", model_name, 100, "下载和验证完成")
        return True
    except Exception as e:
        error_msg = f"Error downloading model: {e}"
        print(error_msg)
        report_progress("error", model_name, 0, error_msg)
        return False

if __name__ == "__main__":
    # Get model names from command line
    if len(sys.argv) < 4:
        print("Usage: python direct_download.py <output_dir> <zh_en_model> <en_zh_model>")
        sys.exit(1)
    
    output_dir = sys.argv[1]
    zh_en_model = sys.argv[2]
    en_zh_model = sys.argv[3]
    
    print(f"Output directory: {output_dir}")
    print(f"Models to download: {zh_en_model}, {en_zh_model}")
    report_progress("preparing", "准备下载", 15, f"准备下载两个模型: {zh_en_model}, {en_zh_model}")
    
    # Download zh-en model
    print("\\nDownloading Chinese to English model...")
    zh_en_path = os.path.join(output_dir, zh_en_model.replace('/', os.sep))
    report_progress("downloading", zh_en_model, 20, "开始下载中译英模型")
    zh_en_success = download_model(zh_en_model, zh_en_path)
    
    # Download en-zh model
    print("\\nDownloading English to Chinese model...")
    en_zh_path = os.path.join(output_dir, en_zh_model.replace('/', os.sep))
    report_progress("downloading", en_zh_model, 60, "开始下载英译中模型")
    en_zh_success = download_model(en_zh_model, en_zh_path)
    
    # Check results
    if zh_en_success and en_zh_success:
        print("\\nAll models downloaded successfully!")
        report_progress("completed", "全部完成", 100, "两个模型都下载成功")
        sys.exit(0)
    else:
        error_msg = "\\nFailed to download some models:"
        if not zh_en_success:
            error_msg += f"\\n- {zh_en_model} download failed"
        if not en_zh_success:
            error_msg += f"\\n- {en_zh_model} download failed"
        print(error_msg)
        report_progress("error", "下载失败", 0, error_msg)
        sys.exit(1)
`;
        
        // 将脚本写入临时文件，确保UTF-8编码
        try {
        fs.writeFileSync(directScriptPath, directScript, 'utf8');
        console.log('创建直接下载脚本:', directScriptPath);
        } catch (error) {
          console.error('创建下载脚本文件失败:', error);
          
          this.emit('download-progress', {
            stage: 'error',
            currentModelName: `创建脚本文件失败: ${error.message}`,
            percentage: 0
          });
          
          clearTimeout(downloadTimeout);
          resolve(false);
          return;
        }
        
        // 执行脚本
        this.emit('download-progress', {
          stage: 'downloading',
          currentModelName: '准备直接下载模型',
          percentage: 15
        });
        
        // 设置进度监控计时器
        let lastProgressTime = Date.now();
        let lastProgressPercentage = 0;
        
        const progressMonitor = setInterval(() => {
          const currentTime = Date.now();
          const elapsedSinceLastProgress = (currentTime - lastProgressTime) / 1000; // 秒
          
          // 如果超过5分钟没有进度更新，认为下载已经卡住
          if (elapsedSinceLastProgress > 300 && lastProgressPercentage > 0) {
            console.warn(`备用下载可能已卡住，${Math.round(elapsedSinceLastProgress)}秒没有进度更新`);
            
            // 如果卡在同一个百分比超过20分钟，尝试终止下载
            if (elapsedSinceLastProgress > 1200 && this.downloadProgress.percentage === lastProgressPercentage) {
              console.error('备用下载卡住超过20分钟，终止下载');
              
              // 更新下载进度为错误
              this.emit('download-progress', {
                stage: 'error',
                currentModelName: '备用下载卡住超过20分钟，请重试',
                percentage: 0
              });
              
              clearTimeout(downloadTimeout);
              clearInterval(progressMonitor);
              
              if (downloadProcess && !downloadProcess.killed) {
                try {
                  downloadProcess.kill();
                  console.log('已终止卡住的备用下载进程');
                } catch (err) {
                  console.error('终止备用下载进程失败:', err);
                }
              }
              
              resolve(false);
            }
          }
        }, 60 * 1000); // 每分钟检查一次
        
        // 启动Python脚本，确保设置UTF-8编码
        const downloadProcess = spawn(pythonCmd, [
          directScriptPath,
          modelDir,
          zhEnModel,
          enZhModel
        ], {
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        
        let output = '';
        
        // 处理标准输出
        downloadProcess.stdout.on('data', (data) => {
          try {
            // 确保使用UTF-8编码解析Buffer
            const text = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
            output += text;
            console.log(`备用下载输出: ${text}`);
            
            // 分割输出，处理可能的多行JSON
            const lines = text.split('\n');
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              
              // 尝试查找和解析JSON对象
              if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                try {
                  const progressData = JSON.parse(trimmedLine);
                  
                  // 检查是否是有效的进度信息
                  if (progressData && progressData.stage) {
                    // 创建标准化的进度对象
                    const stage = progressData.stage || 'downloading';
                    const modelName = progressData.model || '';
                    const percentage = progressData.percentage !== undefined ? progressData.percentage : 30;
                    const message = progressData.message || '';
                    
                    // 根据阶段处理进度
                    let displayName = '';
                    let displayPercentage = percentage;
                    
                    switch(stage) {
                      case 'preparing':
                        displayName = '准备下载' + (message ? ': ' + message : '');
                        displayPercentage = Math.max(5, Math.min(15, percentage));
                        break;
                      case 'downloading':
                        displayName = '下载模型文件' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(20, Math.min(50, percentage));
                        break;
                      case 'tokenizer':
                        displayName = '下载分词器' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(30, Math.min(60, percentage));
                        break;
                      case 'model':
                        displayName = '下载模型权重' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(60, Math.min(90, percentage));
                        break;
                      case 'verifying':
                        displayName = '验证模型文件' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(90, Math.min(99, percentage));
                        break;
                      case 'completed':
                        // 只有在全部完成时才显示100%，避免提前显示完成
                        if (message && message.includes("两个模型都下载成功")) {
                          displayName = '下载完成: ' + (message || '模型已下载成功');
                          displayPercentage = 100;
                        } else {
                          // 部分完成时不要显示为100%
                          displayName = '模型部分完成: ' + (message || '继续下载中');
                          displayPercentage = 95; 
                        }
                        break;
                      case 'error':
                        displayName = '下载出错: ' + (message || '未知错误');
                        displayPercentage = 0;
                        break;
                      default:
                        displayName = '模型处理中';
                        break;
                    }
                    
                    // 保存当前阶段用于后续判断
                    this._currentDownloadStage = stage;
                    
                    // 创建干净的进度对象
                    const progress = {
                      stage: stage,
                      currentModelName: displayName,
                      percentage: displayPercentage
                    };
                    
                    // 更新最后进度时间和百分比
                    lastProgressTime = Date.now();
                    lastProgressPercentage = displayPercentage;
                    
                    // 保存进度以便其他地方引用
                    this.downloadProgress = progress;
                    
                    // 发射进度事件
                    this.emit('download-progress', progress);
                  }
                } catch (e) {
                  console.error('解析JSON失败:', e);
                }
              }
            }
          } catch (e) {
            console.error('处理Python输出时出错:', e);
          }
        });
        
        // 处理错误输出
        downloadProcess.stderr.on('data', (data) => {
          const errorText = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
          console.error(`备用下载错误: ${errorText}`);
        });
        
        // 处理进程结束
        downloadProcess.on('close', (code) => {
          console.log(`备用下载进程退出，代码: ${code}`);
          
          // 清除计时器
          clearTimeout(downloadTimeout);
          clearInterval(progressMonitor);
          
          if (code === 0) {
            console.log('备用下载成功');
            
            // 检查模型文件
            this._checkModelExists().then(exists => {
              if (exists) {
                console.log('模型文件验证成功');
                this.isModelReady = true;
                
                // 发射成功事件 - 确保只有在真正完成时才报告100%
                this.emit('download-progress', {
                  stage: 'completed',
                  currentModelName: '备用下载完成，模型验证成功',
                  percentage: 100
                });
                
                resolve(true);
              } else {
                console.error('模型文件验证失败');
                
                // 发射失败事件
                this.emit('download-progress', {
                  stage: 'error',
                  currentModelName: '备用下载文件验证失败',
                  percentage: 0
                });
                
                resolve(false);
              }
            });
          } else {
            console.error('备用下载失败');
            
            // 解析可能的错误
            let errorMessage = '备用下载失败';
            if (output.includes('ConnectionError') || output.includes('Connection refused')) {
              errorMessage = '网络连接错误，请检查网络';
            } else if (output.includes('TimeoutError')) {
              errorMessage = '下载超时，请重试';
            } else if (output.includes('MemoryError')) {
              errorMessage = '内存不足，无法下载模型';
            } else if (output.includes('ImportError') || output.includes('ModuleNotFoundError')) {
              errorMessage = 'Python依赖库缺失，请确保安装了transformers和torch';
            }
            
            // 发射失败事件
            this.emit('download-progress', {
              stage: 'error',
              currentModelName: `${errorMessage}，退出码: ${code}`,
              percentage: 0
            });
            
            resolve(false);
          }
        });
        
        // 处理进程错误
        downloadProcess.on('error', (error) => {
          console.error(`备用下载进程错误: ${error}`);
          
          // 清除计时器
          clearTimeout(downloadTimeout);
          clearInterval(progressMonitor);
          
          // 发射错误事件
          this.emit('download-progress', {
            stage: 'error',
            currentModelName: `备用下载错误: ${error.message}`,
            percentage: 0
          });
          
          resolve(false);
        });
        
      } catch (error) {
        console.error('直接备用下载尝试失败:', error);
        
        // 发射错误事件
        this.emit('download-progress', {
          stage: 'error',
          currentModelName: `备用下载准备失败: ${error.message}`,
          percentage: 0
        });
        
        resolve(false);
      }
      });
  }
  
  // 翻译文本
  async translateText(text) {
    return new Promise((resolve, reject) => {
      // 检查模型是否准备好
      if (!this.isModelReady) {
        reject(new Error('翻译模型未准备好，请稍后再试'));
        return;
      }
      
      try {
        console.log(`翻译文本: "${text}"`);
        
        // 优先使用设置的翻译脚本路径
        let scriptPath = this.translateScriptPath;
        let needsCopy = false;
        
        // 检查脚本是否存在，不存在则尝试复制到临时目录
        if (!fs.existsSync(scriptPath)) {
          console.warn(`指定的翻译脚本不存在: ${scriptPath}，尝试在临时目录创建`);
          const tempPath = require('os').tmpdir();
          scriptPath = path.join(tempPath, 'translate.py');
          needsCopy = true;
        }
        
        // 如果需要复制脚本
        if (needsCopy) {
          // 尝试从当前目录复制脚本
          const sourceScriptPath = path.join(__dirname, 'translate.py');
          if (fs.existsSync(sourceScriptPath)) {
            console.log(`复制翻译脚本: ${sourceScriptPath} -> ${scriptPath}`);
            fs.copyFileSync(sourceScriptPath, scriptPath);
          } else {
            reject(new Error('找不到翻译脚本文件'));
            return;
          }
        }
        
        // 构建Python命令
        this._detectPythonCommand().then(pythonCmd => {
          if (!pythonCmd) {
            reject(new Error('未找到可用的Python命令'));
            return;
          }
          
          console.log(`使用Python命令: ${pythonCmd}`);
          
          // 构建模型目录路径
          const modelDir = this.modelDir;
          const zhEnModel = this.modelName;
          const enZhModel = this.reverseModelName;
          
          // 构建命令行参数
          const cmdArgs = [
            scriptPath,
            text,
            modelDir,
            zhEnModel,
            enZhModel
          ];
          
          // 记录完整命令行
          console.log('执行翻译命令:', `"${pythonCmd}" "${cmdArgs.join('" "')}"`);
          
          // 使用spawn执行Python脚本，确保指定编码为utf8
          const process = spawn(pythonCmd, cmdArgs, { encoding: 'utf8' });
          
          let stdoutData = '';
          let stderrData = '';
          
          // 收集标准输出
          process.stdout.on('data', (data) => {
            // 确保使用UTF-8编码解析Buffer
            const chunk = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
            console.log(`翻译进程输出: ${chunk}`);
            stdoutData += chunk;
          });
          
          // 收集错误输出
          process.stderr.on('data', (data) => {
            const chunk = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
            console.error(`翻译进程错误: ${chunk}`);
            stderrData += chunk;
          });
          
          // 处理进程结束
          process.on('close', (code) => {
            console.log(`翻译进程退出，代码: ${code}`);
            
            if (code !== 0) {
              console.error(`翻译进程异常退出，错误信息: ${stderrData}`);
              reject(new Error(`翻译失败，退出代码 ${code}: ${stderrData}`));
              return;
            }
            
            try {
              // 先尝试查找标记的JSON结果
              const startMarker = "--- TRANSLATION RESULT JSON BEGIN ---";
              const endMarker = "--- TRANSLATION RESULT JSON END ---";
              
              const startIndex = stdoutData.indexOf(startMarker);
              const endIndex = stdoutData.indexOf(endMarker);
              
              if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                // 提取标记之间的JSON文本
                const jsonText = stdoutData.substring(startIndex + startMarker.length, endIndex).trim();
                console.log('找到标记的JSON结果:', jsonText);
                
                try {
                  const result = JSON.parse(jsonText);
                  console.log('成功解析标记的JSON结果:', result);
                  
                  resolve({
                    translatedText: String(result.translatedText || ''),
                    sourceLanguage: result.sourceLanguage || 'unknown',
                    targetLanguage: result.targetLanguage || 'unknown'
                  });
                  return;
                } catch (err) {
                  console.error('解析标记的JSON失败:', err, '原始内容:', jsonText);
                  // 继续尝试其他方法
                }
              }
              
              // 如果没有找到标记的JSON，尝试其他解析方法
              let jsonResult = null;
              const lines = stdoutData.split('\n');
              
              console.log('尝试行解析，输出行数:', lines.length);
              
              for (const line of lines) {
                if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
                  try {
                    const parsed = JSON.parse(line.trim());
                    // 如果包含翻译结果或错误，这可能是我们要找的JSON
                    if (parsed.translatedText || parsed.error) {
                      jsonResult = parsed;
                      console.log('行解析成功找到JSON结果');
                      break;
                    }
                  } catch (e) {
                    // 不是有效的JSON，继续查找
                  }
                }
              }
              
              if (jsonResult) {
                if (jsonResult.error) {
                  reject(new Error(jsonResult.error));
                } else {
                  console.log('翻译结果:', jsonResult);
                  // 确保translatedText是字符串
                  if (jsonResult.translatedText === null || jsonResult.translatedText === undefined) {
                    jsonResult.translatedText = '翻译失败';
                  }
                  
                  resolve({
                    translatedText: String(jsonResult.translatedText),
                    sourceLanguage: jsonResult.sourceLanguage,
                    targetLanguage: jsonResult.targetLanguage
                  });
                }
              } else {
                console.error('无法从翻译进程输出中解析JSON结果，原始输出:', stdoutData);
                
                // 尝试使用正则表达式直接提取JSON
                const jsonRegex = /{[\s\S]*?}/;
                const match = stdoutData.match(jsonRegex);
                if (match) {
                  try {
                    const extractedJson = JSON.parse(match[0]);
                    console.log('使用正则表达式成功提取JSON:', extractedJson);
                    
                    if (extractedJson.translatedText) {
                      resolve({
                        translatedText: String(extractedJson.translatedText),
                        sourceLanguage: extractedJson.sourceLanguage || 'unknown',
                        targetLanguage: extractedJson.targetLanguage || 'unknown'
                      });
                      return;
                    }
                  } catch (e) {
                    console.error('使用正则表达式提取JSON失败:', e);
                  }
                }
                
                // 如果无法提取JSON，返回原始文本作为备选
                console.warn('无法提取JSON，使用原始输出作为结果');
                resolve({
                  translatedText: stdoutData.trim() || '翻译结果解析失败',
                  sourceLanguage: 'unknown',
                  targetLanguage: 'unknown'
                });
              }
            } catch (error) {
              console.error('处理翻译结果时出错:', error);
              reject(error);
            }
          });
          
          // 处理进程错误
          process.on('error', (error) => {
            console.error('启动翻译进程时出错:', error);
            reject(error);
          });
        }).catch(error => {
          console.error('检测Python命令时出错:', error);
          reject(error);
        });
        
        // 设置超时
        setTimeout(() => {
          reject(new Error('翻译请求超时'));
        }, 30000); // 30秒超时
    } catch (error) {
      console.error('翻译文本时出错:', error);
      throw error;
    }
    });
  }
  
  // 确保模型目录存在
  _ensureModelDir() {
    if (!fs.existsSync(this.modelDir)) {
      fs.mkdirSync(this.modelDir, { recursive: true });
      console.log(`创建模型目录: ${this.modelDir}`);
    }
  }
  
  // 检查模型是否存在
  _checkModelExists() {
    return new Promise((resolve) => {
      try {
        // 确保模型目录存在
        this._ensureModelDir();
        
        // 构建模型路径
        const modelDir = this.modelDir;
        const zhEnModelPath = path.join(modelDir, this.modelName.replace('/', path.sep));
        const enZhModelPath = path.join(modelDir, this.reverseModelName.replace('/', path.sep));
        
        console.log('检查模型是否存在:');
        console.log(`- 中译英模型路径: ${zhEnModelPath}`);
        console.log(`- 英译中模型路径: ${enZhModelPath}`);
        
        let zhEnModelExists = false;
        let enZhModelExists = false;
        
        // 主模型检查
        if (fs.existsSync(zhEnModelPath)) {
      // 列出目录内容
        const files = fs.readdirSync(zhEnModelPath);
          
          // 检查是否存在关键模型文件
          if (files.includes('config.json') && 
             (files.includes('pytorch_model.bin') || files.includes('model.safetensors'))) {
            console.log('中译英模型文件检查通过');
            zhEnModelExists = true;
          } else {
            console.log('中译英模型目录存在，但缺少关键文件');
            
            // 获取目录内容列表
            console.log('目录内容:');
            files.forEach(file => {
              try {
                const stats = fs.statSync(path.join(zhEnModelPath, file));
                console.log(`  - ${file} (${stats.isDirectory() ? '目录' : '文件'}, ${stats.size} 字节)`);
              } catch (e) {
                console.log(`  - ${file} (无法获取文件信息)`);
              }
            });
          }
        } else {
          console.log('中译英模型目录不存在');
        }
        
        // 辅助模型检查
        if (fs.existsSync(enZhModelPath)) {
          // 列出目录内容
        const files = fs.readdirSync(enZhModelPath);
          
          // 检查是否存在关键模型文件
          if (files.includes('config.json') && 
             (files.includes('pytorch_model.bin') || files.includes('model.safetensors'))) {
            console.log('英译中模型文件检查通过');
            enZhModelExists = true;
          } else {
            console.log('英译中模型目录存在，但缺少关键文件');
            
            // 获取目录内容列表
            console.log('目录内容:');
            files.forEach(file => {
              try {
                const stats = fs.statSync(path.join(enZhModelPath, file));
                console.log(`  - ${file} (${stats.isDirectory() ? '目录' : '文件'}, ${stats.size} 字节)`);
              } catch (e) {
                console.log(`  - ${file} (无法获取文件信息)`);
              }
            });
          }
        } else {
          console.log('英译中模型目录不存在');
        }
        
        // 设置模型就绪状态
        const modelExists = zhEnModelExists && enZhModelExists;
        this.isModelReady = modelExists;
        
        console.log(`模型检查结果: ${modelExists ? '所有模型都存在' : '模型不完整'}`);
        
        // 清理不完整的下载
        if (!modelExists) {
          console.log('检测到模型不完整，尝试清理...');
          this._cleanupIncompleteDownloads();
        }
        
        resolve(modelExists);
    } catch (error) {
        console.error('检查模型存在性时出错:', error);
      this.isModelReady = false;
        resolve(false);
    }
    });
  }
  
  // 检查Python依赖
  _checkPythonDependencies() {
    return new Promise((resolve, reject) => {
      console.log('检查Python环境和依赖...');
      
      // 首先检查Python版本
      const checkPythonProcess = spawn('python', ['--version']);
      
      let pythonVersionOutput = '';
      let pythonVersionError = '';
      
      checkPythonProcess.stdout.on('data', (data) => {
        pythonVersionOutput += data.toString();
      });
      
      checkPythonProcess.stderr.on('data', (data) => {
        pythonVersionError += data.toString();
      });
      
      checkPythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('无法检查Python版本，命令失败:', pythonVersionError);
          console.log('尝试使用python3命令...');
          
          // 尝试使用python3命令
          const checkPython3Process = spawn('python3', ['--version']);
          
          let python3VersionOutput = '';
          checkPython3Process.stdout.on('data', (data) => {
            python3VersionOutput += data.toString();
          });
          
          checkPython3Process.on('close', (python3Code) => {
            if (python3Code !== 0) {
              console.error('无法找到可用的Python环境，请确保已安装Python 3.6+');
              reject(new Error('无法找到可用的Python环境，请确保已安装Python 3.6+'));
              return;
            }
            
            console.log(`检测到Python版本: ${python3VersionOutput.trim()}`);
            // 继续检查pip和依赖
            this._checkPipAndDependencies('python3', resolve, reject);
          });
          return;
        }
        
        console.log(`检测到Python版本: ${pythonVersionOutput.trim()}`);
        // 继续检查pip和依赖
        this._checkPipAndDependencies('python', resolve, reject);
      });
    });
  }
  
  // 检查pip和依赖
  _checkPipAndDependencies(pythonCmd, resolve, reject) {
    console.log(`使用${pythonCmd}检查pip和依赖...`);
    const checkPipProcess = spawn(pythonCmd, ['-m', 'pip', 'list']);
    
    let output = '';
    let errorOutput = '';
    
    checkPipProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    checkPipProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    checkPipProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`无法检查Python依赖，pip命令失败: ${errorOutput}`);
        reject(new Error(`无法检查Python依赖: ${errorOutput}`));
        return;
      }
      
      // 定义必需的依赖列表
      const requiredDependencies = [
        'transformers', 
        'torch',
        'sentencepiece'
      ];
      
      // 定义可选的依赖列表（如果有的话）
      const optionalDependencies = [
        'tqdm',
        'numpy'
      ];
      
      // 检查每个必需的依赖是否已安装
      const dependencyStatus = {};
      const missingDependencies = [];
      
      requiredDependencies.forEach(dep => {
        const isInstalled = output.toLowerCase().includes(dep.toLowerCase());
        dependencyStatus[dep] = isInstalled;
        
        if (!isInstalled) {
          missingDependencies.push(dep);
        }
      });
      
      // 检查可选依赖
      optionalDependencies.forEach(dep => {
        const isInstalled = output.toLowerCase().includes(dep.toLowerCase());
        dependencyStatus[dep] = isInstalled;
      });
      
      // 日志记录检查结果
      console.log('Python依赖检查结果:');
      for (const [dep, installed] of Object.entries(dependencyStatus)) {
        console.log(`- ${dep}: ${installed ? '已安装' : '未安装'}`);
      }
      
      // 如果有缺失的依赖，记录下来
      if (missingDependencies.length > 0) {
        console.log(`检测到缺失的必需依赖: ${missingDependencies.join(', ')}`);
      } else {
        console.log('所有必需的依赖已安装');
      }
      
      // 返回检查结果
      resolve({
        dependencyStatus,
        missingDependencies,
        pythonCmd,
        allDependenciesInstalled: missingDependencies.length === 0
      });
    });
  }
  
  // 安装Python依赖
  _installPythonDependencies(dependencyStatus) {
    return new Promise((resolve, reject) => {
      try {
        console.log('开始安装缺失的Python依赖...');
        
        // 检查依赖状态
        if (!dependencyStatus || !dependencyStatus.missingDependencies || !dependencyStatus.pythonCmd) {
          console.error('依赖状态无效');
          reject(new Error('无效的依赖状态'));
        return;
      }
      
        // 获取Python命令和缺失的依赖
        const pythonCmd = dependencyStatus.pythonCmd;
        const missingDependencies = dependencyStatus.missingDependencies;
        
        if (missingDependencies.length === 0) {
          console.log('没有缺失的依赖需要安装');
          resolve({ success: true });
          return;
        }
        
        console.log(`将使用 ${pythonCmd} 安装以下依赖:`, missingDependencies);
        
        // 更新下载进度为开始安装依赖
        this.downloadProgress = {
          stage: 'dependencies',
          currentModelName: '安装Python依赖',
          percentage: 15
        };
        this.emit('download-progress', this.downloadProgress);
        
        // 调用安装方法
      this._installMissingDependencies(dependencyStatus, resolve, reject);
      } catch (error) {
        console.error('安装Python依赖时出错:', error);
        
        // 更新下载进度为错误
        this.downloadProgress = {
          stage: 'error',
          currentModelName: `依赖安装失败: ${error.message}`,
          percentage: 0
        };
        this.emit('download-progress', this.downloadProgress);
        
        reject(error);
      }
    });
  }
  
  // 安装缺失的依赖
  _installMissingDependencies(dependencyStatus, resolve, reject) {
    const pythonCmd = dependencyStatus.pythonCmd;
    const missingDependencies = dependencyStatus.missingDependencies;
        
        // 创建需要安装的依赖列表
    const dependencies = missingDependencies.map(dep => {
      return { name: dep, retries: 3 };
    });
    
    // 更新下载进度
    this.downloadProgress = {
      stage: 'dependencies',
      currentModelName: `准备安装 ${dependencies.length} 个Python依赖`,
      percentage: 15
    };
          this.emit('download-progress', this.downloadProgress);
    
    // 创建一个进度回调函数
        const updateProgress = (index, percentage) => {
      const totalPercentage = 15 + Math.floor(percentage * 5 / 100);
      const currentDep = dependencies[index] ? dependencies[index].name : '未知依赖';
      
      // 更新下载进度
      this.downloadProgress = {
        stage: 'dependencies',
        currentModelName: `安装 ${currentDep} (${index + 1}/${dependencies.length})`,
        percentage: totalPercentage
      };
          this.emit('download-progress', this.downloadProgress);
        };
        
    // 使用Python安装依赖
        this._installDependenciesWithPython(pythonCmd, dependencies, updateProgress)
      .then(result => {
        console.log('Python依赖安装结果:', result);
        
        // 计算成功安装的依赖数量
        const successCount = result.filter(r => r.success).length;
        const totalCount = dependencies.length;
        
        // 更新下载进度
        this.downloadProgress = {
          stage: 'dependencies',
          currentModelName: `依赖安装完成 (${successCount}/${totalCount})`,
          percentage: 20
        };
            this.emit('download-progress', this.downloadProgress);
        
        // 检查是否所有依赖都安装成功
        if (successCount === totalCount) {
          console.log('所有依赖安装成功');
          
          if (this._checkingInProgress) {
            console.log('依赖安装成功，继续检查模型是否存在');
            
            // 如果是在自动检查流程中，继续进行模型检查
            resolve({ 
              success: true, 
              message: '所有依赖安装成功'
            });
          } else {
            console.log('依赖安装成功，检查模型是否存在');
            
            // 如果不是自动检查流程，在安装依赖后立即检查模型
            this._checkModelExists().then(modelExists => {
              if (!modelExists) {
                console.log('模型不存在，开始下载模型');
                
                // 更新下载进度
                this.downloadProgress = {
                  stage: 'checking',
                  currentModelName: '检查模型',
                  percentage: 20
                };
                this.emit('download-progress', this.downloadProgress);
                
                // 开始下载模型
                this._downloadModelFiles(pythonCmd).then(success => {
                  console.log('模型下载完成，结果:', success);
                  resolve({ 
                    success: true, 
                    message: '依赖安装成功，模型下载完成'
                  });
                }).catch(error => {
                  console.error('模型下载失败:', error);
                  resolve({ 
                    success: true, 
                    message: '依赖安装成功，但模型下载失败'
                  });
                });
              } else {
                console.log('模型已存在，标记翻译服务为就绪状态');
                this.isModelReady = true;
                resolve({ 
                  success: true, 
                  message: '所有依赖安装成功，模型已存在'
                });
              }
            }).catch(error => {
              console.error('检查模型是否存在时出错:', error);
              resolve({ 
                success: true, 
                message: '所有依赖安装成功，但检查模型失败'
              });
            });
          }
        } else {
          // 如果有依赖安装失败，返回失败状态
          console.error(`部分依赖安装失败: ${successCount}/${totalCount} 成功`);
          
          // 获取失败的依赖名称
          const failedDependencies = result
            .filter(r => !r.success)
            .map(r => r.name);
          
          console.error(`安装失败的依赖: ${failedDependencies.join(', ')}`);
          
          resolve({ 
            success: false, 
            partialSuccess: successCount > 0,
            successCount,
            totalCount,
            failedDependencies,
            message: `部分依赖安装失败: ${failedDependencies.join(', ')}`
          });
        }
      })
      .catch(error => {
        console.error('安装Python依赖失败:', error);
        
        // 更新下载进度为依赖安装失败
        this.downloadProgress = {
          stage: 'dependencies',
          currentModelName: `依赖安装失败: ${error.message}`,
          percentage: 15
        };
        this.emit('download-progress', this.downloadProgress);
        
        // 返回失败状态
        resolve({ 
          success: false, 
          error: error.message,
          message: `依赖安装过程出错: ${error.message}`
        });
      });
  }
  
  // 检测可用的Python命令
  _detectPythonCommand() {
    return new Promise((resolve, reject) => {
      // 尝试的Python命令列表
      const pythonCommands = ['python', 'python3', 'py'];
      let currentIndex = 0;
      
      const tryNextCommand = () => {
        if (currentIndex >= pythonCommands.length) {
          reject(new Error('未找到可用的Python命令'));
          return;
        }
        
        const cmd = pythonCommands[currentIndex];
        console.log(`尝试检测${cmd}命令...`);
        
        const checkProcess = spawn(cmd, ['--version']);
        let output = '';
        
        checkProcess.stdout.on('data', (data) => {
          try {
            const text = Buffer.from(data).toString('utf8');
            output += text;
          } catch (e) {
            console.error('解析Python版本stdout数据失败:', e);
            output += data.toString();
          }
        });
        
        checkProcess.stderr.on('data', (data) => {
          try {
            const text = Buffer.from(data).toString('utf8');
            output += text; // 某些Python版本将版本信息输出到stderr
          } catch (e) {
            console.error('解析Python版本stderr数据失败:', e);
            output += data.toString();
          }
        });
        
        checkProcess.on('close', (code) => {
          if (code === 0 && output.includes('Python')) {
            console.log(`找到可用的Python命令: ${cmd}, 版本: ${output.trim()}`);
            resolve(cmd);
          } else {
            console.log(`${cmd}commond can't use，try next commond...`);
            currentIndex++;
            tryNextCommand();
          }
        });
        
        checkProcess.on('error', () => {
          console.log(`${cmd}commond can't use，try next commond...`);
          currentIndex++;
          tryNextCommand();
        });
      };
      
      tryNextCommand();
    });
  }
  
  // 使用Python批量安装依赖
  _installDependenciesWithPython(pythonCmd, dependencies, updateProgress) {
    return new Promise((resolve, reject) => {
      try {
        if (!dependencies || dependencies.length === 0) {
          console.log('没有依赖需要安装');
          resolve([]);
          return;
        }
        
        console.log(`开始批量安装 ${dependencies.length} 个依赖...`);
        const results = [];
      let currentIndex = 0;
      
        // 为整个安装过程设置一个超时定时器（15分钟）
        const installTimeout = setTimeout(() => {
          console.error('依赖安装过程超时，可能已卡住');
          
          // 更新下载进度为错误
          this.downloadProgress = {
            stage: 'error',
            currentModelName: '依赖安装超时，请重试',
            percentage: 0
          };
            this.emit('download-progress', this.downloadProgress);
          
          // 收集已安装结果
          for (let i = currentIndex; i < dependencies.length; i++) {
            results.push({
              name: dependencies[i].name,
              success: false,
              message: '安装超时'
            });
          }
          
          // 解析当前结果
          resolve(results);
        }, 15 * 60 * 1000); // 15分钟超时
        
        const installNextDependency = () => {
          if (currentIndex >= dependencies.length) {
            // 安装完所有依赖，清除超时
            clearTimeout(installTimeout);
            resolve(results);
          return;
        }
        
        const dependency = dependencies[currentIndex];
          console.log(`开始安装依赖 (${currentIndex + 1}/${dependencies.length}): ${dependency.name}`);
          
          // 更新进度
          updateProgress(currentIndex, 0);
          
          // 设置单个依赖安装的超时（5分钟）
          const singleDependencyTimeout = setTimeout(() => {
            console.error(`依赖 ${dependency.name} 安装超时`);
            
            // 记录失败结果
            results.push({
              name: dependency.name,
              success: false,
              message: '安装超时'
            });
            
            // 更新进度到100%但标记为失败
            updateProgress(currentIndex, 100);
            
            // 继续安装下一个依赖
            currentIndex++;
            installNextDependency();
          }, 5 * 60 * 1000); // 5分钟超时
          
          // 安装当前依赖
          this._installPackage(pythonCmd, dependency.name, dependency.retries)
            .then(result => {
              // 清除单个依赖安装超时
              clearTimeout(singleDependencyTimeout);
              
              console.log(`依赖 ${dependency.name} 安装${result.success ? '成功' : '失败'}`);
              
              // 记录结果
              results.push({
                name: dependency.name,
                success: result.success,
                message: result.message
              });
              
              // 更新进度到100%
              updateProgress(currentIndex, 100);
              
              // 继续安装下一个依赖
            currentIndex++;
            installNextDependency();
          })
          .catch(error => {
              // 清除单个依赖安装超时
              clearTimeout(singleDependencyTimeout);
              
              console.error(`依赖 ${dependency.name} 安装失败:`, error);
              
              // 记录失败结果
              results.push({
                name: dependency.name,
                success: false,
                message: error.message
              });
              
              // 更新进度到100%但标记为失败
              updateProgress(currentIndex, 100);
              
              // 继续安装下一个依赖
              currentIndex++;
              installNextDependency();
          });
      };
      
        // 开始安装第一个依赖
      installNextDependency();
        
      } catch (error) {
        console.error('批量安装依赖时出错:', error);
        reject(error);
      }
    });
  }
  
  // 安装单个包
  _installPackage(pythonCmd, packageName, retries = 3) {
    return new Promise((resolve, reject) => {
      console.log(`开始安装包: ${packageName}, 最大重试次数: ${retries}`);
      
      let attempt = 0;
      
      // 重试安装函数
      const tryInstall = () => {
        attempt++;
        console.log(`安装尝试 ${attempt}/${retries}: ${packageName}`);
        
        // 构建pip安装命令
        const pipArgs = ['-m', 'pip', 'install', packageName, '--upgrade'];
        
        // 添加不使用缓存的选项，避免使用损坏的缓存
        if (attempt > 1) {
          pipArgs.push('--no-cache-dir');
        }
        
        // 添加超时选项，避免永久卡住
        pipArgs.push('--timeout', '180');
        
        // 如果是最后一次尝试，增加详细输出
        if (attempt === retries) {
          pipArgs.push('-v');
        }
        
        console.log(`执行命令: ${pythonCmd} ${pipArgs.join(' ')}`);
        
        // 设置安装超时（3分钟）
        const installTimeout = setTimeout(() => {
          console.error(`安装包 ${packageName} 超时`);
          
          // 尝试终止安装进程
          if (installProcess && !installProcess.killed) {
            try {
              installProcess.kill();
              console.log(`已终止卡住的安装进程: ${packageName}`);
            } catch (err) {
              console.error(`终止安装进程失败: ${packageName}`, err);
            }
          }
          
          // 检查是否还有重试机会
          if (attempt < retries) {
            console.log(`将在2秒后重试安装 ${packageName} (${attempt}/${retries})`);
            // 等待2秒后重试
            setTimeout(tryInstall, 2000);
          } else {
            // 重试次数用完，安装失败
            resolve({
              success: false,
              packageName,
              message: `安装超时: ${packageName}`
            });
          }
        }, 3 * 60 * 1000); // 3分钟超时
        
        // 执行pip安装
        const installProcess = spawn(pythonCmd, pipArgs);
        
        let stdoutData = '';
        let stderrData = '';
        
        // 获取标准输出
        installProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdoutData += output;
          console.log(`安装输出 (${packageName}): ${output.trim()}`);
        });
        
        // 获取错误输出
        installProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderrData += output;
          console.error(`安装错误 (${packageName}): ${output.trim()}`);
        });
        
        // 处理进程结束
        installProcess.on('close', (code) => {
          // 清除超时
          clearTimeout(installTimeout);
          
          console.log(`安装进程结束 (${packageName}), 退出码: ${code}`);
          
          if (code === 0) {
            // 安装成功
            resolve({
              success: true,
              packageName,
              message: `安装成功: ${packageName}`
            });
          } else {
            // 安装失败
            console.error(`安装失败 (${packageName}), 退出码: ${code}`);
            console.error(`错误信息: ${stderrData.trim() || '无错误信息'}`);
            
            // 检查是否还有重试机会
            if (attempt < retries) {
              console.log(`将在2秒后重试安装 ${packageName} (${attempt}/${retries})`);
              // 等待2秒后重试
              setTimeout(tryInstall, 2000);
            } else {
              // 重试次数用完，安装失败
              resolve({
                success: false,
                packageName,
                message: `安装失败: ${packageName}, 错误: ${stderrData.trim() || `退出码 ${code}`}`
              });
            }
          }
        });
        
        // 处理进程错误
        installProcess.on('error', (error) => {
          // 清除超时
          clearTimeout(installTimeout);
          
          console.error(`启动安装进程时出错 (${packageName}): ${error.message}`);
          
          // 检查是否还有重试机会
          if (attempt < retries) {
            console.log(`将在2秒后重试安装 ${packageName} (${attempt}/${retries})`);
            // 等待2秒后重试
            setTimeout(tryInstall, 2000);
          } else {
            // 重试次数用完，安装失败
            resolve({
              success: false,
              packageName,
              message: `安装失败: ${packageName}, 错误: ${error.message}`
            });
          }
        });
      };
      
      // 开始首次尝试安装
      tryInstall();
    });
  }
  
  // 下载翻译模型
  downloadModel() {
    if (this.isDownloading) {
      console.log('已有下载任务正在进行中，跳过');
      return;
    }
    
    console.log('准备下载翻译模型...');
    this.isDownloading = true;
    this.downloadProgress = {
      stage: 'preparing',
      currentModelName: '准备下载',
      percentage: 0
    };
    
    // 发射下载进度事件
    this.emit('download-progress', this.downloadProgress);
    
    // 确保模型目录存在
    this._ensureModelDir();
    
    // 首先检查Python依赖，然后再下载模型
    console.log('先检查Python依赖，再下载模型');
    this._checkPythonDependencies()
      .then(dependencyStatus => {
        console.log('依赖检查结果:', dependencyStatus);
        
        // 更新下载进度为检查依赖
        this.downloadProgress = {
          stage: 'dependencies',
          currentModelName: '检查Python依赖',
          percentage: 10
        };
        this.emit('download-progress', this.downloadProgress);
        
        // 如果有缺失的依赖，先安装它们
        if (dependencyStatus.missingDependencies && dependencyStatus.missingDependencies.length > 0) {
          console.log('检测到缺失的依赖，开始安装:', dependencyStatus.missingDependencies);
          
          // 更新下载进度为安装依赖
          this.downloadProgress = {
            stage: 'dependencies',
            currentModelName: '安装Python依赖',
            percentage: 15
          };
          this.emit('download-progress', this.downloadProgress);
          
          return this._installPythonDependencies(dependencyStatus);
          } else {
          console.log('所有依赖已安装，继续下载模型');
          
          // 更新下载进度为依赖已安装
          this.downloadProgress = {
            stage: 'dependencies',
            currentModelName: '所有依赖已安装',
            percentage: 20
          };
          this.emit('download-progress', this.downloadProgress);
          
          return { success: true, pythonCmd: dependencyStatus.pythonCmd };
        }
      })
      .then(installResult => {
        // 检查依赖安装结果
        if (!installResult || !installResult.success) {
          console.error('依赖安装失败:', installResult ? installResult.message : '未知错误');
          
          // 更新下载进度为依赖安装失败
          this.downloadProgress = {
              stage: 'error',
            currentModelName: `依赖安装失败: ${installResult ? installResult.message : '未知错误'}`,
              percentage: 0
          };
          this.emit('download-progress', this.downloadProgress);
          
          // 抛出错误，阻止下载流程继续进行
          throw new Error(`依赖安装失败: ${installResult ? installResult.message : '未知错误'}`);
        }
        
        // 依赖安装成功，继续流程
        console.log('依赖安装成功，继续模型下载流程');
        
        // 检测Python命令
        return this._detectPythonCommand();
      })
      .then(pythonCmd => {
          if (!pythonCmd) {
          throw new Error('无法找到Python环境，请确保已安装Python 3.6+');
          }
          
          console.log(`使用Python命令: ${pythonCmd}`);
          
        // 更新下载进度为开始下载模型
        this.downloadProgress = {
          stage: 'downloading',
          currentModelName: '开始下载模型',
          percentage: 25
        };
        this.emit('download-progress', this.downloadProgress);
        
        // 尝试使用Python脚本下载模型
        return this._downloadModelFiles(pythonCmd);
      })
      .then(success => {
        if (success) {
          console.log('模型下载成功!');
          this.isModelReady = true;
          
          // 更新下载进度为完成
          this.downloadProgress = {
            stage: 'completed',
            currentModelName: '下载完成',
            percentage: 100
          };
          
          // 发射下载进度事件
          this.emit('download-progress', this.downloadProgress);
        } else {
          console.error('模型下载失败!');
          
          // 尝试使用备用方法下载
          console.log('尝试使用备用方法下载...');
          return this._tryDirectFallbackDownload();
        }
      })
      .catch(error => {
        console.error('模型下载过程中出错:', error);
        
        // 更新下载进度为错误
        this.downloadProgress = {
              stage: 'error',
          currentModelName: `下载失败: ${error.message}`,
              percentage: 0
        };
        
        // 发射下载进度事件
        this.emit('download-progress', this.downloadProgress);
      })
      .finally(() => {
        this.isDownloading = false;
      });
  }
  
  // 下载模型文件
  _downloadModelFiles(pythonCmd) {
    return new Promise((resolve, reject) => {
      try {
        console.log('开始下载模型文件...');
        
        // 更新下载进度
        this.downloadProgress = {
          stage: 'downloading',
          currentModelName: '初始化下载',
          percentage: 5
        };
        this.emit('download-progress', this.downloadProgress);
        
        // 确保下载脚本存在
        if (!fs.existsSync(this.downloadScriptPath)) {
          console.error(`下载脚本不存在: ${this.downloadScriptPath}`);
          reject(new Error('下载脚本不存在'));
          return;
        }
        
        // 构建脚本参数
        const scriptArgs = [
          this.downloadScriptPath,
          this.modelDir,
          this.modelName,
          this.reverseModelName
        ];
        
        console.log(`执行下载命令: ${pythonCmd} ${scriptArgs.join(' ')}`);
        
        // 设置下载超时（30分钟）
        const downloadTimeout = setTimeout(() => {
          console.error('下载超时，可能已经卡住');
          
          // 更新下载进度为错误
          this.downloadProgress = {
            stage: 'error',
            currentModelName: '下载超时，正在尝试备用方法...',
            percentage: 0
          };
          this.emit('download-progress', this.downloadProgress);
          
          // 尝试终止下载进程
          if (downloadProcess && !downloadProcess.killed) {
            try {
              downloadProcess.kill();
              console.log('已终止卡住的下载进程');
            } catch (err) {
              console.error('终止下载进程失败:', err);
            }
          }
          
          // 主动尝试备用下载方法
          console.log('主动切换到备用下载方法...');
          this._tryDirectFallbackDownload()
            .then(success => {
              resolve(success);
            })
            .catch(error => {
              console.error('备用下载也失败了:', error);
              resolve(false);
            });
        }, 10 * 60 * 1000); // 10分钟超时，如果10分钟内未完成则尝试备用方法
        
        // 设置进度监控计时器
          let lastProgressTime = Date.now();
        let lastProgressPercentage = 0;
        
        const progressMonitor = setInterval(() => {
          const currentTime = Date.now();
          const elapsedSinceLastProgress = (currentTime - lastProgressTime) / 1000; // 秒
          
          // 如果超过5分钟没有进度更新，主动切换到备用方法
          if (elapsedSinceLastProgress > 300 && this.downloadProgress.percentage > 0) {
            console.warn(`下载可能已卡住，${Math.round(elapsedSinceLastProgress)}秒没有进度更新`);
            
            // 如果5分钟内没有进度更新，尝试终止当前下载并使用备用方法
            console.error('下载卡住超过5分钟，切换到备用方法');
            
            // 更新下载进度
            this.downloadProgress = {
              stage: 'error',
              currentModelName: '下载卡住，正在尝试备用方法...',
              percentage: 0
            };
            this.emit('download-progress', this.downloadProgress);
            
            // 清除超时计时器
            clearTimeout(downloadTimeout);
            clearInterval(progressMonitor);
            
            // 尝试终止下载进程
            if (downloadProcess && !downloadProcess.killed) {
              try {
                downloadProcess.kill();
                console.log('已终止卡住的下载进程');
              } catch (err) {
                console.error('终止下载进程失败:', err);
              }
            }
            
            // 尝试备用下载方法
            console.log('主动切换到备用下载方法...');
            this._tryDirectFallbackDownload()
              .then(success => {
                resolve(success);
              })
              .catch(error => {
                console.error('备用下载也失败了:', error);
                resolve(false);
              });
          }
        }, 60 * 1000); // 每分钟检查一次
        
        // 启动下载进程
        const downloadProcess = spawn(pythonCmd, scriptArgs, {
          // 设置更大的缓冲区，防止输出数据丢失
          maxBuffer: 10 * 1024 * 1024, // 10MB
          // 确保输出为UTF-8编码
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        
        let stdoutData = '';
        let stderrData = '';
        
        // 获取标准输出
        downloadProcess.stdout.on('data', (data) => {
          const text = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
          stdoutData += text;
              
              // 尝试解析JSON进度信息
              try {
            // 分割输出，处理可能的多行JSON
            const lines = text.split('\n');
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              
              // 尝试查找JSON对象
              if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                try {
                  const jsonData = JSON.parse(trimmedLine);
                  
                  // 检查是否是进度信息
                  if (jsonData && (jsonData.stage || jsonData.percentage !== undefined || jsonData.model)) {
                    // 创建标准化的进度对象
                    const stage = jsonData.stage || 'downloading';
                    const modelName = jsonData.model || ''; 
                    const percentage = jsonData.percentage !== undefined ? jsonData.percentage : 30;
                    const message = jsonData.message || '';
                    
                    // 根据阶段处理进度
                    let displayName = '';
                    let displayPercentage = percentage;
                    
                    switch(stage) {
                      case 'preparing':
                        displayName = '准备下载' + (message ? ': ' + message : '');
                        displayPercentage = Math.max(5, Math.min(15, percentage));
                        break;
                      case 'downloading':
                        displayName = '下载模型文件' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(20, Math.min(50, percentage));
                        break;
                      case 'tokenizer':
                        displayName = '下载分词器' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(30, Math.min(60, percentage));
                        break;
                      case 'model':
                        displayName = '下载模型权重' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(60, Math.min(90, percentage));
                        break;
                      case 'verifying':
                        displayName = '验证模型文件' + (modelName ? ': ' + modelName : '');
                        displayPercentage = Math.max(90, Math.min(99, percentage));
                        break;
                      case 'completed':
                        // 只有在全部完成时才显示100%，避免提前显示完成
                        if (message && message.includes("两个模型都下载成功")) {
                          displayName = '下载完成: ' + (message || '模型已下载成功');
                          displayPercentage = 100;
                        } else {
                          // 部分完成时不要显示为100%
                          displayName = '模型部分完成: ' + (message || '继续下载中');
                          displayPercentage = 95; 
                        }
                        break;
                      case 'error':
                        displayName = '下载出错: ' + (message || '未知错误');
                        displayPercentage = 0;
                        break;
                      default:
                        displayName = '模型处理中';
                        break;
                    }
                    
                    // 保存当前阶段用于后续判断
                    this._currentDownloadStage = stage;
                    
                    // 创建干净的进度对象
                    const progress = {
                      stage: stage,
                      currentModelName: displayName,
                      percentage: displayPercentage
                    };
                    
                    // 更新最后进度时间和百分比
                    lastProgressTime = Date.now();
                    lastProgressPercentage = displayPercentage;
                    
                    // 保存进度以便其他地方引用
                    this.downloadProgress = progress;
                    
                    // 发射进度事件
                    this.emit('download-progress', progress);
                  }
                } catch (jsonError) {
                  // JSON解析失败，记录错误并继续
                  console.log(`JSON解析失败: ${trimmedLine}`, jsonError);
                }
              }
            }
          } catch (e) {
            console.log('处理Python输出时出错:', e);
          }
          
          console.log(`Python输出: ${text}`);
        });
        
        // 获取错误输出
        downloadProcess.stderr.on('data', (data) => {
          const output = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
          stderrData += output;
          console.error(`下载错误: ${output}`);
        });
        
        // 处理进程结束
        downloadProcess.on('close', (code) => {
          console.log(`下载进程结束，退出码: ${code}`);
          
          // 清除超时和监控计时器
          clearTimeout(downloadTimeout);
          clearInterval(progressMonitor);
            
        if (code === 0) {
            // 下载脚本执行成功
            console.log('下载脚本执行成功');
            
            // 检查模型文件是否存在
            this._checkModelExists().then(exists => {
              if (exists) {
                // 模型文件下载成功
                console.log('模型文件验证成功');
                    this.isModelReady = true;
                    
                // 更新下载进度为完成
                this.downloadProgress = {
                stage: 'completed',
                  currentModelName: '下载完成',
                percentage: 100
                };
                this.emit('download-progress', this.downloadProgress);
                    
                    resolve(true);
        } else {
                // 模型文件不完整
                console.error('模型文件不完整，下载可能失败');
                
                // 分析脚本输出，查找具体错误
                this.downloadProgress = {
                      stage: 'error',
                  currentModelName: '模型文件不完整，请重试',
                      percentage: 0
                };
                this.emit('download-progress', this.downloadProgress);
                
                resolve(false);
              }
            });
            } else {
            // 下载失败
            console.error(`下载脚本执行失败，退出码: ${code}`);
            console.error(`错误输出: ${stderrData}`);
            
            // 尝试解析错误信息
            let errorMessage = '下载失败';
            if (stderrData.includes('Connection refused') || stderrData.includes('Failed to establish a new connection')) {
              errorMessage = '网络连接失败，请检查网络';
            } else if (stderrData.includes('TimeoutError')) {
              errorMessage = '下载超时，请重试';
            } else if (stderrData.includes('MemoryError')) {
              errorMessage = '内存不足，无法下载';
            } else if (stderrData.includes('Permission')) {
              errorMessage = '权限错误，无法写入文件';
            }
            
            // 更新下载进度为错误
            this.downloadProgress = {
                    stage: 'error',
              currentModelName: `${errorMessage}，退出码: ${code}`,
                    percentage: 0
            };
            this.emit('download-progress', this.downloadProgress);
            
            resolve(false);
            }
          });
          
          // 处理进程错误
        downloadProcess.on('error', (error) => {
          console.error(`启动下载进程时出错: ${error.message}`);
          
          // 清除超时和监控计时器
          clearTimeout(downloadTimeout);
          clearInterval(progressMonitor);
          
          // 更新下载进度为错误
          this.downloadProgress = {
                stage: 'error',
            currentModelName: `下载失败: ${error.message}`,
                percentage: 0
          };
          this.emit('download-progress', this.downloadProgress);
            
          reject(error);
          });
        
      } catch (error) {
        console.error('下载模型文件时出错:', error);
        
        // 更新下载进度为错误
        this.downloadProgress = {
          stage: 'error',
          currentModelName: `下载失败: ${error.message}`,
          percentage: 0
        };
        this.emit('download-progress', this.downloadProgress);
        
        reject(error);
      }
    });
  }
  
  // 解析下载进度信息
  _parseDownloadProgress(progressData) {
    try {
      // 解析进度数据
      let progress = {};
      
      if (typeof progressData === 'string') {
        try {
          progressData = JSON.parse(progressData);
        } catch (e) {
          console.log('进度数据无法解析为JSON:', progressData);
          return null;
        }
      }
      
      // 设置默认值
      progress = {
        stage: 'checking',
        currentModelName: '准备中',
        percentage: 0
      };
      
      // 从数据中提取信息
      if (progressData) {
        // 保存原始对象以便调试
        const rawData = { ...progressData };
        
        // 阶段信息
        if (progressData.stage) {
          progress.stage = progressData.stage;
        }
        
        // 处理模型名称 - 直接使用可读的中文状态描述
        if (progressData.model) {
          // 如果收到的模型名称包含乱码标记，则使用阶段的中文描述
          if (progressData.model.includes('') || !progressData.model.trim()) {
            switch(progress.stage) {
              case 'preparing': progress.currentModelName = '准备下载'; break;
              case 'downloading': progress.currentModelName = '下载模型中'; break;
              case 'tokenizer': progress.currentModelName = '下载分词器'; break;
              case 'model': progress.currentModelName = '下载模型权重'; break;
              case 'verifying': progress.currentModelName = '验证模型文件'; break;
              case 'completed': progress.currentModelName = '下载完成'; break;
              case 'error': progress.currentModelName = '下载出错'; break;
              case 'dependencies': progress.currentModelName = '安装依赖中'; break;
              default: progress.currentModelName = '下载中';
            }
          } else {
            // 使用收到的模型名称
            progress.currentModelName = progressData.model;
          }
        }
        
        // 使用消息替换模型名称，如果消息不包含乱码
        if (progressData.message && !progressData.message.includes('') && progressData.message.trim()) {
          // 如果消息更详细，优先使用消息
          if (progress.stage === 'error') {
            // 错误信息始终显示
            progress.currentModelName = progressData.message;
          } else if (progressData.message.length > 0) {
            // 正常消息 - 清理并显示
            let cleanMessage = progressData.message;
            
            // 确保消息是UTF-8编码的中文
            try {
              cleanMessage = decodeURIComponent(escape(cleanMessage));
            } catch (e) {
              // 如果解码失败，使用原始消息
            }
            
            progress.currentModelName = cleanMessage;
          }
        }
        
        // 百分比信息
        if (typeof progressData.percentage === 'number') {
          progress.percentage = progressData.percentage;
        }
        
        // 处理特定阶段的显示
        if (progress.stage === 'preparing') {
          // 准备阶段百分比通常为5-15
          if (progress.percentage < 5) progress.percentage = 5;
        } else if (progress.stage === 'downloading') {
          // 确保下载阶段百分比至少为20
          if (progress.percentage < 20) progress.percentage = 20;
        } else if (progress.stage === 'tokenizer') {
          // 分词器阶段百分比
          if (progress.percentage < 30) progress.percentage = 30;
          if (progress.percentage > 60) progress.percentage = 60;
        } else if (progress.stage === 'model') {
          // 确保模型下载阶段百分比范围为60-90
          if (progress.percentage < 60) progress.percentage = 60;
          if (progress.percentage > 90) progress.percentage = 90;
        } else if (progress.stage === 'verifying') {
          // 验证阶段百分比始终为90-99
          if (progress.percentage < 90) progress.percentage = 90;
          if (progress.percentage > 99) progress.percentage = 99;
        } else if (progress.stage === 'completed') {
          progress.percentage = 100;
        } else if (progress.stage === 'error') {
          progress.percentage = 0;
        }
        
        // 确保百分比在0-100之间
        if (progress.percentage > 100) progress.percentage = 100;
        if (progress.percentage < 0) progress.percentage = 0;
        
        // 打印收到的进度信息用于调试
        console.log('解析进度信息:', {
          原始数据: rawData,
          处理后: progress
        });
      }
      
      // 如果当前任务名称包含乱码标记，使用阶段名称
      if (progress.currentModelName.includes('') || !progress.currentModelName.trim()) {
        switch(progress.stage) {
          case 'preparing': progress.currentModelName = '准备下载中'; break;
          case 'downloading': progress.currentModelName = '模型下载中'; break;
          case 'tokenizer': progress.currentModelName = '下载分词器'; break;
          case 'model': progress.currentModelName = '下载模型权重'; break;
          case 'verifying': progress.currentModelName = '验证模型中'; break;
          case 'completed': progress.currentModelName = '下载已完成'; break;
          case 'error': progress.currentModelName = '下载出错'; break;
          case 'dependencies': progress.currentModelName = '安装依赖中'; break;
          default: progress.currentModelName = '处理中';
        }
      }
      
      return progress;
      } catch (error) {
      console.error('解析下载进度出错:', error);
      return {
        stage: 'error',
        currentModelName: '解析进度信息出错',
        percentage: 0
      };
    }
  }
  
  // 尝试从备用源直接下载模型
  downloadModelFromAlternativeSource() {
    if (this.isDownloading) {
      console.log('已有下载任务正在进行中，跳过');
      return;
    }
    
    console.log('准备从备用源下载翻译模型...');
    this.isDownloading = true;
    this.downloadProgress = {
      stage: 'preparing',
      currentModelName: '准备从备用源下载',
      percentage: 0
    };
    
    // 发射下载进度事件
    this.emit('download-progress', this.downloadProgress);
    
    // 确保模型目录存在
    this._ensureModelDir();
    
    // 执行备用下载
    this._tryDirectFallbackDownload()
      .then(success => {
        if (success) {
          console.log('从备用源下载模型成功!');
          this.isModelReady = true;
          
          // 更新下载进度为完成
          this.downloadProgress = {
            stage: 'completed',
            currentModelName: '备用源下载完成',
            percentage: 100
          };
          
          // 发射下载进度事件
          this.emit('download-progress', this.downloadProgress);
          
          // 广播模型状态更新
          const modelStatus = this.getModelStatus();
          this.emit('model-status-update', modelStatus);
        } else {
          console.error('从备用源下载模型失败!');
          
          // 更新下载进度为错误
          this.downloadProgress = {
            stage: 'error',
            currentModelName: '备用源下载失败',
            percentage: 0
          };
          
          // 发射下载进度事件
          this.emit('download-progress', this.downloadProgress);
        }
      })
      .catch(error => {
        console.error('备用源下载过程中出错:', error);
        
        // 更新下载进度为错误
        this.downloadProgress = {
          stage: 'error',
          currentModelName: `备用源下载失败: ${error.message}`,
          percentage: 0
        };
        
        // 发射下载进度事件
        this.emit('download-progress', this.downloadProgress);
      })
      .finally(() => {
        this.isDownloading = false;
      });
  }
}

module.exports = new TranslationService();