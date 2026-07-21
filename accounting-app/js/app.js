// 用户认证管理类
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.SALT_PREFIX = 'accounting_app_salt_';
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

    // 获取所有用户
    getUsers() {
        const users = localStorage.getItem('accounting_users');
        return users ? JSON.parse(users) : {};
    }

    // 保存用户列表
    saveUsers(users) {
        localStorage.setItem('accounting_users', JSON.stringify(users));
    }

    // 注册用户
    register(username, password) {
        const users = this.getUsers();
        
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
        users[username] = {
            username,
            passwordHash: this.hashPassword(password, salt),
            salt,
            createdAt: new Date().toISOString()
        };

        this.saveUsers(users);
        return { success: true, message: '注册成功' };
    }

    // 登录验证
    login(username, password) {
        const users = this.getUsers();
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
        return { success: true, message: '登录成功' };
    }

    // 退出登录
    logout() {
        this.currentUser = null;
        localStorage.removeItem('accounting_current_user');
    }

    // 检查登录状态
    checkLogin() {
        const savedUser = localStorage.getItem('accounting_current_user');
        if (savedUser) {
            const users = this.getUsers();
            if (users[savedUser]) {
                this.currentUser = savedUser;
                return true;
            }
        }
        return false;
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 获取用户数据存储key
    getUserDataKey(type) {
        return `accounting_${type}_${this.currentUser}`;
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
    
    init() {
        // 检查登录状态
        if (this.auth.checkLogin()) {
            this.showApp();
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
    showApp() {
        document.getElementById('authPage').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('currentUsername').textContent = this.auth.getCurrentUser();
        
        this.loadData();
        this.bindAppEvents();
        this.updateUI();
        this.setDefaultDate();
        this.renderCategoryOptions();
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
    handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showError('loginError', '请输入用户名和密码');
            return;
        }

        const result = this.auth.login(username, password);
        if (result.success) {
            this.showApp();
        } else {
            this.showError('loginError', result.message);
        }
    }

    // 处理注册
    handleRegister() {
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

        const result = this.auth.register(username, password);
        if (result.success) {
            // 注册成功自动登录
            this.auth.login(username, password);
            this.showApp();
        } else {
            this.showError('registerError', result.message);
        }
    }

    // 处理退出登录
    handleLogout() {
        if (confirm('确定要退出登录吗？')) {
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
    
    // 从本地存储加载当前用户数据
    loadData() {
        const recordsKey = this.auth.getUserDataKey('records');
        const budgetKey = this.auth.getUserDataKey('budget');
        const themeKey = this.auth.getUserDataKey('theme');
        
        const savedRecords = localStorage.getItem(recordsKey);
        const savedBudget = localStorage.getItem(budgetKey);
        const savedTheme = localStorage.getItem(themeKey);
        
        if (savedRecords) {
            this.records = JSON.parse(savedRecords);
        } else {
            this.records = [];
        }
        if (savedBudget) {
            this.budget = parseFloat(savedBudget);
        } else {
            this.budget = 0;
        }
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').textContent = '🌙';
        }
    }
    
    // 保存当前用户数据到本地存储
    saveData() {
        const recordsKey = this.auth.getUserDataKey('records');
        const budgetKey = this.auth.getUserDataKey('budget');
        localStorage.setItem(recordsKey, JSON.stringify(this.records));
        localStorage.setItem(budgetKey, this.budget.toString());
    }
    
    // 绑定应用事件
    bindAppEvents() {
        // 退出登录
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

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
        document.getElementById('recordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRecord();
        });
        
        // 预算设置
        document.getElementById('setBudgetBtn').addEventListener('click', () => this.openBudgetModal());
        document.getElementById('budgetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveBudget();
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
    saveRecord() {
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
        
        this.saveData();
        this.closeModal();
        this.updateUI();
    }
    
    // 删除记录
    deleteRecord(id) {
        if (confirm('确定要删除这条记录吗？')) {
            this.records = this.records.filter(r => r.id !== id);
            this.saveData();
            this.updateUI();
        }
    }
    
    // 保存预算
    saveBudget() {
        this.budget = parseFloat(document.getElementById('budgetAmount').value) || 0;
        this.saveData();
        const themeKey = this.auth.getUserDataKey('theme');
        localStorage.setItem(themeKey, document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        this.closeBudgetModal();
        this.updateUI();
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
            container.innerHTML = '<div class="empty-state">暂无记录，点击"添加记录"开始记账吧！</div>';
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
    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const btn = document.getElementById('themeToggle');
        const themeKey = this.auth.getUserDataKey('theme');
        
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            btn.textContent = '🌙';
            localStorage.setItem(themeKey, 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            btn.textContent = '☀️';
            localStorage.setItem(themeKey, 'dark');
        }
        
        this.updateCharts();
    }
    
    // 导出数据
    exportData() {
        const data = {
            username: this.auth.getCurrentUser(),
            records: this.records,
            budget: this.budget,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.auth.getCurrentUser()}_记账数据_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // 导入数据
    importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.records && Array.isArray(data.records)) {
                    if (confirm(`导入将覆盖当前用户「${this.auth.getCurrentUser()}」的现有数据，确定继续吗？`)) {
                        this.records = data.records;
                        this.budget = data.budget || 0;
                        this.saveData();
                        this.updateUI();
                        alert('导入成功！');
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

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AccountingApp();
});