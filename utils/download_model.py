# Download and save translation models
import os
import sys
import json
import time
import shutil
import requests
import tempfile
from pathlib import Path
import logging

# 配置日志记录
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    encoding='utf-8'
)
logger = logging.getLogger('model_downloader')

# 确保当前工作目录的编码设置
if sys.platform == 'win32':
    try:
        import locale
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except:
        pass

# Try to import transformers, but don't fail if not available
try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    TRANSFORMERS_AVAILABLE = True
    logger.info("成功导入transformers和torch")
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("找不到transformers或torch库，将使用直接下载方式")

def report_progress(stage, model_name, percentage, message=""):
    """向主进程报告下载进度"""
    progress_info = {
        "stage": stage,
        "model": model_name,
        "percentage": percentage,
        "message": message
    }
    # 确保中文字符正确输出
    progress_json = json.dumps(progress_info, ensure_ascii=False)
    print(progress_json, flush=True)
    logger.info(f"进度更新: {stage} - {model_name} - {percentage}% - {message}")
    # 添加短暂延迟确保输出被处理
    time.sleep(0.1)

def download_file(url, destination_path, model_name, file_desc="文件"):
    """下载文件并报告进度"""
    try:
        logger.info(f"开始下载{file_desc}: {url}")
        
        # 创建目录
        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        # 发送请求
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # 获取文件总大小
        total_size = int(response.headers.get('content-length', 0))
        
        if total_size == 0:
            logger.warning(f"警告: {url} 没有返回content-length")
            # 尝试HEAD请求获取大小
            head_response = requests.head(url)
            total_size = int(head_response.headers.get('content-length', 0))
        
        logger.info(f"文件大小: {total_size} 字节 ({total_size/1024/1024:.2f} MB)")
        
        # 报告开始下载
        report_progress("downloading", model_name, 0, f"开始下载{file_desc}")
        
        # 下载到临时文件
        downloaded_size = 0
        chunk_size = 8192
        last_report_time = time.time()
        last_percentage = 0
        
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_path = temp_file.name
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    temp_file.write(chunk)
                    downloaded_size += len(chunk)
                    
                    # 计算进度百分比
                    if total_size > 0:
                        percentage = int((downloaded_size / total_size) * 100)
                        current_time = time.time()
                        
                        # 每秒最多报告一次进度，或者进度变化超过5%
                        if (current_time - last_report_time >= 1.0 or 
                            (percentage - last_percentage >= 5 and current_time - last_report_time >= 0.5)):
                            message = f"下载进度: {downloaded_size}/{total_size} 字节"
                            report_progress("downloading", model_name, percentage, message)
                            last_report_time = current_time
                            last_percentage = percentage
        
        # 下载完成，移动到目标位置
        logger.info(f"下载完成，将临时文件移动到: {destination_path}")
        
        # 确保目标目录存在
        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        # 如果目标文件已存在，先备份
        if os.path.exists(destination_path):
            backup_path = f"{destination_path}.bak"
            logger.info(f"目标文件已存在，备份到: {backup_path}")
            shutil.move(destination_path, backup_path)
        
        # 移动临时文件到目标位置
        shutil.move(temp_path, destination_path)
        
        # 验证文件大小
        if os.path.exists(destination_path):
            actual_size = os.path.getsize(destination_path)
            logger.info(f"验证文件大小: 预期 {total_size} 字节, 实际 {actual_size} 字节")
            
            if actual_size > 0 and (total_size == 0 or abs(actual_size - total_size) < 1024):  # 允许1KB的误差
                logger.info(f"{file_desc}下载成功!")
                report_progress("downloading", model_name, 100, f"{file_desc}下载完成")
                return True
            else:
                logger.error(f"文件大小不匹配! 预期: {total_size}, 实际: {actual_size}")
                # 如果文件存在但大小不对，删除它
                os.unlink(destination_path)
                report_progress("error", model_name, 0, f"{file_desc}下载失败: 文件大小不匹配")
                return False
        else:
            logger.error(f"移动后目标文件不存在: {destination_path}")
            report_progress("error", model_name, 0, f"{file_desc}下载失败: 文件保存失败")
            return False
            
    except Exception as e:
        logger.error(f"下载{file_desc}时出错: {str(e)}")
        report_progress("error", model_name, 0, f"{file_desc}下载失败: {str(e)}")
        
        # 清理临时文件
        if 'temp_path' in locals() and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
                
        return False

def verify_model(model_path, model_name):
    """验证模型文件是否完整可用"""
    try:
        logger.info(f"验证模型: {model_name} 位于 {model_path}")
        report_progress("verifying", model_name, 90, "开始验证模型文件")
        
        # 检查目录是否存在
        if not os.path.exists(model_path):
            logger.error(f"模型目录不存在: {model_path}")
            report_progress("error", model_name, 0, "模型目录不存在")
            return False
            
        # 检查必需文件
        required_files = [
            'config.json',
            'special_tokens_map.json',
            'tokenizer_config.json',
            'vocab.json'
        ]
        
        # 至少需要一个模型权重文件
        weight_files = [
            'pytorch_model.bin',
            'model.safetensors'
        ]
        
        # 检查必需文件
        for required_file in required_files:
            file_path = os.path.join(model_path, required_file)
            if not os.path.exists(file_path):
                logger.error(f"缺少必需文件: {required_file}")
                report_progress("error", model_name, 0, f"模型验证失败: 缺少{required_file}")
                return False
                
        # 检查模型权重文件
        has_weights = False
        for weight_file in weight_files:
            weight_path = os.path.join(model_path, weight_file)
            if os.path.exists(weight_path):
                file_size = os.path.getsize(weight_path)
                logger.info(f"找到模型权重文件: {weight_file}, 大小: {file_size/1024/1024:.2f} MB")
                
                # 检查文件大小是否合理 (至少100MB)
                if file_size < 100 * 1024 * 1024:
                    logger.warning(f"模型权重文件过小: {weight_file} ({file_size/1024/1024:.2f} MB)")
                    continue
                    
                has_weights = True
                break
                
        if not has_weights:
            logger.error("未找到有效的模型权重文件")
            report_progress("error", model_name, 0, "模型验证失败: 未找到有效的模型权重文件")
            return False
            
        # 列出模型目录中的所有文件
        files = os.listdir(model_path)
        total_size = 0
        file_count = 0
        
        logger.info(f"模型目录内容:")
        for file in files:
            file_path = os.path.join(model_path, file)
            if os.path.isfile(file_path):
                file_size = os.path.getsize(file_path)
                total_size += file_size
                file_count += 1
                logger.info(f"  - {file}: {file_size/1024/1024:.2f} MB")
                
        logger.info(f"模型总大小: {total_size/1024/1024:.2f} MB, 文件数: {file_count}")
        
        # 如果支持transformers库，尝试加载模型
        if TRANSFORMERS_AVAILABLE:
            try:
                logger.info("使用transformers库加载模型进行深度验证")
                report_progress("verifying", model_name, 95, "加载模型验证")
                
                # 尝试加载tokenizer
                tokenizer = AutoTokenizer.from_pretrained(model_path)
                logger.info("成功加载tokenizer")
                
                # 尝试加载模型
                model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
                logger.info("成功加载模型")
                
                logger.info("验证通过: 模型可以被transformers库正确加载")
                report_progress("verifying", model_name, 100, "模型验证成功")
                return True
            except Exception as e:
                logger.error(f"使用transformers库验证模型时出错: {str(e)}")
                # 继续使用文件验证方法
        
        # 如果文件大小合理且所有必需文件都存在，认为验证通过
        if total_size > 200 * 1024 * 1024 and file_count >= 5:  # 至少200MB，且至少5个文件
            logger.info("验证通过: 文件大小和数量合理")
            report_progress("verifying", model_name, 100, "模型验证成功")
            return True
        else:
            logger.warning(f"模型文件可能不完整: 大小 {total_size/1024/1024:.2f} MB, 文件数 {file_count}")
            if total_size > 100 * 1024 * 1024:  # 如果总大小超过100MB，可能仍然可用
                logger.info("尽管有警告，但文件大小超过100MB，可能仍能使用")
                report_progress("verifying", model_name, 100, "模型验证成功但有警告")
                return True
            else:
                report_progress("error", model_name, 0, "模型验证失败: 文件大小不足")
                return False
                
    except Exception as e:
        logger.error(f"验证模型时出错: {str(e)}")
        report_progress("error", model_name, 0, f"模型验证失败: {str(e)}")
        return False

def get_model_files_info(model_name):
    """获取模型文件信息"""
    try:
        logger.info(f"获取模型文件信息: {model_name}")
        report_progress("preparing", model_name, 5, "获取模型信息")
        
        api_url = f"https://huggingface.co/api/models/{model_name}"
        response = requests.get(api_url)
        response.raise_for_status()
        
        data = response.json()
        if 'siblings' not in data:
            logger.error(f"API返回数据中没有找到'siblings'字段: {data}")
            return []
            
        files = []
        for item in data['siblings']:
            if 'rfilename' in item and 'size' in item:
                files.append({
                    'name': item['rfilename'],
                    'size': item['size']
                })
                
        logger.info(f"找到{len(files)}个文件")
        return files
    except Exception as e:
        logger.error(f"获取模型文件信息时出错: {str(e)}")
        return []

def download_model_direct(model_dir, model_name):
    """直接从Hugging Face下载模型文件"""
    try:
        logger.info(f"开始下载模型: {model_name}")
        
        # 替换路径分隔符
        safe_model_name = model_name.replace('/', os.path.sep)
        model_path = os.path.join(model_dir, safe_model_name)
        
        logger.warning(f"模型目录将为: {model_path}")
        
        # 确保模型目录存在
        os.makedirs(model_path, exist_ok=True)
        
        # 获取模型文件信息
        files = get_model_files_info(model_name)
        
        if not files:
            logger.error(f"无法获取模型{model_name}的文件列表")
            report_progress("error", model_name, 0, f"无法获取文件列表")
            return False
            
        # 过滤掉不需要的文件
        important_files = []
        optional_files = []
        
        for file in files:
            name = file['name']
            # 跳过目录和隐藏文件
            if name.endswith('/') or name.startswith('.'):
                continue
                
            # 根据文件名和大小判断重要性
            if ('config.json' in name or 
                'tokenizer' in name or 
                'vocab.json' in name or 
                'pytorch_model.bin' in name or
                'model.safetensors' in name):
                important_files.append(file)
            else:
                optional_files.append(file)
                
        # 先下载重要文件
        logger.info(f"下载{len(important_files)}个重要文件")
        report_progress("downloading", model_name, 10, f"开始下载模型文件")
        
        success_count = 0
        important_count = len(important_files)
        
        # 下载每个重要文件
        for i, file in enumerate(important_files):
            file_name = file['name']
            file_url = f"https://huggingface.co/{model_name}/resolve/main/{file_name}"
            dest_path = os.path.join(model_path, file_name)
            
            # 创建子目录
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            # 计算当前文件在总下载过程中的权重 (重要文件占80%)
            file_progress_start = 10 + (i / important_count) * 70
            file_progress_end = 10 + ((i + 1) / important_count) * 70
            
            # 下载前更新进度
            report_progress("downloading", model_name, int(file_progress_start), f"下载文件 {i+1}/{important_count}: {file_name}")
            
            # 下载文件
            if download_file(file_url, dest_path, model_name, f"文件 {i+1}/{important_count}: {file_name}"):
                success_count += 1
                # 下载成功后更新进度
                report_progress("downloading", model_name, int(file_progress_end), f"文件 {i+1}/{important_count} 下载完成")
            else:
                logger.error(f"下载文件 {file_name} 失败")
                if "pytorch_model.bin" in file_name or "config.json" in file_name:
                    logger.error(f"关键文件下载失败，无法继续")
                    return False
        
        # 验证模型
        report_progress("verifying", model_name, 80, "验证模型文件")
        if verify_model(model_path, model_name):
            logger.info(f"模型 {model_name} 下载并验证成功")
            report_progress("completed", model_name, 100, "模型下载和验证完成")
            return True
        else:
            logger.error(f"模型 {model_name} 验证失败")
            report_progress("error", model_name, 0, "模型验证失败")
            return False
            
    except Exception as e:
        logger.error(f"下载模型过程中出错: {str(e)}")
        report_progress("error", model_name, 0, f"下载出错: {str(e)}")
        return False

def download_model(model_dir, model_name):
    """主下载函数"""
    report_progress("preparing", model_name, 0, f"准备下载模型")
    return download_model_direct(model_dir, model_name)

def main():
    """主函数"""
    try:
        # 解析命令行参数
        if len(sys.argv) < 4:
            print("用法: python download_model.py <model_directory> <zh_to_en_model_name> <en_to_zh_model_name>")
            sys.exit(1)
            
        model_dir = sys.argv[1]
        zh_en_model = sys.argv[2]
        en_zh_model = sys.argv[3]
        
        logger.info(f"模型保存到目录: {model_dir}")
        logger.info(f"要下载的模型: {zh_en_model}, {en_zh_model}")
        print(f"模型将保存到目录: {model_dir}")
        print(f"要下载的模型: {zh_en_model}, {en_zh_model}")
        
        # 确保目录存在
        os.makedirs(model_dir, exist_ok=True)
        
        # 下载中文到英文模型
        logger.info(f"开始下载模型: {zh_en_model}")
        zh_en_success = download_model(model_dir, zh_en_model)
        if not zh_en_success:
            logger.error(f"中文到英文模型下载失败")
            print("中文到英文模型下载失败")
            sys.exit(1)
            
        # 下载英文到中文模型
        logger.info(f"开始下载模型: {en_zh_model}")
        en_zh_success = download_model(model_dir, en_zh_model)
        if not en_zh_success:
            logger.error(f"英文到中文模型下载失败")
            print("英文到中文模型下载失败")
            sys.exit(1)
        
        # 最终检查
        zh_en_path = os.path.join(model_dir, zh_en_model.replace('/', os.path.sep))
        en_zh_path = os.path.join(model_dir, en_zh_model.replace('/', os.path.sep))
        
        if os.path.exists(zh_en_path) and os.path.exists(en_zh_path):
            # 列出下载的文件
            print("\n下载的文件列表:\n")
            
            print(f"模型: {zh_en_model}")
            zh_en_files = os.listdir(zh_en_path)
            for file in zh_en_files:
                file_path = os.path.join(zh_en_path, file)
                file_size = os.path.getsize(file_path) if os.path.isfile(file_path) else 0
                print(f"    {file} ({file_size} 字节)")
                
            print(f"\n模型: {en_zh_model}")
            en_zh_files = os.listdir(en_zh_path)
            for file in en_zh_files:
                file_path = os.path.join(en_zh_path, file)
                file_size = os.path.getsize(file_path) if os.path.isfile(file_path) else 0
                print(f"    {file} ({file_size} 字节)")
            
            print("\n全部下载成功!")
            sys.exit(0)
        else:
            print("模型目录不存在，下载可能不完整")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"主函数执行出错: {str(e)}")
        error_info = {"error": str(e)}
        print(json.dumps(error_info, ensure_ascii=False), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
