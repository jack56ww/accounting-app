// 云端存储管理 - 使用JSONBin.io免费服务
class CloudStorage {
    constructor() {
        this.apiUrl = 'https://api.jsonbin.io/v3/b';
        this.masterKey = ''; // 匿名使用，如需私有bin可注册获取API Key
    }

    // 创建云端存储桶
    async createBin(data, isPrivate = false) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-Bin-Private': isPrivate ? 'true' : 'false'
            };
            if (this.masterKey) {
                headers['X-Master-Key'] = this.masterKey;
            }
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            const result = await response.json();
            return { success: true, binId: result.metadata.id };
        } catch (error) {
            console.error('创建云端存储失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 读取云端数据
    async getBin(binId) {
        try {
            const headers = {};
            if (this.masterKey) {
                headers['X-Master-Key'] = this.masterKey;
            }
            
            const response = await fetch(`${this.apiUrl}/${binId}/latest`, { headers });
            const result = await response.json();
            return { success: true, data: result.record };
        } catch (error) {
            console.error('读取云端数据失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 更新云端数据
    async updateBin(binId, data) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (this.masterKey) {
                headers['X-Master-Key'] = this.masterKey;
            }
            
            const response = await fetch(`${this.apiUrl}/${binId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            await response.json();
            return { success: true };
        } catch (error) {
            console.error('更新云端数据失败:', error);
            return { success: false, error: error.message };
        }
    }
}

// 用户认证管理类
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.SALT_PREFIX = 'accounting_app_salt_';
        this.cloud = new CloudStorage();
        this.usersBinId = null; // 全局用户列表bin ID
    }

    // 密码加密：SHA-256 + 盐值
    hashPassword(password, salt) {
        const saltedPassword = this.SALT_PREFIX + salt + password;
        return CryptoJS.SHA256(saltedPassword).toString();
    }

    // 生成随机盐值
    generateSalt() {
        return CryptoJS.lib.WordArray.random(16).toString();
    }

    // 初始化云端用户列表
    async initCloudUsers() {
        // 检查本地是否有用户列表bin ID
        const savedBinId = localStorage.getItem('accounting_users_bin');
        if (savedBinId) {
            this.usersBinId = savedBinId;
            const result = await this.cloud.getBin(savedBinId);
            if (result.success) {
                return result.data;
            }
        }
        
        // 没有则创建新的用户列表bin
        const result = await this.cloud.createBin({});
        if (result.success) {
            this.usersBinId = result.binId;
            localStorage.setItem('accounting_users_bin', result.binId);
            return {};
        }
        return null;
    }

    // 获取所有用户（优先云端，本地备份）
    async getUsers() {
        // 先尝试从云端获取
        if (this.usersBinId) {
            const result = await this.cloud.getBin(this.usersBinId);
            if (result.success) {
                // 同步到本地备份
                localStorage.setItem('accounting_users', JSON.stringify(result.data));
                return result.data;
            }
        }
        // 云端失败则用本地
        const users = localStorage.getItem('accounting_users');
        return users ? JSON.parse(users) : {};
    }

    // 保存用户列表（云端+本地双备份）
    async saveUsers(users) {
        // 本地保存
        localStorage.setItem('accounting_users', JSON.stringify(users));
        // 云端保存
        if (this.usersBinId) {
            await this.cloud.updateBin(this.usersBinId, users);
        }
    }

    // 注册用户
    async register(username, password) {
        const users = await this.getUsers();
        
        // 验证用户名
        if (!username || username.length < 3 || username.length > 20) {
            return { success: false, message: '用户名长度需在3-20位之间' };
        }
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            return { success: false, message: '用户名只能包含字母、数字、下划线和中文' };
        }
        
        // 验证密码
        if (!password || password.length < 6) {
            return { success: false, message: '密码长度至少6位' };
        }

        // 检查用户是否存在
        if (users[username]) {
            return { success: false, message: '用户名已存在' };
        }

        // 创建用户，密码加盐哈希存储
        const salt = this.generateSalt();
        const userData = {
            username,
            passwordHash: this.hashPassword(password, salt),
            salt,
            createdAt: new Date().toISOString(),
            dataBinId: null // 后续创建用户数据bin
        };

        // 为用户创建个人数据存储桶
        const binResult = await this.cloud.createBin({
            records: [],
            budget: 0,
            theme: 'light'
        });
        if (binResult.success) {
            userData.dataBinId = binResult.binId;
        }

        users[username] = userData;
        await this.saveUsers(users);
        
        return { success: true, message: '注册成功' };
    }

    // 登录验证
    async login(username, password) {
        const users = await this.getUsers();
        const user = users[username];

        if (!user) {
            return { success: false, message: '用户名或密码错误' };
        }

        const hash = this.hashPassword(password, user.salt);
        if (hash !== user.passwordHash) {
            return { success: false, message: '用户名或密码错误' };
        }

        // 登录成功，保存登录状态
        this.currentUser = username;
        localStorage.setItem('accounting_current_user', username);
        return { success: true, message: '登录成功', user };
    }

    // 退出登录
    logout() {
        this.currentUser = null;
        localStorage.removeItem('accounting_current_user');
    }

    // 检查登录状态
    async checkLogin() {
        const savedUser = localStorage.getItem('accounting_current_user');
        if (savedUser) {
            // 确保云端用户列表已初始化
            await this.initCloudUsers();
            const users = await this.getUsers();
            if (users[savedUser]) {
                this.currentUser = savedUser;
                return users[savedUser];
            }
        }
        return null;
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 获取用户数据bin ID
    async getUserDataBinId(username) {
        const users = await this.getUsers();
        return users[username]?.dataBinId;
    }

    // 从云端加载用户数据
    async loadUserData(username) {
        const binId = await this.getUserDataBinId(username);
        if (binId) {
            const result = await this.cloud.getBin(binId);
            if (result.success) {
                // 同步到本地
                const recordsKey = `accounting_records_${username}`;
                const budgetKey = `accounting_budget_${username}`;
                const themeKey = `accounting_theme_${username}`;
                localStorage.setItem(recordsKey, JSON.stringify(result.data.records || []));
                localStorage.setItem(budgetKey, (result.data.budget || 0).toString());
                localStorage.setItem(themeKey, result.data.theme || 'light');
                return result.data;
            }
        }
        return null;
    }

    // 保存用户数据到云端
    async saveUserData(username, data) {
        const binId = await this.getUserDataBinId(username);
        if (binId) {
            await this.cloud.updateBin(binId, data);
        }
    }
}

// 记账应用主逻辑
class AccountingApp {
    constructor() {
        this.auth = new AuthManager();
        this.records = [];
        this.budget = 0;
        this.currentType = 'expense';
        this.editingId = null;
        this.charts = {};
        this.currentUserData = null;
        
        // 分类配置
        this.categories = {
            expense: [
                { id: 'food', name: '餐饮', icon: '🍜' },
                { id: 'transport', name: '交通', icon: '🚗' },
                { id: 'shopping', name: '购物', icon: '🛒' },
                { id: 'entertainment', name: '娱乐', icon: '🎮' },
                { id: 'housing', name: '住房', icon: '🏠' },
                { id: 'medical', name: '医疗', icon: '💊' },
                { id: 'education', name: '教育', icon: '📚' },
                { id: 'communication', name: '通讯', icon: '📱' },
                { id: 'other_expense', name: '其他', icon: '📦' }
            ],
            income: [
                { id: 'salary', name: '工资', icon: '💰' },
                { id: 'bonus', name: '奖金', icon: '🎁' },
                { id: 'investment', name: '投资', icon: '📈' },
                { id: 'parttime', name: '兼职', icon: '💼' },
                { id: 'gift', name: '红包', icon: '🧧' },
                { id: 'refund', name: '退款', icon: '↩️' },
                { id: 'other_income', name: '其他', icon: '💵' }
            ]
        };
        
        this.init();
    }
    
    async init() {
        // 初始化云端用户列表
        await this.auth.initCloudUsers();
        
        // 检查登录状态
        const user = await this.auth.checkLogin();
        if (user) {
            await this.showApp(user);
        } else {
            this.showAuth();
        }
        
        this.bindAuthEvents();
    }

    // 显示登录页面
    showAuth() {
        document.getElementById('authPage').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }

    // 显示主应用
    async showApp(user) {
        document.getElementById('authPage').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('currentUsername').textContent = this.auth.getCurrentUser();
        
        // 从云端加载用户数据
        await this.loadData();
        this.bindAppEvents();
        this.updateUI();
        this.setDefaultDate();
        this.renderCategoryOptions();
        
        // 显示同步成功提示
        this.showSyncStatus('☁️ 数据已从云端同步');
    }

    // 显示同步状态
    showSyncStatus(message) {
        const status = document.createElement('div');
        status.className = 'sync-status';
        status.textContent = message;
        status.style.cssText = 'position:fixed;top:80px;right:20px;background:var(--primary-color);color:white;padding:0.75rem 1rem;border-radius:8px;z-index:1000;animation:slideIn 0.3s ease;box-shadow:var(--shadow);';
        document.body.appendChild(status);
        setTimeout(() => {
            status.style.opacity = '0';
            status.style.transition = 'opacity 0.3s';
            setTimeout(() => status.remove(), 300);
        }, 2000);
    }

    // 绑定认证相关事件
    bindAuthEvents() {
        // 切换登录/注册
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('registerForm').classList.add('active');
            this.clearAuthErrors();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById('loginForm').classList.add('active');
            this.clearAuthErrors();
        });

        // 登录
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // 注册
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
        document.getElementById('regConfirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleRegister();
        });
    }

    // 清除错误提示
    clearAuthErrors() {
        document.getElementById('loginError').classList.remove('show');
        document.getElementById('registerError').classList.remove('show');
    }

    // 显示错误
    showError(elementId, message) {
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.classList.add('show');
    }

    // 处理登录
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showError('loginError', '请输入用户名和密码');
            return;
        }

        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.textContent = '登录中...';

        const result = await this.auth.login(username, password);
        if (result.success) {
            await this.showApp(result.user);
        } else {
            this.showError('loginError', result.message);
        }
        
        btn.disabled = false;
        btn.textContent = '登录';
    }

    // 处理注册
    async handleRegister() {
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (!username || !password || !confirmPassword) {
            this.showError('registerError', '请填写完整信息');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('registerError', '两次输入的密码不一致');
            return;
        }

        const btn = document.getElementById('registerBtn');
        btn.disabled = true;
        btn.textContent = '注册中...';

        const result = await this.auth.register(username, password);
        if (result.success) {
            // 注册成功自动登录
            const loginResult = await this.auth.login(username, password);
            if (loginResult.success) {
                await this.showApp(loginResult.user);
            }
        } else {
            this.showError('registerError', result.message);
        }
        
        btn.disabled = false;
        btn.textContent = '注册';
    }

    // 处理退出登录
    handleLogout() {
        if (confirm('确定要退出登录吗？数据已自动保存到云端。')) {
            this.auth.logout();
            // 清空表单
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regConfirmPassword').value = '';
            this.clearAuthErrors();
            this.showAuth();
        }
    }
    
    // 从本地和云端加载当前用户数据
    async loadData() {
        const username = this.auth.getCurrentUser();
        const recordsKey = `accounting_records_${username}`;
        const budgetKey = `accounting_budget_${username}`;
        const themeKey = `accounting_theme_${username}`;
        
        // 先从云端加载最新数据
        const cloudData = await this.auth.loadUserData(username);
        
        if (cloudData) {
            this.records = cloudData.records || [];
            this.budget = cloudData.budget || 0;
            this.currentUserData = cloudData;
        } else {
            // 云端失败则用本地
            const savedRecords = localStorage.getItem(recordsKey);
            const savedBudget = localStorage.getItem(budgetKey);
            this.records = savedRecords ? JSON.parse(savedRecords) : [];
            this.budget = savedBudget ? parseFloat(savedBudget) : 0;
        }
        
        // 主题设置
        const savedTheme = localStorage.getItem(themeKey);
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').textContent = '🌙';
        }
    }
    
    // 保存数据到本地和云端
    async saveData() {
        const username = this.auth.getCurrentUser();
        const recordsKey = `accounting_records_${username}`;
        const budgetKey = `accounting_budget_${username}`;
        
        // 本地保存
        localStorage.setItem(recordsKey, JSON.stringify(this.records));
        localStorage.setItem(budgetKey, this.budget.toString());
        
        // 云端保存
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const data = {
            records: this.records,
            budget: this.budget,
            theme,
            updatedAt: new Date().toISOString()
        };
        
        await this.auth.saveUserData(username, data);
    }
    
    // 绑定应用事件
    bindAppEvents() {
        // 用户下拉菜单
        const userDropdown = document.getElementById('userDropdown');
        const userInfoBtn = document.getElementById('userInfoBtn');
        
        // 点击用户名切换菜单
        userInfoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('open');
        });

        // 点击页面其他地方关闭菜单
        document.addEventListener('click', () => {
            userDropdown.classList.remove('open');
        });

        // 阻止菜单内部点击冒泡
        document.getElementById('dropdownMenu').addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 退出登录
        document.getElementById('logoutBtn').addEventListener('click', () => {
            userDropdown.classList.remove('open');
            this.handleLogout();
        });

        // 添加记录按钮
        document.getElementById('addRecordBtn').addEventListener('click', () => this.openModal());
        
        // 关闭弹窗
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('closeBudgetModal').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('cancelBudgetBtn').addEventListener('click', () => this.closeBudgetModal());
        
        // 点击遮罩关闭
        document.getElementById('overlay').addEventListener('click', () => {
            this.closeModal();
            this.closeBudgetModal();
        });
        
        // 类型切换
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentType = e.target.dataset.type;
                this.renderCategoryOptions();
            });
        });
        
        // 表单提交
        document.getElementById('recordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveRecord();
        });
        
        // 预算设置
        document.getElementById('setBudgetBtn').addEventListener('click', () => this.openBudgetModal());
        document.getElementById('budgetForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveBudget();
        });
        
        // 筛选
        document.getElementById('filterType').addEventListener('change', () => this.renderRecords());
        
        // 主题切换
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // 导出导入
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
    }
    
    // 设置默认日期为今天
    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }
    
    // 渲染分类选项
    renderCategoryOptions() {
        const select = document.getElementById('category');
        select.innerHTML = '<option value="">请选择分类</option>';
        
        this.categories[this.currentType].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = `${cat.icon} ${cat.name}`;
            select.appendChild(option);
        });
    }
    
    // 打开添加/编辑弹窗
    openModal(id = null) {
        this.editingId = id;
        const modal = document.getElementById('recordModal');
        const overlay = document.getElementById('overlay');
        const title = document.getElementById('modalTitle');
        
        if (id) {
            const record = this.records.find(r => r.id === id);
            if (record) {
                title.textContent = '编辑记录';
                document.getElementById('recordId').value = id;
                document.getElementById('amount').value = record.amount;
                document.getElementById('date').value = record.date;
                document.getElementById('note').value = record.note || '';
                
                // 设置类型
                this.currentType = record.type;
                document.querySelectorAll('.type-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.type === record.type);
                });
                this.renderCategoryOptions();
                document.getElementById('category').value = record.category;
            }
        } else {
            title.textContent = '添加记录';
            document.getElementById('recordForm').reset();
            this.setDefaultDate();
            this.currentType = 'expense';
            document.querySelectorAll('.type-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.type === 'expense');
            });
            this.renderCategoryOptions();
        }
        
        modal.classList.add('active');
        overlay.classList.add('active');
    }
    
    // 关闭弹窗
    closeModal() {
        document.getElementById('recordModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.editingId = null;
    }
    
    // 打开预算弹窗
    openBudgetModal() {
        document.getElementById('budgetAmount').value = this.budget || '';
        document.getElementById('budgetModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    }
    
    // 关闭预算弹窗
    closeBudgetModal() {
        document.getElementById('budgetModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }
    
    // 保存记录
    async saveRecord() {
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;
        const note = document.getElementById('note').value;
        
        if (!amount || !category || !date) {
            alert('请填写完整信息');
            return;
        }
        
        if (this.editingId) {
            // 编辑现有记录
            const index = this.records.findIndex(r => r.id === this.editingId);
            if (index !== -1) {
                this.records[index] = {
                    ...this.records[index],
                    type: this.currentType,
                    amount,
                    category,
                    date,
                    note,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            // 添加新记录
            const record = {
                id: Date.now().toString(),
                type: this.currentType,
                amount,
                category,
                date,
                note,
                createdAt: new Date().toISOString()
            };
            this.records.unshift(record);
        }
        
        await this.saveData();
        this.closeModal();
        this.updateUI();
        this.showSyncStatus('☁️ 已同步到云端');
    }
    
    // 删除记录
    async deleteRecord(id) {
        if (confirm('确定要删除这条记录吗？')) {
            this.records = this.records.filter(r => r.id !== id);
            await this.saveData();
            this.updateUI();
            this.showSyncStatus('☁️ 已同步到云端');
        }
    }
    
    // 保存预算
    async saveBudget() {
        this.budget = parseFloat(document.getElementById('budgetAmount').value) || 0;
        await this.saveData();
        this.closeBudgetModal();
        this.updateUI();
        this.showSyncStatus('☁️ 预算已保存到云端');
    }
    
    // 获取分类信息
    getCategoryInfo(categoryId, type) {
        return this.categories[type].find(c => c.id === categoryId) || { name: '未知', icon: '❓' };
    }
    
    // 获取本月数据
    getMonthData() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthRecords = this.records.filter(r => {
            const date = new Date(r.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        
        const income = monthRecords
            .filter(r => r.type === 'income')
            .reduce((sum, r) => sum + r.amount, 0);
        
        const expense = monthRecords
            .filter(r => r.type === 'expense')
            .reduce((sum, r) => sum + r.amount, 0);
        
        return { income, expense, records: monthRecords };
    }
    
    // 获取总余额
    getTotalBalance() {
        const income = this.records
            .filter(r => r.type === 'income')
            .reduce((sum, r) => sum + r.amount, 0);
        
        const expense = this.records
            .filter(r => r.type === 'expense')
            .reduce((sum, r) => sum + r.amount, 0);
        
        return income - expense;
    }
    
    // 渲染记录列表
    renderRecords() {
        const container = document.getElementById('recordsList');
        const filterType = document.getElementById('filterType').value;
        
        let filteredRecords = this.records;
        if (filterType !== 'all') {
            filteredRecords = this.records.filter(r => r.type === filterType);
        }
        
        // 按日期排序，最新的在前
        filteredRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (filteredRecords.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无记录，点击"添加记录"开始记账吧！<br><small style="color:var(--text-secondary);margin-top:0.5rem;display:block;">数据自动保存到云端，换电脑也能访问 ☁️</small></div>';
            return;
        }
        
        container.innerHTML = filteredRecords.map(record => {
            const cat = this.getCategoryInfo(record.category, record.type);
            const amountClass = record.type === 'income' ? 'income' : 'expense';
            const amountPrefix = record.type === 'income' ? '+' : '-';
            
            return `
                <div class="record-item">
                    <div class="record-icon">${cat.icon}</div>
                    <div class="record-info">
                        <div class="record-category">${cat.name}</div>
                        <div class="record-meta">${record.date}${record.note ? ' · ' + record.note : ''}</div>
                    </div>
                    <div class="record-amount ${amountClass}">${amountPrefix}¥${record.amount.toFixed(2)}</div>
                    <div class="record-actions">
                        <button class="record-btn" onclick="app.openModal('${record.id}')" title="编辑">✏️</button>
                        <button class="record-btn" onclick="app.deleteRecord('${record.id}')" title="删除">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 更新预算进度
    updateBudgetProgress() {
        const { expense } = this.getMonthData();
        const progressFill = document.getElementById('budgetProgress');
        const budgetUsed = document.getElementById('budgetUsed');
        const budgetTotal = document.getElementById('budgetTotal');
        const budgetStatus = document.getElementById('budgetStatus');
        
        budgetUsed.textContent = `¥${expense.toFixed(2)}`;
        budgetTotal.textContent = `¥${this.budget.toFixed(2)}`;
        
        if (this.budget > 0) {
            const percent = Math.min((expense / this.budget) * 100, 100);
            progressFill.style.width = `${percent}%`;
            
            progressFill.classList.remove('warning', 'danger');
            budgetStatus.classList.remove('warning', 'danger');
            
            if (percent >= 100) {
                progressFill.classList.add('danger');
                budgetStatus.classList.add('danger');
                budgetStatus.textContent = '已超支！';
            } else if (percent >= 80) {
                progressFill.classList.add('warning');
                budgetStatus.classList.add('warning');
                budgetStatus.textContent = '即将超支';
            } else {
                budgetStatus.textContent = `剩余 ¥${(this.budget - expense).toFixed(2)}`;
            }
        } else {
            progressFill.style.width = '0%';
            budgetStatus.textContent = '点击设置预算';
        }
    }
    
    // 更新图表
    updateCharts() {
        this.updateTrendChart();
        this.updateCategoryChart();
    }
    
    // 更新趋势图
    updateTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        // 获取最近7天的数据
        const days = [];
        const incomeData = [];
        const expenseData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            days.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
            
            const dayRecords = this.records.filter(r => r.date === dateStr);
            incomeData.push(dayRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0));
            expenseData.push(dayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0));
        }
        
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    {
                        label: '收入',
                        data: incomeData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: '支出',
                        data: expenseData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: textColor }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' }
                    },
                    y: {
                        ticks: { color: textColor },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' }
                    }
                }
            }
        });
    }
    
    // 更新分类饼图
    updateCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        const { records } = this.getMonthData();
        
        // 统计支出分类
        const categoryStats = {};
        records.filter(r => r.type === 'expense').forEach(r => {
            if (!categoryStats[r.category]) {
                categoryStats[r.category] = 0;
            }
            categoryStats[r.category] += r.amount;
        });
        
        const labels = [];
        const data = [];
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#64748b'];
        
        Object.entries(categoryStats).forEach(([catId, amount], index) => {
            const cat = this.getCategoryInfo(catId, 'expense');
            labels.push(cat.name);
            data.push(amount);
        });
        
        if (data.length === 0) {
            labels.push('暂无支出');
            data.push(1);
        }
        
        if (this.charts.category) {
            this.charts.category.destroy();
        }
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        
        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor }
                    }
                }
            }
        });
    }
    
    // 切换主题
    async toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const btn = document.getElementById('themeToggle');
        
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            btn.textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            btn.textContent = '☀️';
        }
        
        await this.saveData();
        this.updateCharts();
        this.showSyncStatus('☁️ 主题设置已同步');
    }
    
    // 导出数据
    exportData() {
        const data = {
            username: this.auth.getCurrentUser(),
            records: this.records,
            budget: this.budget,
            exportDate: new Date().toISOString(),
            cloud: true
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.auth.getCurrentUser()}_记账数据_云端备份_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // 导入数据
    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.records && Array.isArray(data.records)) {
                    if (confirm(`导入将覆盖当前用户「${this.auth.getCurrentUser()}」的云端数据，确定继续吗？`)) {
                        this.records = data.records;
                        this.budget = data.budget || 0;
                        await this.saveData();
                        this.updateUI();
                        alert('导入成功，数据已同步到云端！');
                    }
                } else {
                    alert('无效的数据文件');
                }
            } catch (err) {
                alert('文件解析失败');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }
    
    // 更新所有UI
    updateUI() {
        // 更新概览数据
        document.getElementById('balanceAmount').textContent = `¥${this.getTotalBalance().toFixed(2)}`;
        
        const { income, expense } = this.getMonthData();
        document.getElementById('monthIncome').textContent = `¥${income.toFixed(2)}`;
        document.getElementById('monthExpense').textContent = `¥${expense.toFixed(2)}`;
        
        // 更新预算
        this.updateBudgetProgress();
        
        // 更新记录列表
        this.renderRecords();
        
        // 更新图表
        this.updateCharts();
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
`;
document.head.appendChild(style);

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AccountingApp();
});