// 记账应用主逻辑
class AccountingApp {
    constructor() {
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
        this.loadData();
        this.bindEvents();
        this.updateUI();
        this.setDefaultDate();
        this.renderCategoryOptions();
    }
    
    // 从本地存储加载数据
    loadData() {
        const savedRecords = localStorage.getItem('accounting_records');
        const savedBudget = localStorage.getItem('accounting_budget');
        const savedTheme = localStorage.getItem('accounting_theme');
        
        if (savedRecords) {
            this.records = JSON.parse(savedRecords);
        }
        if (savedBudget) {
            this.budget = parseFloat(savedBudget);
        }
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        }
    }
    
    // 保存数据到本地存储
    saveData() {
        localStorage.setItem('accounting_records', JSON.stringify(this.records));
        localStorage.setItem('accounting_budget', this.budget.toString());
    }
    
    // 绑定事件
    bindEvents() {
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
        
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            btn.textContent = '🌙';
            localStorage.setItem('accounting_theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            btn.textContent = '☀️';
            localStorage.setItem('accounting_theme', 'dark');
        }
        
        this.updateCharts();
    }
    
    // 导出数据
    exportData() {
        const data = {
            records: this.records,
            budget: this.budget,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `记账数据_${new Date().toISOString().split('T')[0]}.json`;
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
                    if (confirm('导入将覆盖现有数据，确定继续吗？')) {
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