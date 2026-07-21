@echo off
chcp 65001 >nul
echo ========================================
echo    随心记账 - Git初始化和GitHub同步工具
echo ========================================
echo.

echo [1/5] 检查Git是否安装...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到Git！
    echo.
    echo 请先安装Git：
    echo 1. 访问 https://git-scm.com/download/win 下载Git
    echo 2. 安装时保持默认选项即可
    echo 3. 安装完成后重新运行此脚本
    echo.
    pause
    exit /b 1
)
echo ✅ Git已安装
git --version
echo.

echo [2/5] 初始化Git仓库...
cd /d "%~dp0"
if not exist .git (
    git init
    echo ✅ Git仓库初始化完成
) else (
    echo ✅ Git仓库已存在
)
echo.

echo [3/5] 配置Git用户信息（如果未配置）...
git config user.name >nul 2>&1
if %errorlevel% neq 0 (
    set /p git_name="请输入你的Git用户名（GitHub用户名）: "
    git config user.name "%git_name%"
)
git config user.email >nul 2>&1
if %errorlevel% neq 0 (
    set /p git_email="请输入你的Git邮箱（GitHub注册邮箱）: "
    git config user.email "%git_email%"
)
echo ✅ Git用户信息已配置
echo.

echo [4/5] 添加文件并提交...
git add .
git status
echo.
set /p commit_msg="请输入提交信息（直接回车使用默认信息）: "
if "%commit_msg%"=="" set commit_msg="feat: 初始化记账软件项目 v1.0.0"
git commit -m "%commit_msg%"
echo ✅ 代码已提交到本地仓库
echo.

echo [5/5] 配置GitHub远程仓库...
echo.
echo 请先在GitHub上创建一个新仓库（建议命名为 accounting-app）
echo 仓库地址格式：https://github.com/你的用户名/仓库名.git
echo.
set /p repo_url="请输入你的GitHub仓库地址: "
if not "%repo_url%"=="" (
    git branch -M main
    git remote add origin "%repo_url%" 2>nul || git remote set-url origin "%repo_url%"
    echo ✅ 远程仓库已配置
    echo.
    echo 正在推送到GitHub...
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo ========================================
        echo   ✅ 同步完成！
        echo ========================================
        echo.
        echo 你的记账软件已成功推送到GitHub！
        echo 可以在GitHub仓库页面开启GitHub Pages来在线访问。
    ) else (
        echo.
        echo ⚠️ 推送失败，请检查：
        echo 1. 仓库地址是否正确
        echo 2. 是否已登录GitHub
        echo 3. 网络连接是否正常
        echo.
        echo 你可以稍后手动执行：git push -u origin main
    )
) else (
    echo ⚠️ 未输入仓库地址，跳过远程配置
    echo 你可以稍后手动执行以下命令：
    echo   git remote add origin 你的仓库地址
    echo   git branch -M main
    echo   git push -u origin main
)

echo.
echo ========================================
echo   初始化完成！
echo ========================================
echo.
echo 常用Git命令：
echo   git status    - 查看状态
echo   git add .     - 添加修改
echo   git commit -m "提交信息" - 提交更改
echo   git push      - 推送到GitHub
echo   git pull      - 拉取最新代码
echo.
pause