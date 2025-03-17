!macro customHeader
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customHeader"
!macroend

!macro customInit
  ; 自定义初始化代码
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\..\src\assets\icon.ico"
  !define MUI_HEADERIMAGE_RIGHT
!macroend

!macro customWelcomePage
  ; 自定义欢迎页面
  !define MUI_WELCOMEPAGE_TITLE "欢迎安装 ${PRODUCT_NAME}"
  !define MUI_WELCOMEPAGE_TEXT "本向导将引导您完成 ${PRODUCT_NAME} 的安装过程。$\r$\n$\r$\n在开始安装之前，建议关闭其他所有应用程序。这将允许安装程序更新所需的系统文件，而无需重新启动计算机。$\r$\n$\r$\n$_CLICK"
!macroend

!macro customLicensePage
  ; 自定义许可协议页面
!macroend

!macro customInstallModePage
  ; 自定义安装模式页面
  !define MUI_COMPONENTSPAGE_SMALLDESC
!macroend

!macro customInstallDirectoryPage
  ; 自定义安装目录页面
  !define MUI_DIRECTORYPAGE_TEXT_TOP "安装程序将在以下文件夹中安装 ${PRODUCT_NAME}。要安装到不同的文件夹，请单击"浏览"并选择另一个文件夹。"
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "目标文件夹"
  
  ; 设置默认安装目录为Program Files
  !define MUI_DIRECTORYPAGE_VARIABLE $INSTDIR
  StrCpy $INSTDIR "$PROGRAMFILES\${PRODUCT_NAME}"
  

!macroend

!macro customInstallPage
  ; 自定义安装页面
  !define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "安装完成"
  !define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "${PRODUCT_NAME} 已成功安装到您的计算机上。"
  !define MUI_INSTFILESPAGE_ABORTHEADER_TEXT "安装中断"
  !define MUI_INSTFILESPAGE_ABORTHEADER_SUBTEXT "${PRODUCT_NAME} 安装未完成。"
!macroend

!macro customFinishPage
  ; 自定义完成页面
!macroend

!macro customUnInit
  ; 自定义卸载初始化代码
  MessageBox MB_YESNO|MB_ICONQUESTION "确定要完全卸载 ${PRODUCT_NAME} 及其所有组件吗？" IDYES +2
  Abort
!macroend

!macro customInstall
  ; 创建utils目录（确保目标目录存在）
  CreateDirectory "$INSTDIR\resources\app\utils"
  
  ; 复制Python脚本到安装目录
  !tempfile PY_SCRIPT_LIST
  !system 'dir /b "utils\*.py" > "${PY_SCRIPT_LIST}"'
  !include "${PY_SCRIPT_LIST}"
  !delfile "${PY_SCRIPT_LIST}"
  !undef PY_SCRIPT_LIST
  
  ; 如果以上方法不工作，可以直接指定文件名
  CopyFiles "$INSTDIR\resources\app.asar.unpacked\utils\translate.py" "$INSTDIR\resources\app\utils\translate.py"
  CopyFiles "$INSTDIR\resources\app.asar.unpacked\utils\download_model.py" "$INSTDIR\resources\app\utils\download_model.py"
  
  ; 为Python脚本添加执行权限
  Exec 'icacls "$INSTDIR\resources\app\utils\*.py" /grant:r Everyone:(RX)'
  
  ; 记录到安装日志
  FileOpen $0 "$INSTDIR\install_log.txt" w
  FileWrite $0 "Python scripts copied to: $INSTDIR\resources\app\utils\"
  FileClose $0
!macroend

!macro customUnInstall
  ; 清理创建的目录
  RMDir /r "$INSTDIR\resources\app\utils"
!macroend