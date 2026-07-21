# Git安装和GitHub同步指南

## 第一步：安装Git

由于系统未检测到Git，请先安装Git：

### 方法一：官网下载（推荐）
1. 访问 Git 官网：https://git-scm.com/download/win
2. 下载 64-bit Windows 版本
3. 运行安装程序，**所有选项保持默认**，一直点击"下一步"即可
4. 安装完成后，**重启命令行或电脑**使环境变量生效

### 方法二：使用winget命令安装
打开 PowerShell 或命令提示符（管理员），执行：
```powershell
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
```

### 验证安装
安装完成后，打开新的命令行窗口，执行：
```bash
git --version
```
如果显示版本号（如 `git version 2.45.2.windows.1`），说明安装成功。

---

## 第二步：一键初始化Git并同步到GitHub

**最简单的方式：双击运行 `初始化Git并同步到GitHub.bat`**

这个脚本会自动完成：
- ✅ 检查Git是否安装
- ✅ 初始化Git仓库
- ✅ 配置Git用户信息
- ✅ 添加所有文件并提交
- ✅ 配置GitHub远程仓库
- ✅ 推送到GitHub

---

## 第三步：在GitHub创建仓库

1. 访问 https://github.com/new 登录你的GitHub账号
2. 填写仓库信息：
   - Repository name: `accounting-app`（或你喜欢的名字）
   - Description: `个人记账软件 - 随心记账`
   - 选择 **Public**（公开）或 **Private**（私有）
   - **不要**勾选 "Add a README file"（我们已经有了）
3. 点击 "Create repository"
4. 复制仓库地址（类似：`https://github.com/你的用户名/accounting-app.git`）

---

## 第四步：手动执行Git命令（可选）

如果你想手动执行，按以下步骤操作：

```bash
# 1. 进入项目目录
cd D:\AI-git

# 2. 初始化Git仓库
git init

# 3. 配置你的用户信息（只需要配置一次）
git config user.name "你的GitHub用户名"
git config user.email "你的GitHub邮箱"

# 4. 添加所有文件
git add .

# 5. 首次提交
git commit -m "feat: 初始化记账软件项目 v1.0.0"

# 6. 设置主分支为main
git branch -M main

# 7. 添加远程仓库地址（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/accounting-app.git

# 8. 推送到GitHub
git push -u origin main
```

---

## 日常使用Git命令

```bash
# 查看当前状态
git status

# 查看修改内容
git diff

# 添加修改的文件
git add .

# 提交更改
git commit -m "fix: 修复预算计算问题"

# 推送到GitHub
git push

# 拉取最新代码
git pull

# 查看提交历史
git log --oneline
```

---

## 开启GitHub Pages在线访问

推送代码到GitHub后，可以开启GitHub Pages让你的记账软件在线访问：

1. 进入你的GitHub仓库页面
2. 点击 "Settings"（设置）
3. 在左侧菜单找到 "Pages"
4. 在 "Source" 部分：
   - 选择 "Deploy from a branch"
   - Branch 选择 "main"，文件夹选择 "/root"
   - 点击 "Save"
5. 等待几分钟，页面会显示你的网站地址：
   `https://你的用户名.github.io/accounting-app/`

---

## 常见问题

### Q: 推送时要求输入用户名密码？
A: GitHub现在不支持密码认证，需要使用Personal Access Token：
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" - "Classic"
3. 勾选 `repo` 权限，生成token
4. 推送时密码处输入这个token即可

### Q: 如何更新代码到GitHub？
A: 修改代码后执行：
```bash
git add .
git commit -m "描述你的修改"
git push
```

### Q: 如何在其他电脑同步代码？
A: 在其他电脑执行：
```bash
git clone https://github.com/你的用户名/accounting-app.git
```

---

## 项目文件说明

```
D:\AI-git\
├── accounting-app\          # 记账软件主目录
│   ├── index.html          # 主页面
│   ├── css\style.css       # 样式文件
│   └── js\app.js           # 应用逻辑
├── .gitignore              # Git忽略文件配置
├── README.md               # 项目说明文档
├── 初始化Git并同步到GitHub.bat  # 一键初始化脚本
└── Git安装和使用指南.md     # 本文件
```