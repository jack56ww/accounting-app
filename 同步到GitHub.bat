@echo off
chcp 65001 >nul
echo ========================================
echo    随心记账 - 同步到GitHub工具
echo ========================================
echo.

cd /d "%~dp0"

:: 设置Git路径
set "GIT_PATH=D:\AI-git\Git\bin\git.exe"
if not exist "%GIT_PATH%" (
    set "GIT_PATH=git"
)

echo [1/3] 检查Git状态...
"%GIT_PATH%" --version
if %errorlevel% neq 0 (
    echo ❌ Git不可用！
    pause
    exit /b 1
)
echo.

echo [2/3] 检查提交状态...
"%GIT_PATH%" status
echo.

:: 检查是否有修改需要提交
"%GIT_PATH%" status --porcelain > temp_status.txt
set /p has_changes=<temp_status.txt
del temp_status.txt

if not "%has_changes%"=="" (
    echo 检测到有未提交的修改，正在提交...
    "%GIT_PATH%" add .
    set /p commit_msg="请输入提交信息（直接回车使用默认）: "
    if "%commit_msg%"=="" set commit_msg="update: 更新代码"
    "%GIT_PATH%" commit -m "%commit_msg%"
    echo ✅ 代码已提交
    echo.
) else (
    echo ✅ 工作区干净，无需提交
    echo.
)

echo [3/3] 推送到GitHub...
"%GIT_PATH%" remote -v | findstr origin >nul
if %errorlevel% neq 0 (
    echo 尚未配置GitHub远程仓库
    echo.
    echo 请先在GitHub创建仓库，然后输入仓库地址
    echo 格式：https://github.com/你的用户名/accounting-app.git
    echo.
    set /p repo_url="请输入GitHub仓库地址: "
    if not "%repo_url%"=="" (
        "%GIT_PATH%" branch -M main
        "%GIT_PATH%" remote add origin "%repo_url%"
    ) else (
        echo 未输入仓库地址，退出
        pause
        exit /b 0
    )
)

echo 正在推送...
"%GIT_PATH%" push -u origin main
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 同步成功！
    echo ========================================
) else (
    echo.
    echo ⚠️ 推送失败，请检查网络和仓库权限
)

echo.
pause