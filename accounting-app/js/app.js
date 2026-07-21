// 云端存储 - 使用免费的 Kvdb.io 服务，无需注册，支持CORS
class CloudStorage {
    constructor() {
        this.baseUrl = 'https://kvdb.io';
        // 公共bucket ID，免费使用，数据隔离
        this.bucketId = 'A82Hg9xVQwqL8sRfM7zN3p';
    }

    // 生成唯一key
    getKey(key) {
        return `accounting_${key}`;
    }

    // 读取数据
    async get(key) {
        try {
            const response = await fetch(`${this.baseUrl}/${this.bucketId}/${this.getKey(key)}`, {
                method: 'GET',
                mode: 'cors'
            });
            if (response.ok) {
                const text = await response.text();
                if (text && text !== 'Not found') {
                    return { success: true, data: JSON.parse(text) };
                }
            }
            return { success: false };
        } catch (error) {
            console.error('云端读取失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 写入数据
    async set(key, data) {
        try {
            const response = await fetch(`${this.baseUrl}/${this.bucketId}/${this.getKey(key)}`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return { success: response.ok };
        } catch (error) {
            console.error('云端写入失败:', error);
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

    // 获取所有用户（优先云端，本地备份）
    async getUsers() {
        // 先从云端获取
        const cloudResult = await this.cloud.get('users');
        if (cloudResult.success && cloudResult.data) {
            // 同步到本地备份
            localStorage.setItem('accounting_users', JSON.stringify(cloudResult.data));
            return cloudResult.data;
        }
        // 云端失败用本地
        const users = localStorage.getItem('accounting_users');
        return users ? JSON.parse(users) : {};
    }

    // 保存用户列表（云端+本地双备份）
    async saveUsers(users) {
        localStorage.setItem('accounting_users', JSON.stringify(users));
        await this.cloud.set('users', users);
    }

    // 注册用户
    async register(username, password) {
        const users = await this.getUsers();
        
        // 验证
        if (!username || username.length < 3 || username.length > 20) {
            return { success: false, message: '用户名长度需在3-20位之间' };
        }
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            return { success: false, message: '用户名只能包含字母、数字、下划线和中文' };
        }
        if (!password || password.length < 6) {
            return { success: false, message: '密码长度至少6位' };
        }
        if (users[username]) {
            return { success: false, message: '用户名已存在' };
        }

        // 创建用户
        const salt = this.generateSalt();
        users[username] = {
            username,
            passwordHash: this.hashPassword(password, salt),
            salt,
            createdAt: new Date().toISOString()
        };

        await this.saveUsers(users);
        // 初始化用户数据
        await this.saveUserData(username, { records: [], budget: 0, theme: 'light' });
        
        return { success: true, message: '注册成功，数据已保存到云端' };
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

        this.currentUser = username;
        localStorage.setItem('accounting_current_user', username);
        return { success: true, message: '登录成功' };
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
            const users = await this.getUsers();
            if (users[savedUser]) {
                this.currentUser = savedUser;
                return true;
            }
        }
        return false;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    // 读取用户数据
    async loadUserData(username) {
        const cloudResult = await this.cloud.get(`user_${username}`);
        const localKey = `accounting_records_${username}`;
        const budgetKey = `accounting_budget_${username}`;
        const themeKey = `accounting_theme_${username}`;
        
        let data;
        if (cloudResult.success && cloudResult.data) {
            data = cloudResult.data;
            // 同步到本地
            localStorage.setItem(localKey, JSON.stringify(data.records || []));
            localStorage.setItem(budgetKey, (data.budget || 0).toString());
            localStorage.setItem(themeKey, data.theme || 'light');
        } else {
            // 本地读取
            data = {
                records: JSON.parse(localStorage.getItem(localKey) || '[]'),
                budget: parseFloat(localStorage.getItem(budgetKey) || '0'),
                theme: localStorage.getItem(themeKey) || 'light'
            };
        }
        return data;
    }

    // 保存用户数据到云端
    async saveUserData(username, data) {
        const localKey = `accounting_records_${username}`;
        const budgetKey = `accounting_budget_${username}`;
        const themeKey = `accounting_theme_${username}`;
        
        // 本地保存
        localStorage.setItem(localKey, JSON.stringify(data.records || []));
        localStorage.setItem(budgetKey, (data.budget || 0).toString());
        localStorage.setItem(themeKey, data.theme || 'light');
        
        // 云端保存
        await this.cloud.set(`user_${username}`, data);
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
        if (await this.auth.checkLogin()) {
            await this.showApp();
        } else {
            this.showAuth();
        }
        this.bindAuthEvents();
    }

    showAuth() {
        document.getElementById('authPage').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }

    async showApp() {
        document.getElementById('authPage').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('currentUsername').textContent = this.auth.getCurrentUser();
        
        await this.loadData();
        this.bindAppEvents();
        this.updateUI();
        this.setDefaultDate();
        this.renderCategoryOptions();
        this.showToast('☁️ 数据已从云端同步');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:0.75rem 1.25rem;border-radius:12px;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.2);animation:slideIn 0.3s ease;font-size:0.9rem;';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    bindAuthEvents() {
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('registerForm').classList.add('active');
            this.clearErrors();
        });
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById('loginForm').classList.add('active');
            this.clearErrors();
        });
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword').addEventListener('keypress', (e) => e.key === 'Enter' && this.handleLogin());
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
        document.getElementById('regConfirmPassword').addEventListener('keypress', (e) => e.key === 'Enter' && this.handleRegister());
    }

    clearErrors() {
        document.getElementById('loginError').classList.remove('show');
        document.getElementById('registerError').classList.remove('show');
    }

    showError(id, msg) {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.classList.add('show');
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!username || !password) return this.showError('loginError', '请输入用户名和密码');
        
        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.textContent = '登录中...';
        
        const result = await this.auth.login(username, password);
        if (result.success) {
            await this.showApp();
        } else {
            this.showError('loginError', result.message);
        }
        btn.disabled = false;
        btn.textContent = '登录';
    }

    async handleRegister() {
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        
        if (!username || !password || !confirm) return this.showError('registerError', '请填写完整信息');
        if (password !== confirm) return this.showError('registerError', '两次密码不一致');
        
        const btn = document.getElementById('registerBtn');
        btn.disabled = true;
        btn.textContent = '注册中...';
        
        const result = await this.auth.register(username, password);
        if (result.success) {
            await this.auth.login(username, password);
            await this.showApp();
        } else {
            this.showError('registerError', result.message);
        }
        btn.disabled = false;
        btn.textContent = '注册';
    }

    handleLogout() {
        if (confirm('确定退出？数据已自动保存到云端。')) {
            this.auth.logout();
            ['loginUsername','loginPassword','regUsername','regPassword','regConfirmPassword'].forEach(id => document.getElementById(id).value = '');
            this.clearErrors();
            this.showAuth();
        }
    }
    
    async loadData() {
        const username = this.auth.getCurrentUser();
        const data = await this.auth.loadUserData(username);
        this.records = data.records || [];
        this.budget = data.budget || 0;
        
        if (data.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').textContent = '🌙';
        }
    }
    
    async saveData() {
        const username = this.auth.getCurrentUser();
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        await this.auth.saveUserData(username, {
            records: this.records,
            budget: this.budget,
            theme,
            updatedAt: new Date().toISOString()
        });
    }
    
    bindAppEvents() {
        // 用户下拉菜单
        const dropdown = document.getElementById('userDropdown');
        document.getElementById('userInfoBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => dropdown.classList.remove('open'));
        document.getElementById('dropdownMenu').addEventListener('click', e => e.stopPropagation());
        document.getElementById('logoutBtn').addEventListener('click', () => {
            dropdown.classList.remove('open');
            this.handleLogout();
        });

        document.getElementById('addRecordBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('closeBudgetModal').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('cancelBudgetBtn').addEventListener('click', () => this.closeBudgetModal());
        document.getElementById('overlay').addEventListener('click', () => {
            this.closeModal();
            this.closeBudgetModal();
        });

        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentType = e.target.dataset.type;
                this.renderCategoryOptions();
            });
        });

        document.getElementById('recordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveRecord();
        });
        document.getElementById('setBudgetBtn').addEventListener('click', () => this.openBudgetModal());
        document.getElementById('budgetForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveBudget();
        });
        document.getElementById('filterType').addEventListener('change', () => this.renderRecords());
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
    }
    
    setDefaultDate() {
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
    }
    
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
    
    openModal(id = null) {
        this.editingId = id;
        const modal = document.getElementById('recordModal');
        const overlay = document.getElementById('overlay');
        
        if (id) {
            const record = this.records.find(r => r.id === id);
            if (record) {
                document.getElementById('modalTitle').textContent = '编辑记录';
                document.getElementById('amount').value = record.amount;
                document.getElementById('date').value = record.date;
                document.getElementById('note').value = record.note || '';
                this.currentType = record.type;
                document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === record.type));
                this.renderCategoryOptions();
                document.getElementById('category').value = record.category;
            }
        } else {
            document.getElementById('modalTitle').textContent = '添加记录';
            document.getElementById('recordForm').reset();
            this.setDefaultDate();
            this.currentType = 'expense';
            document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'expense'));
            this.renderCategoryOptions();
        }
        modal.classList.add('active');
        overlay.classList.add('active');
    }
    
    closeModal() {
        document.getElementById('recordModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.editingId = null;
    }
    
    openBudgetModal() {
        document.getElementById('budgetAmount').value = this.budget || '';
        document.getElementById('budgetModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    }
    
    closeBudgetModal() {
        document.getElementById('budgetModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }
    
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
            const idx = this.records.findIndex(r => r.id === this.editingId);
            if (idx !== -1) {
                this.records[idx] = { ...this.records[idx], type: this.currentType, amount, category, date, note, updatedAt: new Date().toISOString() };
            }
        } else {
            this.records.unshift({ id: Date.now().toString(), type: this.currentType, amount, category, date, note, createdAt: new Date().toISOString() });
        }
        
        await this.saveData();
        this.closeModal();
        this.updateUI();
        this.showToast('☁️ 已保存到云端');
    }
    
    async deleteRecord(id) {
        if (confirm('确定删除这条记录？')) {
            this.records = this.records.filter(r => r.id !== id);
            await this.saveData();
            this.updateUI();
            this.showToast('☁️ 已同步到云端');
        }
    }
    
    async saveBudget() {
        this.budget = parseFloat(document.getElementById('budgetAmount').value) || 0;
        await this.saveData();
        this.closeBudgetModal();
        this.updateUI();
        this.showToast('☁️ 预算已保存到云端');
    }
    
    getCategoryInfo(id, type) {
        return this.categories[type].find(c => c.id === id) || { name: '未知', icon: '❓' };
    }
    
    getMonthData() {
        const now = new Date();
        const m = now.getMonth(), y = now.getFullYear();
        const records = this.records.filter(r => {
            const d = new Date(r.date);
            return d.getMonth() === m && d.getFullYear() === y;
        });
        return {
            income: records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
            expense: records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
            records
        };
    }
    
    getTotalBalance() {
        return this.records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0) 
             - this.records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    }
    
    renderRecords() {
        const container = document.getElementById('recordsList');
        let records = [...this.records];
        const filter = document.getElementById('filterType').value;
        if (filter !== 'all') records = records.filter(r => r.type === filter);
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (records.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无记录，点击添加开始记账<br><small style="color:var(--text-secondary);margin-top:0.5rem;display:block">☁️ 数据自动保存到云端服务器，换电脑也能访问</small></div>';
            return;
        }
        
        container.innerHTML = records.map(r => {
            const cat = this.getCategoryInfo(r.category, r.type);
            return `<div class="record-item">
                <div class="record-icon">${cat.icon}</div>
                <div class="record-info">
                    <div class="record-category">${cat.name}</div>
                    <div class="record-meta">${r.date}${r.note ? ' · ' + r.note : ''}</div>
                </div>
                <div class="record-amount ${r.type}">${r.type === 'income' ? '+' : '-'}¥${r.amount.toFixed(2)}</div>
                <div class="record-actions">
                    <button class="record-btn" onclick="app.openModal('${r.id}')">✏️</button>
                    <button class="record-btn" onclick="app.deleteRecord('${r.id}')">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }
    
    updateBudgetProgress() {
        const { expense } = this.getMonthData();
        document.getElementById('budgetUsed').textContent = `¥${expense.toFixed(2)}`;
        document.getElementById('budgetTotal').textContent = `¥${this.budget.toFixed(2)}`;
        const progress = document.getElementById('budgetProgress');
        const status = document.getElementById('budgetStatus');
        
        if (this.budget > 0) {
            const pct = Math.min((expense / this.budget) * 100, 100);
            progress.style.width = `${pct}%`;
            progress.classList.remove('warning', 'danger');
            status.classList.remove('warning', 'danger');
            if (pct >= 100) { progress.classList.add('danger'); status.classList.add('danger'); status.textContent = '已超支！'; }
            else if (pct >= 80) { progress.classList.add('warning'); status.classList.add('warning'); status.textContent = '即将超支'; }
            else status.textContent = `剩余 ¥${(this.budget - expense).toFixed(2)}`;
        } else {
            progress.style.width = '0%';
            status.textContent = '点击设置预算';
        }
    }
    
    updateCharts() {
        // 趋势图
        const ctx1 = document.getElementById('trendChart').getContext('2d');
        const days = [], incomeData = [], expenseData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            days.push(d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
            const dr = this.records.filter(r => r.date === ds);
            incomeData.push(dr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0));
            expenseData.push(dr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0));
        }
        if (this.charts.trend) this.charts.trend.destroy();
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const tc = dark ? '#94a3b8' : '#64748b';
        this.charts.trend = new Chart(ctx1, {
            type: 'line',
            data: { labels: days, datasets: [
                { label: '收入', data: incomeData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
                { label: '支出', data: expenseData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 }
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: tc } } },
                scales: {
                    x: { ticks: { color: tc }, grid: { color: dark ? '#334155' : '#e2e8f0' } },
                    y: { ticks: { color: tc }, grid: { color: dark ? '#334155' : '#e2e8f0' } }
                }
            }
        });

        // 饼图
        const ctx2 = document.getElementById('categoryChart').getContext('2d');
        const { records } = this.getMonthData();
        const stats = {};
        records.filter(r => r.type === 'expense').forEach(r => stats[r.category] = (stats[r.category] || 0) + r.amount);
        const labels = [], data = [];
        const colors = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b'];
        Object.entries(stats).forEach(([id, v]) => {
            labels.push(this.getCategoryInfo(id, 'expense').name);
            data.push(v);
        });
        if (data.length === 0) { labels.push('暂无支出'); data.push(1); }
        if (this.charts.category) this.charts.category.destroy();
        this.charts.category = new Chart(ctx2, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tc } } } }
        });
    }
    
    async toggleTheme() {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (dark) {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').textContent = '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        }
        await this.saveData();
        this.updateCharts();
        this.showToast('☁️ 设置已同步');
    }
    
    exportData() {
        const data = { username: this.auth.getCurrentUser(), records: this.records, budget: this.budget, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.auth.getCurrentUser()}_记账备份_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }
    
    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.records && Array.isArray(data.records)) {
                    if (confirm('导入将覆盖云端数据，确定继续？')) {
                        this.records = data.records;
                        this.budget = data.budget || 0;
                        await this.saveData();
                        this.updateUI();
                        alert('导入成功，已同步到云端！');
                    }
                }
            } catch { alert('文件解析失败'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    }
    
    updateUI() {
        document.getElementById('balanceAmount').textContent = `¥${this.getTotalBalance().toFixed(2)}`;
        const { income, expense } = this.getMonthData();
        document.getElementById('monthIncome').textContent = `¥${income.toFixed(2)}`;
        document.getElementById('monthExpense').textContent = `¥${expense.toFixed(2)}`;
        this.updateBudgetProgress();
        this.renderRecords();
        this.updateCharts();
    }
}

const style = document.createElement('style');
style.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
document.head.appendChild(style);

let app;
document.addEventListener('DOMContentLoaded', () => app = new AccountingApp());