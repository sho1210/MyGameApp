# Text translation script
import os
import sys
import json
import importlib
import io

# 确保 Python 正确处理 UTF-8 输出
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Check and install missing dependencies
def check_and_install_dependencies():
    dependencies = ['transformers', 'torch', 'sentencepiece']
    missing_deps = []
    
    for dep in dependencies:
        try:
            importlib.import_module(dep)
            print(f"{dep} is installed")
        except ImportError:
            missing_deps.append(dep)
            print(f"{dep} is not installed, will try to install")
    
    if missing_deps:
        import subprocess
        for dep in missing_deps:
            try:
                print(f"Installing {dep}...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", dep])
                print(f"{dep} installation successful")
            except Exception as e:
                print(f"Failed to install {dep}: {str(e)}")
                return False
    
    # Check for recommended packages
    try:
        importlib.import_module('sacremoses')
        print("sacremoses is installed")
    except ImportError:
        print("Installing recommended package sacremoses...")
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "sacremoses"])
            print("sacremoses installation successful")
        except Exception as e:
            print(f"Note: Failed to install sacremoses: {str(e)}")
    
    return True

# Ensure all dependencies are installed
if not check_and_install_dependencies():
    print(json.dumps({"error": "Failed to install dependencies"}, ensure_ascii=False), flush=True)
    sys.exit(1)

# Import necessary libraries
try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
except Exception as e:
    print(json.dumps({"error": f"Failed to import transformers: {str(e)}"}, ensure_ascii=False), flush=True)
    sys.exit(1)

def translate_text(text, model_dir, model_name):
    try:
        # Format model path correctly for the OS
        safe_model_name = model_name.replace('/', os.path.sep)
        model_path = os.path.join(model_dir, safe_model_name)
        
        print(f"Loading model and tokenizer from: {model_path}")
        
        # Check if directory exists
        if not os.path.exists(model_path):
            raise Exception(f"Model directory does not exist: {model_path}")
        
        # List files in directory
        print("Files in model directory:")
        for file in os.listdir(model_path):
            file_path = os.path.join(model_path, file)
            file_size = os.path.getsize(file_path)
            print(f"  {file}: {file_size} bytes")
        
        # Load tokenizer with explicit local path
        print(f"Loading tokenizer from {model_path}...")
        tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
        
        # Load model with explicit local path
        print(f"Loading model from {model_path}...")
        model = AutoModelForSeq2SeqLM.from_pretrained(model_path, local_files_only=True)
        
        # Translate text
        print(f"Translating text: {text}")
        inputs = tokenizer(text, return_tensors="pt", padding=True)
        outputs = model.generate(**inputs)
        translated_text = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        
        print(f"Translation result: {translated_text}")
        return translated_text
    except Exception as e:
        print(f"Error during translation: {str(e)}")
        raise

def detect_language(text):
    # Improved language detection - check for Chinese characters
    for char in text:
        if '\u4e00' <= char <= '\u9fff':
            return "zh"
    return "en"

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Not enough parameters"}, ensure_ascii=False), flush=True)
        sys.exit(1)
    
    try:
        text = sys.argv[1]
        model_dir = sys.argv[2]
        zh_en_model = sys.argv[3]
        en_zh_model = sys.argv[4]
        
        print(f"Text to translate: {text}")
        print(f"Model directory: {model_dir}")
        print(f"Chinese to English model: {zh_en_model}")
        print(f"English to Chinese model: {en_zh_model}")
        
        # Detect language and choose appropriate model
        lang = detect_language(text)
        model_name = zh_en_model if lang == "zh" else en_zh_model
        
        print(f"Detected language: {lang}, using model: {model_name}")
        
        # Translate text
        translated_text = translate_text(text, model_dir, model_name)
        
        # Output JSON format result
        result = {
            "translatedText": translated_text,
            "sourceLanguage": lang,
            "targetLanguage": "en" if lang == "zh" else "zh"
        }
        
        # 单独输出JSON结果，确保使用UTF-8编码，并清空输出缓冲区
        result_json = json.dumps(result, ensure_ascii=False)
        print("\n\n--- TRANSLATION RESULT JSON BEGIN ---")
        print(result_json)
        print("--- TRANSLATION RESULT JSON END ---")
        sys.stdout.flush()
        
        sys.exit(0)
    except Exception as e:
        error_info = {"error": str(e)}
        print(json.dumps(error_info, ensure_ascii=False), flush=True)
        sys.exit(1)
