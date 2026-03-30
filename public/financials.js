// Helper: safely convert any value to a float (PostgreSQL returns numerics as strings)
function safeNum(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n; }

// financials.js - Updated with modal centering, custom entries, separate expenses

let currentUser = null;
let financialData = {
    transactions: [],  // All transactions (both income and expense)
    weeks: new Map(),
    sundries: [],
    trustees: []
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Financials page initialized');
    
    checkFinancialsLogin();
    setupFinancialsEventListeners();
    setupFinancialsTabs();
    setDefaultWeekStart();
    loadFinancialData();
});

function checkFinancialsLogin() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        console.log('Logged in as:', currentUser.username);
    } catch (e) {
        console.error('Failed to parse user:', e);
        window.location.href = 'login.html';
    }
}

function setupFinancialsEventListeners() {
    // Income form submission
    const incomeForm = document.getElementById('weeklyIncomeForm');
    if (incomeForm) {
        incomeForm.addEventListener('submit', handleIncomeSubmit);
    }
    
    // Expense form submission
    const expenseForm = document.getElementById('weeklyExpenseForm');
    if (expenseForm) {
        expenseForm.addEventListener('submit', handleExpenseSubmit);
    }
    
    // Clear forms
    const clearIncomeBtn = document.getElementById('clearIncomeForm');
    if (clearIncomeBtn) {
        clearIncomeBtn.addEventListener('click', () => clearForm('income'));
    }
    
    const clearExpenseBtn = document.getElementById('clearExpenseForm');
    if (clearExpenseBtn) {
        clearExpenseBtn.addEventListener('click', () => clearForm('expense'));
    }
    
    // Finish week button
    const finishWeekBtn = document.getElementById('finishWeekBtn');
    if (finishWeekBtn) {
        finishWeekBtn.addEventListener('click', openCloseWeekModal);
    }
    
    // Preview and download buttons
    document.querySelectorAll('.btn-preview').forEach(btn => {
        btn.addEventListener('click', () => openExcelPreview(btn.dataset.period));
    });
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => downloadExcelReport(btn.dataset.period));
    });
    
    // Modal close buttons - FIXED: proper centering
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => closeExcelModal());
    }
    
    const downloadFromModal = document.getElementById('downloadFromModal');
    if (downloadFromModal) {
        downloadFromModal.addEventListener('click', () => {
            const period = document.getElementById('modalTitle').dataset.period;
            downloadExcelReport(period);
            closeExcelModal();
        });
    }
    
    // Close week modal
    const confirmClose = document.getElementById('confirmClose');
    if (confirmClose) {
        confirmClose.addEventListener('click', confirmCloseWeek);
    }
    
    const cancelClose = document.getElementById('cancelClose');
    if (cancelClose) {
        cancelClose.addEventListener('click', () => closeCloseWeekModal());
    }
    
    // Click outside modal to close - FIXED: proper modal closing
    const excelModal = document.getElementById('excelModal');
    if (excelModal) {
        excelModal.addEventListener('click', function(e) {
            if (e.target === excelModal) {
                closeExcelModal();
            }
        });
    }
    
    const closeWeekModal = document.getElementById('closeWeekModal');
    if (closeWeekModal) {
        closeWeekModal.addEventListener('click', function(e) {
            if (e.target === closeWeekModal) {
                closeCloseWeekModal();
            }
        });
    }
    
    // Archive refresh
    const refreshArchive = document.getElementById('refreshArchive');
    if (refreshArchive) {
        refreshArchive.addEventListener('click', loadClosedWeeks);
    }
    
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', loadClosedWeeks);
    }
    
    // Logout
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Sidebar toggle
    setupSidebarToggle();
}

function setupSidebarToggle() {
    const toggleSidebar = document.getElementById('toggleSidebar');
    const menuClose = document.getElementById('menuClose');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    
    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.add('open');
            content.classList.add('shift');
        });
    }
    
    if (menuClose) {
        menuClose.addEventListener('click', () => {
            sidebar.classList.remove('open');
            content.classList.remove('shift');
        });
    }
}

function setupFinancialsTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const reports = document.querySelectorAll('.report-content');
            reports.forEach(r => r.classList.remove('active'));
            
            const reportId = this.dataset.tab + 'Report';
            const activeReport = document.getElementById(reportId);
            if (activeReport) activeReport.classList.add('active');
            
            refreshTabData(this.dataset.tab);
        });
    });
}

function refreshTabData(tabName) {
    switch(tabName) {
        case 'weekly':
            renderWeeklyTable();
            break;
        case 'monthly':
            renderMonthlyTable();
            break;
        case 'quarterly':
            renderQuarterlyTable();
            break;
        case 'yearly':
            renderYearlyTable();
            break;
        case 'sundries':
            renderSundriesTable();
            break;
        case 'trustees':
            renderTrusteesTable();
            break;
    }
}

function setDefaultWeekStart() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const lastMonday = new Date(today.setDate(diff));
    const mondayStr = lastMonday.toISOString().split('T')[0];
    
    const incomeWeekStart = document.getElementById('incomeWeekStart');
    const expenseWeekStart = document.getElementById('expenseWeekStart');
    
    if (incomeWeekStart && !incomeWeekStart.value) {
        incomeWeekStart.value = mondayStr;
    }
    if (expenseWeekStart && !expenseWeekStart.value) {
        expenseWeekStart.value = mondayStr;
    }
    
    document.getElementById('currentWeekStart').textContent = 
        lastMonday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function loadFinancialData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        // Load all transactions
        const response = await fetch('/api/financials/transactions', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (response.ok) {
            financialData.transactions = await response.json();
        }
        
        renderWeeklyTable();
        renderMonthlyTable();
        renderQuarterlyTable();
        renderYearlyTable();
        renderSundriesTable();
        renderTrusteesTable();
        updateFinancialStats();
        updateCurrentWeekStatus();
        loadClosedWeeks();
        
    } catch (error) {
        console.error('Error loading financial data:', error);
    }
}

async function handleIncomeSubmit(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        showFormMessage('Please log in to continue', 'error', 'income');
        return;
    }
    
    const weekStart = document.getElementById('incomeWeekStart').value;
    const church = document.getElementById('incomeChurch').value;
    const categorySelect = document.getElementById('incomeCategorySelect').value;
    const customCategory = document.getElementById('customIncomeCategory').value;
    const amount = parseFloat(document.getElementById('incomeAmount').value);
    const description = document.getElementById('incomeDescription').value;
    
    if (!weekStart) {
        showFormMessage('Please select a week start date', 'error', 'income');
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        showFormMessage('Please enter a valid positive amount', 'error', 'income');
        return;
    }
    
    // Use custom category if provided, otherwise use selected category
    const finalCategory = customCategory.trim() || categorySelect;
    
    const transaction = {
        type: 'income',
        week_start: weekStart,
        church: church,
        category: finalCategory,
        amount: amount,
        description: description || `${finalCategory} - ${church}`,
        date: new Date().toISOString().split('T')[0]
    };
    
    try {
        const response = await fetch('/api/financials/transaction', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transaction)
        });
        
        if (response.ok) {
            showFormMessage('Income recorded successfully!', 'success', 'income');
            clearForm('income');
            loadFinancialData();
            
            const finishBtn = document.getElementById('finishWeekBtn');
            if (finishBtn) {
                finishBtn.style.display = 'inline-block';
            }
        } else {
            const error = await response.json();
            showFormMessage(error.error || 'Failed to record income', 'error', 'income');
        }
    } catch (error) {
        console.error('Error recording income:', error);
        showFormMessage('Network error. Please try again.', 'error', 'income');
    }
}

async function handleExpenseSubmit(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        showFormMessage('Please log in to continue', 'error', 'expense');
        return;
    }
    
    const weekStart = document.getElementById('expenseWeekStart').value;
    const categorySelect = document.getElementById('expenseCategorySelect').value;
    const customCategory = document.getElementById('customExpenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value;
    const recipient = document.getElementById('expenseRecipient').value;
    
    if (!weekStart) {
        showFormMessage('Please select a week start date', 'error', 'expense');
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        showFormMessage('Please enter a valid positive amount', 'error', 'expense');
        return;
    }
    
    // Use custom category if provided, otherwise use selected category
    const finalCategory = customCategory.trim() || categorySelect;
    
    const transaction = {
        type: 'expense',
        week_start: weekStart,
        category: finalCategory,
        amount: amount,
        description: description || `${finalCategory} expense`,
        recipient: recipient || null,
        date: new Date().toISOString().split('T')[0]
    };
    
    try {
        const response = await fetch('/api/financials/transaction', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transaction)
        });
        
        if (response.ok) {
            showFormMessage('Expense recorded successfully!', 'success', 'expense');
            clearForm('expense');
            loadFinancialData();
            
            const finishBtn = document.getElementById('finishWeekBtn');
            if (finishBtn) {
                finishBtn.style.display = 'inline-block';
            }
        } else {
            const error = await response.json();
            showFormMessage(error.error || 'Failed to record expense', 'error', 'expense');
        }
    } catch (error) {
        console.error('Error recording expense:', error);
        showFormMessage('Network error. Please try again.', 'error', 'expense');
    }
}

function clearForm(type) {
    if (type === 'income') {
        document.getElementById('customIncomeCategory').value = '';
        document.getElementById('incomeAmount').value = '';
        document.getElementById('incomeDescription').value = '';
        document.getElementById('incomeCategorySelect').value = 'KABELO';
        showFormMessage('', '', 'income');
    } else if (type === 'expense') {
        document.getElementById('customExpenseCategory').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseRecipient').value = '';
        document.getElementById('expenseCategorySelect').value = 'LIJO';
        showFormMessage('', '', 'expense');
    }
}

function showFormMessage(message, type, formType) {
    const msgDiv = formType === 'income' ? 
        document.getElementById('weeklyIncomeForm').querySelector('.form-message') :
        document.getElementById('weeklyExpenseForm').querySelector('.form-message');
    
    if (!msgDiv) return;
    
    msgDiv.textContent = message;
    msgDiv.className = `form-message ${type}`;
    if (message) {
        setTimeout(() => {
            msgDiv.textContent = '';
            msgDiv.className = 'form-message';
        }, 3000);
    }
}

function updateCurrentWeekStatus() {
    const weekStart = document.getElementById('incomeWeekStart').value;
    const weekTransactions = financialData.transactions.filter(t => t.week_start === weekStart);
    
    let weeklyIncome = 0;
    let weeklyExpenses = 0;
    
    weekTransactions.forEach(t => {
        if (t.type === 'income') {
            weeklyIncome += safeNum(t.amount);
        } else {
            weeklyExpenses += safeNum(t.amount);
        }
    });
    
    document.getElementById('transactionCount').textContent = weekTransactions.length;
    document.getElementById('weeklyTotal').textContent = `LSL ${(weeklyIncome - weeklyExpenses).toFixed(2)}`;
    
    const statusEl = document.getElementById('weekStatus');
    if (weekTransactions.length > 0) {
        statusEl.textContent = 'Open';
        statusEl.className = 'status-open';
    } else {
        statusEl.textContent = 'No Transactions';
        statusEl.className = 'status-empty';
    }
}

function updateFinancialStats() {
    let totalIncome = 0;
    let totalExpenses = 0;
    
    financialData.transactions.forEach(t => {
        if (t.type === 'income') {
            totalIncome += safeNum(t.amount);
        } else {
            totalExpenses += safeNum(t.amount);
        }
    });
    
    document.getElementById('totalIncome').textContent = `LSL ${totalIncome.toFixed(2)}`;
    document.getElementById('totalExpense').textContent = `LSL ${totalExpenses.toFixed(2)}`;
    document.getElementById('netBalance').textContent = `LSL ${(totalIncome - totalExpenses).toFixed(2)}`;
    
    document.getElementById('summaryIncome').textContent = `LSL ${totalIncome.toFixed(2)}`;
    document.getElementById('summaryExpense').textContent = `LSL ${totalExpenses.toFixed(2)}`;
    document.getElementById('summaryBalance').textContent = `LSL ${(totalIncome - totalExpenses).toFixed(2)}`;
}

function renderWeeklyTable() {
    const tbody = document.getElementById('weeklyTableBody');
    if (!tbody) return;
    
    if (financialData.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No transactions available</td></tr>';
        return;
    }
    
    let totalIncome = 0;
    let totalExpenses = 0;
    
    tbody.innerHTML = financialData.transactions.map(t => {
        if (t.type === 'income') {
            totalIncome += safeNum(t.amount);
        } else {
            totalExpenses += safeNum(t.amount);
        }
        
        const amountClass = t.type === 'income' ? 'income-amount' : 'expense-amount';
        const amountPrefix = t.type === 'income' ? '' : '-';
        
        return `
            <tr class="${t.type}-row">
                <td>${new Date(t.week_start).toLocaleDateString()}</td>
                <td>${t.church || '-'}</td>
                <td>${t.category}</td>
                <td><span class="type-badge ${t.type}">${t.type === 'income' ? 'INCOME' : 'EXPENSE'}</span></td>
                <td>${t.description || '-'}</td>
                <td class="${amountClass}">${amountPrefix}LSL ${safeNum(t.amount).toFixed(2)}</td>
                <td>${t.recipient || '-'}</td>
                <td>
                    <button class="btn-small" onclick="editTransaction(${t.id})"><i class="fas fa-edit"></i> Edit</button>
                </td>
            </tr>
        `;
    }).join('');
    
    const tfoot = document.getElementById('weeklyTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background:#f0f0f0; font-weight:bold;">
                <td colspan="5">TOTAL</td>
                <td>LSL ${(totalIncome - totalExpenses).toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>
            <tr style="background:#f8f9fa;">
                <td colspan="5">Income Total</td>
                <td style="color:#27ae60;">LSL ${totalIncome.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>
            <tr style="background:#f8f9fa;">
                <td colspan="5">Expense Total</td>
                <td style="color:#e74c3c;">LSL ${totalExpenses.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>
        `;
    }
}

function renderMonthlyTable() {
    const monthlyMap = new Map();
    
    financialData.transactions.forEach(t => {
        const monthKey = new Date(t.week_start).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' });
        
        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, {
                income: {},
                expenses: {},
                total_income: 0,
                total_expenses: 0
            });
        }
        
        const data = monthlyMap.get(monthKey);
        
        if (t.type === 'income') {
            data.income[t.category] = (data.income[t.category] || 0) + safeNum(t.amount);
            data.total_income += safeNum(t.amount);
        } else {
            data.expenses[t.category] = (data.expenses[t.category] || 0) + safeNum(t.amount);
            data.total_expenses += safeNum(t.amount);
        }
    });
    
    const tbody = document.getElementById('monthlyTableBody');
    if (!tbody) return;
    
    if (monthlyMap.size === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No monthly data available</td></tr>';
        return;
    }
    
    let totalIncomeAll = 0, totalExpensesAll = 0;
    const sortedMonths = Array.from(monthlyMap.keys()).sort();
    
    tbody.innerHTML = sortedMonths.map(monthKey => {
        const data = monthlyMap.get(monthKey);
        const net = data.total_income - data.total_expenses;
        totalIncomeAll += data.total_income;
        totalExpensesAll += data.total_expenses;
        
        const monthName = new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Format income categories
        const incomeCategories = Object.entries(data.income)
            .map(([cat, amt]) => `${cat}: LSL ${safeNum(amt).toFixed(2)}`)
            .join('<br>');
        
        const expenseCategories = Object.entries(data.expenses)
            .map(([cat, amt]) => `${cat}: LSL ${safeNum(amt).toFixed(2)}`)
            .join('<br>');
        
        return `
            <tr>
                <td>${monthName}</td>
                <td>${incomeCategories || '-'}</td>
                <td>${expenseCategories || '-'}</td>
                <td style="color:#27ae60;">LSL ${safeNum(data.total_income).toFixed(2)}</td>
                <td style="color:#e74c3c;">LSL ${safeNum(data.total_expenses).toFixed(2)}</td>
                <td style="color: ${net >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${net.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
    
    const tfoot = document.getElementById('monthlyTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background:#f0f0f0; font-weight:bold;">
                <td>TOTAL</td>
                <td colspan="2"></td>
                <td style="color:#27ae60;">LSL ${totalIncomeAll.toFixed(2)}</td>
                <td style="color:#e74c3c;">LSL ${totalExpensesAll.toFixed(2)}</td>
                <td style="color: ${(totalIncomeAll - totalExpensesAll) >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${(totalIncomeAll - totalExpensesAll).toFixed(2)}</td>
            </tr>
        `;
    }
}

function renderQuarterlyTable() {
    const quarterlyMap = new Map();
    
    financialData.transactions.forEach(t => {
        const date = new Date(t.week_start);
        const year = date.getFullYear();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const quarterKey = `${year}-Q${quarter}`;
        
        if (!quarterlyMap.has(quarterKey)) {
            quarterlyMap.set(quarterKey, { total_income: 0, total_expenses: 0, count: 0 });
        }
        
        const data = quarterlyMap.get(quarterKey);
        if (t.type === 'income') {
            data.total_income += safeNum(t.amount);
        } else {
            data.total_expenses += safeNum(t.amount);
        }
        data.count++;
    });
    
    const tbody = document.getElementById('quarterlyTableBody');
    if (!tbody) return;
    
    if (quarterlyMap.size === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No quarterly data available</td></tr>';
        return;
    }
    
    let totalIncomeAll = 0, totalExpensesAll = 0;
    const sortedQuarters = Array.from(quarterlyMap.keys()).sort();
    
    tbody.innerHTML = sortedQuarters.map(quarterKey => {
        const data = quarterlyMap.get(quarterKey);
        const net = data.total_income - data.total_expenses;
        totalIncomeAll += data.total_income;
        totalExpensesAll += data.total_expenses;
        
        return `
            <tr>
                <td>${quarterKey}</td>
                <td style="color:#27ae60;">LSL ${safeNum(data.total_income).toFixed(2)}</td>
                <td style="color:#e74c3c;">LSL ${safeNum(data.total_expenses).toFixed(2)}</td>
                <td style="color: ${net >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${net.toFixed(2)}</td>
                <td>${data.count}</td>
            </tr>
        `;
    }).join('');
    
    const tfoot = document.getElementById('quarterlyTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background:#f0f0f0; font-weight:bold;">
                <td>YEAR TOTAL</td>
                <td style="color:#27ae60;">LSL ${totalIncomeAll.toFixed(2)}</td>
                <td style="color:#e74c3c;">LSL ${totalExpensesAll.toFixed(2)}</td>
                <td style="color: ${(totalIncomeAll - totalExpensesAll) >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${(totalIncomeAll - totalExpensesAll).toFixed(2)}</td>
                <td></td>
            </tr>
        `;
    }
}

function renderYearlyTable() {
    const yearlyMap = new Map();
    
    financialData.transactions.forEach(t => {
        const year = new Date(t.week_start).getFullYear();
        
        if (!yearlyMap.has(year)) {
            yearlyMap.set(year, { total_income: 0, total_expenses: 0, months: new Set() });
        }
        
        const data = yearlyMap.get(year);
        if (t.type === 'income') {
            data.total_income += safeNum(t.amount);
        } else {
            data.total_expenses += safeNum(t.amount);
        }
        data.months.add(new Date(t.week_start).getMonth());
    });
    
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    
    if (yearlyMap.size === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No yearly data available</td></tr>';
        return;
    }
    
    let totalIncomeAll = 0, totalExpensesAll = 0;
    const sortedYears = Array.from(yearlyMap.keys()).sort().reverse();
    
    tbody.innerHTML = sortedYears.map(year => {
        const data = yearlyMap.get(year);
        const net = data.total_income - data.total_expenses;
        const avgMonthly = data.total_income / Math.max(data.months.size, 1);
        totalIncomeAll += data.total_income;
        totalExpensesAll += data.total_expenses;
        
        return `
            <tr>
                <td>${year}</td>
                <td style="color:#27ae60;">LSL ${safeNum(data.total_income).toFixed(2)}</td>
                <td style="color:#e74c3c;">LSL ${safeNum(data.total_expenses).toFixed(2)}</td>
                <td style="color: ${net >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${net.toFixed(2)}</td>
                <td>LSL ${avgMonthly.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
    
    const tfoot = document.getElementById('yearlyTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background:#f0f0f0; font-weight:bold;">
                <td>TOTAL</td>
                <td style="color:#27ae60;">LSL ${totalIncomeAll.toFixed(2)}</td>
                <td style="color:#e74c3c;">LSL ${totalExpensesAll.toFixed(2)}</td>
                <td style="color: ${(totalIncomeAll - totalExpensesAll) >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${(totalIncomeAll - totalExpensesAll).toFixed(2)}</td>
                <td></td>
            </tr>
        `;
    }
}

function renderSundriesTable() {
    const tbody = document.getElementById('sundriesTableBody');
    if (!tbody) return;
    
    // Filter sundries (custom income categories)
    const sundries = financialData.transactions.filter(t => 
        t.type === 'income' && 
        !['KABELO', 'PITSO', 'THUTHUHO', 'MOKOTLA I', 'MOKOTLA II', 'MEKETE', 'MEA HO', 'BOITLAMO', 'BOSHOME'].includes(t.category)
    );
    
    if (sundries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No sundries data available</td></tr>';
        return;
    }
    
    let totalAll = 0;
    tbody.innerHTML = sundries.map(s => {
        totalAll += s.amount;
        const monthName = new Date(s.week_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `
            <tr>
                <td>${monthName}</td>
                <td>${s.category}</td>
                <td>${s.description || '-'}</td>
                <td style="color:#27ae60;">LSL ${safeNum(s.amount).toFixed(2)}</td>
            </tr>
        `;
    }).join('');
    
    const tfoot = document.getElementById('sundriesTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background:#f0f0f0; font-weight:bold;">
                <td colspan="3">TOTAL</td>
                <td style="color:#27ae60;">LSL ${totalAll.toFixed(2)}</td>
            </tr>
        `;
    }
}

function renderTrusteesTable() {
    const tbody = document.getElementById('trusteesTableBody');
    if (!tbody) return;
    
    // Filter trustees (specific categories)
    const trusteeCategories = ['THUTHUHO', 'LETSIBOLO', 'BLUE CROSS', 'BA BACHA', 'BIBELE', 'LITSI TSA BOPHELO', 'BABALEHI', 'LEETO LA THAPELO'];
    const trustees = financialData.transactions.filter(t => 
        t.type === 'income' && trusteeCategories.includes(t.category)
    );
    
    if (trustees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No trustees data available</td></tr>';
        return;
    }
    
    let totalAll = 0;
    tbody.innerHTML = trustees.map(t => {
        totalAll += safeNum(t.amount);
        const monthName = new Date(t.week_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `
            <tr>
                <td>${monthName}</td>
                <td>${t.category}</td>
                <td>${t.description || t.church ? `${t.church} - ${t.category}` : '-'}</td>
                <td style="color:#27ae60;">LSL ${safeNum(t.amount).toFixed(2)}</td>
            </tr>
        `;
    }).join('');
    
    const tfoot = document.getElementById('trusteesTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background:#f0f0f0; font-weight:bold;">
                <td colspan="3">TOTAL</td>
                <td style="color:#27ae60;">LSL ${totalAll.toFixed(2)}</td>
            </tr>
        `;
    }
}

async function loadClosedWeeks() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const monthFilter = document.getElementById('monthFilter');
        let url = '/api/financials/closed-weeks';
        if (monthFilter && monthFilter.value) {
            const [year, month] = monthFilter.value.split('-');
            url += `?year=${year}&month=${month}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (response.ok) {
            const weeks = await response.json();
            const tbody = document.querySelector('#closedWeeksTable tbody');
            
            if (!tbody) return;
            
            if (weeks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No closed weeks found</td></tr>';
                return;
            }
            
            tbody.innerHTML = weeks.map(week => `
                <tr>
                    <td>${new Date(week.week_start).toLocaleDateString()}</td>
                    <td>${new Date(week.week_end).toLocaleDateString()}</td>
                    <td style="color:#27ae60;">LSL ${(week.income_total || 0).toFixed(2)}</td>
                    <td style="color:#e74c3c;">LSL ${(week.expense_total || 0).toFixed(2)}</td>
                    <td style="color: ${(week.net_balance || 0) >= 0 ? '#27ae60' : '#e74c3c'};">LSL ${(week.net_balance || 0).toFixed(2)}</td>
                    <td>${week.transaction_count || 0}</td>
                    <td>${week.closed_by || 'System'}</td>
                    <td><button class="btn-small" onclick="viewWeekDetails(${week.id})"><i class="fas fa-eye"></i> View</button></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading closed weeks:', error);
    }
}

function openCloseWeekModal() {
    const weekStart = document.getElementById('incomeWeekStart').value;
    if (!weekStart) {
        showFormMessage('Please select a week start date first', 'error', 'income');
        return;
    }
    
    // Calculate week totals
    const weekTransactions = financialData.transactions.filter(t => t.week_start === weekStart);
    let totalIncome = 0;
    let totalExpenses = 0;
    
    weekTransactions.forEach(t => {
        if (t.type === 'income') {
            totalIncome += safeNum(t.amount);
        } else {
            totalExpenses += safeNum(t.amount);
        }
    });
    
    document.getElementById('modalWeekStart').textContent = 
        new Date(weekStart).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('modalTotalIncome').textContent = `LSL ${totalIncome.toFixed(2)}`;
    document.getElementById('modalTotalExpenses').textContent = `LSL ${totalExpenses.toFixed(2)}`;
    document.getElementById('modalNetBalance').textContent = `LSL ${(totalIncome - totalExpenses).toFixed(2)}`;
    document.getElementById('modalTransactionCount').textContent = weekTransactions.length;
    
    document.getElementById('closeWeekModal').style.display = 'flex';
}

function closeCloseWeekModal() {
    document.getElementById('closeWeekModal').style.display = 'none';
}

async function confirmCloseWeek() {
    const weekStart = document.getElementById('incomeWeekStart').value;
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/financials/close-week', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ week_start: weekStart })
        });
        
        if (response.ok) {
            showFormMessage('Week closed successfully!', 'success', 'income');
            closeCloseWeekModal();
            loadFinancialData();
            
            const finishBtn = document.getElementById('finishWeekBtn');
            if (finishBtn) {
                finishBtn.style.display = 'none';
            }
        } else {
            const error = await response.json();
            showFormMessage(error.error || 'Failed to close week', 'error', 'income');
        }
    } catch (error) {
        console.error('Error closing week:', error);
        showFormMessage('Network error. Please try again.', 'error', 'income');
    }
}

function openExcelPreview(period) {
    const modal = document.getElementById('excelModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    const periodLabels = {
        weekly:    'LIKOLEKE (Weekly Ledger)',
        monthly:   'TLALEHO EA KHOELI (Monthly Report)',
        quarterly: 'TLALEHO EA KOTARA (Quarterly Report)',
        yearly:    'TLALEHO EA SELEMO (Annual Report)',
        sundries:  'SUNDRIES Report',
        trustees:  'TRUSTEES Report',
    };

    modalTitle.textContent = `${periodLabels[period] || period.toUpperCase()} - Excel Preview`;
    modalTitle.dataset.period = period;
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="loading" style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Loading preview...</div>';

    loadExcelPreview(period, modalBody);
}

async function loadExcelPreview(period, modalBody) {
    try {
        const token = localStorage.getItem('token');
        if (!token) { modalBody.innerHTML = '<p style="color:red;text-align:center;">Please log in.</p>'; return; }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const quarter = Math.ceil(month / 3);

        let url = `/api/financials/preview?period=${period}&year=${year}&month=${month}&quarter=${quarter}`;

        const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!resp.ok) throw new Error('Server error: ' + resp.status);
        const data = await resp.json();
        const transactions = (data.transactions || []).map(t => ({...t, amount: parseFloat(t.amount)||0}));

        modalBody.innerHTML = buildPreviewHTML(period, transactions, year, month, quarter);

    } catch (err) {
        console.error('Preview error:', err);
        modalBody.innerHTML = `<p style="color:red;text-align:center;padding:20px;">
            Could not load preview: ${err.message}<br>
            <small>Use the Download Excel button to get the full report.</small></p>`;
    }
}

function fmtM(n) {
    if (!n) return '-';
    return 'M ' + parseFloat(n).toLocaleString('en-ZA', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtD(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-ZA', {day:'2-digit', month:'short', year:'numeric'});
}

const MONTHS_PREVIEW = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const CHURCHES_PREVIEW = ['BBC','BB MOPELI','MAKONG','LIKHUTLONG'];

const INCOME_COLS_PREVIEW  = ['Moaho','Kabelo','Pitso/Khopotso','Thuthuho','Mokotla I','Mokotla II','Pledge','Others','TOTAL'];
const EXPENSE_COLS_PREVIEW = ['Lijo','Transport','Allow.','Morutuoa','Phone','WASCO/LEC','Maint.','Station.','Konsistori','Other','TOTAL'];

const INC_MAP_PREVIEW = {
    'KABELO':'Kabelo','PITSO':'Pitso/Khopotso','THUTHUHO':'Thuthuho',
    'MOKOTLA I':'Mokotla I','MOKOTLA II':'Mokotla II',
    'MEA HO':'Moaho','BOITLAMO':'Pledge',
    'BOSHOME':'Others','MEKETE':'Others','TLATSETSO':'Others','TLHOEKISO':'Others',
    'BALISA':'Others','NTLAFATSO':'Others','BOIKHUTSO':'Others',
};
const EXP_MAP_PREVIEW = {
    'LIJO':'Lijo','TRANSPORT':'Transport','ALLOWANCES':'Allow.','MORUTUOA':'Morutuoa',
    'PHONE':'Phone','WASCO':'WASCO/LEC','LEC':'WASCO/LEC',
    'MAINTENANCE':'Maint.','STATIONERY':'Station.','KONSISTORI':'Konsistori',
    'OTHER':'Other','SEABO':'Other','NTLAFATSO':'Other',
};

function buildPreviewHTML(period, transactions, year, month, quarter) {
    const TH = (t,style='') => `<th style="background:#c19a6b;color:#fff;padding:6px 8px;border:1px solid #999;font-size:11px;white-space:nowrap;${style}">${t}</th>`;
    const TD = (t,style='') => `<td style="padding:5px 7px;border:1px solid #ddd;font-size:11px;${style}">${t===null||t===undefined?'-':t}</td>`;
    const TDR = (n,style='') => TD(n===0?'0.00':n?parseFloat(n).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2}):'-', 'text-align:right;'+style);
    const TRTOTAL = (cells) => `<tr style="background:#f0ede6;font-weight:bold;">${cells}</tr>`;
    const wrap = (inner) => `<div style="overflow-x:auto;font-family:Arial,sans-serif;">${inner}</div>`;
    const table = (inner,style='') => `<table style="border-collapse:collapse;min-width:100%;${style}">${inner}</table>`;

    if (period === 'weekly') {
        // Group by week_start, then church
        const weeks = {};
        transactions.forEach(t => {
            const wk = t.week_start;
            if (!weeks[wk]) weeks[wk] = {};
            const ch = (t.church||'UNKNOWN').toUpperCase();
            if (!weeks[wk][ch]) weeks[wk][ch] = {income:{},expense:{}};
            const amt = t.amount||0;
            if (t.type==='income') { const c=INC_MAP_PREVIEW[t.category]||'Others'; weeks[wk][ch].income[c]=(weeks[wk][ch].income[c]||0)+amt; }
            else { const c=EXP_MAP_PREVIEW[t.category]||'Other'; weeks[wk][ch].expense[c]=(weeks[wk][ch].expense[c]||0)+amt; }
        });

        let thead = `<thead><tr>${TH('DATE')}${TH('KEREKE')}`;
        INCOME_COLS_PREVIEW.forEach(c => thead += TH(c,'background:#1a5c2a;'));
        EXPENSE_COLS_PREVIEW.forEach(c => thead += TH(c,'background:#7a1515;'));
        thead += '</tr></thead>';

        let tbody = '<tbody>';
        Object.keys(weeks).sort().forEach(wk => {
            const chtData = weeks[wk];
            const weekTotals = {income:{},expense:{}};
            CHURCHES_PREVIEW.forEach((ch,ci) => {
                const d = chtData[ch]||{income:{},expense:{}};
                let row = `<tr style="background:${ci%2?'#fff':'#fafaf5'}">`;
                row += ci===0 ? TD(fmtD(wk),'font-weight:bold;') : TD('');
                row += TD(ch);
                let incTotal=0;
                INCOME_COLS_PREVIEW.slice(0,-1).forEach(c => {
                    const v=d.income[c]||0; incTotal+=v;
                    row += v>0 ? TDR(v,'background:#f5fff5;') : TD('-');
                    weekTotals.income[c]=(weekTotals.income[c]||0)+v;
                });
                row += TDR(incTotal||0,'font-weight:bold;background:#e8f5e9;');
                weekTotals.income['TOTAL']=(weekTotals.income['TOTAL']||0)+incTotal;
                let expTotal=0;
                EXPENSE_COLS_PREVIEW.slice(0,-1).forEach(c => {
                    const v=d.expense[c]||0; expTotal+=v;
                    row += v>0 ? TDR(v,'background:#fff5f5;') : TD('-');
                    weekTotals.expense[c]=(weekTotals.expense[c]||0)+v;
                });
                row += TDR(expTotal||0,'font-weight:bold;background:#fdecea;');
                weekTotals.expense['TOTAL']=(weekTotals.expense['TOTAL']||0)+expTotal;
                row += '</tr>';
                tbody += row;
            });
            // TOTAL row
            let trow = TRTOTAL(`${TD('','background:#f0ede6;')}${TD('TOTAL','font-weight:bold;background:#f0ede6;')}`);
            // rebuild total row properly
            trow = `<tr style="background:#f0ede6;font-weight:bold;">`;
            trow += TD('','background:#f0ede6;') + TD('TOTAL','background:#f0ede6;font-weight:bold;');
            let wIncTot=0;
            INCOME_COLS_PREVIEW.slice(0,-1).forEach(c=>{
                const v=weekTotals.income[c]||0; wIncTot+=v;
                trow+=TDR(v,'background:#d4edda;font-weight:bold;');
            });
            trow+=TDR(wIncTot,'background:#a8d5b5;font-weight:bold;');
            let wExpTot=0;
            EXPENSE_COLS_PREVIEW.slice(0,-1).forEach(c=>{
                const v=weekTotals.expense[c]||0; wExpTot+=v;
                trow+=TDR(v,'background:#f8d7da;font-weight:bold;');
            });
            trow+=TDR(wExpTot,'background:#f1aeb5;font-weight:bold;');
            trow+='</tr><tr><td colspan="100" style="height:6px;background:#e9ecef;border:none;"></td></tr>';
            tbody += trow;
        });

        if (!Object.keys(weeks).length) tbody += `<tr><td colspan="100" style="text-align:center;padding:30px;color:#666;">No transactions found.</td></tr>`;
        tbody += '</tbody>';
        return wrap(table(thead+tbody));
    }

    if (period === 'monthly') {
        const byMonth = {};
        transactions.forEach(t => {
            const m = new Date(t.week_start||t.transaction_date).getMonth()+1;
            if (!byMonth[m]) byMonth[m]={income:0,expense:0,cats:{}};
            const amt=t.amount||0;
            if(t.type==='income'){byMonth[m].income+=amt;}
            else{byMonth[m].expense+=amt;}
            const cat=t.category||'Other';
            byMonth[m].cats[cat]=(byMonth[m].cats[cat]||0)+(t.type==='income'?amt:-amt);
        });

        let html = `<h4 style="font-family:Arial;text-align:center;margin-bottom:8px;">KEREKE EA EVANGELI LESOTHO — PARISHE EA BOTHA BOTHE<br>TLALEHO EA LICHELETE ${year}</h4>`;
        html += table(`<thead><tr>${TH('KHOELI (Month)')}${TH('Total Income (M)')}${TH('Total Expenses (M)')}${TH('Net Balance (M)')}${TH('Transactions')}</tr></thead><tbody>`+
            Object.keys(byMonth).sort((a,b)=>a-b).map((m,i)=>{
                const d=byMonth[m]; const net=d.income-d.expense;
                return `<tr style="background:${i%2?'#fff':'#fafaf5'}">
                    ${TD(MONTHS_PREVIEW[m-1]+' '+year)}
                    ${TDR(d.income,'color:#1a5c2a;')}
                    ${TDR(d.expense,'color:#7a1515;')}
                    ${TDR(net,'color:'+(net>=0?'#1a5c2a':'#7a1515')+';font-weight:bold;')}
                    ${TD(Object.values(d.cats).length,'text-align:center;')}
                </tr>`;
            }).join('')+
            (() => {
                const tInc=Object.values(byMonth).reduce((s,d)=>s+d.income,0);
                const tExp=Object.values(byMonth).reduce((s,d)=>s+d.expense,0);
                const tNet=tInc-tExp;
                return TRTOTAL(`${TD('KAKARETSO (TOTAL)','font-weight:bold;')}${TDR(tInc,'color:#1a5c2a;')}${TDR(tExp,'color:#7a1515;')}${TDR(tNet,'color:'+(tNet>=0?'#1a5c2a':'#7a1515')+';')}${TD('')}`);
            })()+
        '</tbody>');
        return wrap(html);
    }

    if (period === 'quarterly') {
        const qMonths = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
        let html = `<h4 style="font-family:Arial;text-align:center;margin-bottom:8px;">KEREKE EA EVANGELI LESOTHO — PARISHE EA BOTHA BOTHE<br>TLALEHO EA KOTARA ${year}</h4>`;
        html += table(`<thead><tr>${TH('KOTARA')}${TH('Months')}${TH('Income (M)')}${TH('Expenses (M)')}${TH('Net Balance (M)')}</tr></thead><tbody>`+
            [1,2,3,4].map((q,i)=>{
                const mNums=qMonths[q];
                let inc=0,exp=0;
                transactions.filter(t=>{
                    const m=new Date(t.week_start||t.transaction_date).getMonth()+1;
                    return mNums.includes(m);
                }).forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount;});
                const net=inc-exp;
                return `<tr style="background:${i%2?'#fff':'#fafaf5'}">
                    ${TD('Q'+q+' '+year,'font-weight:bold;')}
                    ${TD(mNums.map(m=>MONTHS_PREVIEW[m-1].substring(0,3)).join(' / '))}
                    ${TDR(inc,'color:#1a5c2a;')}
                    ${TDR(exp,'color:#7a1515;')}
                    ${TDR(net,'color:'+(net>=0?'#1a5c2a':'#7a1515')+';font-weight:bold;')}
                </tr>`;
            }).join('')+
        '</tbody>');
        return wrap(html);
    }

    if (period === 'yearly') {
        const byYear = {};
        transactions.forEach(t => {
            const y = new Date(t.week_start||t.transaction_date).getFullYear();
            if (!byYear[y]) byYear[y]={income:0,expense:0};
            if(t.type==='income') byYear[y].income+=t.amount||0;
            else byYear[y].expense+=t.amount||0;
        });

        let html = `<h4 style="font-family:Arial;text-align:center;margin-bottom:8px;">
            KEREKE EA EVANGELI LESOTHO E BOROA HO AFRIKA<br>
            PARISHE EA BOTHA BOTHE LECSA<br>
            TLALEHO EA LICHELETE EA SELEMO</h4>`;
        html += table(
            `<thead><tr>${TH('SELEMO (Year)')}${TH('TSE KENENG (Income) M')}${TH('TSE TSOILENG (Expenses) M')}${TH('NET BALANCE M')}${TH('Avg Monthly Income M')}</tr></thead><tbody>`+
            Object.keys(byYear).sort().reverse().map((y,i)=>{
                const d=byYear[y]; const net=d.income-d.expense;
                return `<tr style="background:${i%2?'#fff':'#fafaf5'}">
                    ${TD(y,'font-weight:bold;')}
                    ${TDR(d.income,'color:#1a5c2a;')}
                    ${TDR(d.expense,'color:#7a1515;')}
                    ${TDR(net,'color:'+(net>=0?'#1a5c2a':'#7a1515')+';font-weight:bold;')}
                    ${TDR(d.income/12,'color:#555;')}
                </tr>`;
            }).join('')+
            (() => {
                const tI=Object.values(byYear).reduce((s,d)=>s+d.income,0);
                const tE=Object.values(byYear).reduce((s,d)=>s+d.expense,0);
                return TRTOTAL(`${TD('KAKARETSO')}${TDR(tI,'color:#1a5c2a;')}${TDR(tE,'color:#7a1515;')}${TDR(tI-tE,'color:'+(tI>=tE?'#1a5c2a':'#7a1515')+';')}${TD('')}`);
            })()+
        '</tbody>');
        return wrap(html);
    }

    // Sundries / Trustees
    const filtered = period === 'trustees'
        ? transactions.filter(t => t.type==='income' && ['THUTHUHO','LETSIBOLO','BLUE CROSS','BA BACHA','BIBELE','LITSI TSA BOPHELO','BABALEHI','LEETO LA THAPELO'].includes(t.category))
        : transactions.filter(t => t.type==='income' && !['KABELO','PITSO','THUTHUHO','MOKOTLA I','MOKOTLA II','MEKETE','MEA HO','BOITLAMO','BOSHOME'].includes(t.category));

    return wrap(table(
        `<thead><tr>${TH('KHOELI')}${TH('Category')}${TH('Description')}${TH('Amount (M)')}</tr></thead><tbody>`+
        (filtered.length ? filtered.map((t,i)=>`<tr style="background:${i%2?'#fff':'#fafaf5'}">
            ${TD(fmtD(t.week_start))}${TD(t.category)}${TD(t.description||'-')}${TDR(t.amount,'color:#1a5c2a;')}
        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;padding:30px;color:#666;">No data found.</td></tr>`)+
        '</tbody>'
    ));
}


function closeExcelModal() {
    const modal = document.getElementById('excelModal');
    modal.style.display = 'none';
}

async function downloadExcelReport(period, weekStart) {
    const token = localStorage.getItem('token');
    if (!token) { alert('Please log in to download reports'); return; }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    let url = `/api/financials/download?period=${period}&year=${year}&month=${month}&quarter=${quarter}`;
    if (weekStart) url += `&week_start=${weekStart}`;

    try {
        const btn = event && event.target;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...'; }

        const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });

        if (!resp.ok) {
            const err = await resp.json().catch(()=>({error:'Server error'}));
            const msg = resp.status === 503
                ? 'Excel generation is not set up yet.\n\nRun this in your project folder:\n\n  npm install exceljs\n\nThen restart the server.'
                : (err.error || 'Failed to generate Excel file');
            alert(msg);
            if (btn) { btn.disabled=false; btn.innerHTML = '<i class="fas fa-download"></i> Download Excel'; }
            return;
        }

        // Stream the file to browser download
        const blob = await resp.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        const disp = resp.headers.get('Content-Disposition') || '';
        const match = disp.match(/filename="?([^"]+)"?/);
        a.download = match ? match[1] : `LECSA_${period}_${year}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlObj);

        if (btn) { btn.disabled=false; btn.innerHTML = '<i class="fas fa-download"></i> Download Excel'; }
    } catch (err) {
        console.error('Download error:', err);
        alert('Download failed: ' + err.message);
    }
}


function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

function editTransaction(id) {
    alert(`Edit transaction ID: ${id}\n\nThis feature will allow you to edit transaction details.`);
}

function viewWeekDetails(weekId) {
    alert(`Viewing week details for ID: ${weekId}\n\nThis will show all transactions for this closed week.`);
}

// Make functions globally available
window.editTransaction = editTransaction;
window.viewWeekDetails = viewWeekDetails;
// ============ WIPE ALL DATA ============

async function wipeAllData() {
    const confirmed = confirm(
        '⚠️  WIPE ALL FINANCIAL DATA?\n\n' +
        'This will permanently delete:\n' +
        '• All transactions\n' +
        '• All closed weeks\n\n' +
        'This cannot be undone. Type "WIPE" to confirm.'
    );
    if (!confirmed) return;

    const typed = prompt('Type WIPE to confirm:');
    if (typed !== 'WIPE') { alert('Cancelled — nothing was deleted.'); return; }

    const token = localStorage.getItem('token');
    try {
        const resp = await fetch('/api/financials/wipe-all', {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Server error');
        alert('✅ All financial data wiped. Starting fresh!');
        financialData.transactions = [];
        financialData.weeks = new Map();
        financialData.sundries = [];
        financialData.trustees = [];
        renderWeeklyTable();
        renderMonthlyTable();
        renderQuarterlyTable();
        renderYearlyTable();
        updateFinancialStats();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ============ CSV IMPORT ============

function openCsvImportModal() {
    // Build modal HTML if not already present
    if (!document.getElementById('csvImportModal')) {
        const modal = document.createElement('div');
        modal.id = 'csvImportModal';
        modal.style.cssText = `
            display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5);
            z-index:9999; align-items:center; justify-content:center;
        `;
        modal.innerHTML = `
            <div style="background:#fff; border-radius:12px; padding:32px; max-width:640px;
                        width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0; font-size:1.3rem;">📂 Import Historical CSV Report</h2>
                    <button onclick="closeCsvImportModal()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">✕</button>
                </div>

                <div style="background:#f0f7ff; border:1px solid #c3dafe; border-radius:8px; padding:16px; margin-bottom:20px; font-size:0.9rem;">
                    <strong>Expected CSV columns:</strong><br>
                    <code>date, description, category, type, amount</code><br><br>
                    <strong>Optional columns:</strong> <code>week_start, reference, notes</code><br><br>
                    <strong>type</strong> column: use <code>income</code> or <code>expense</code><br>
                    If omitted, type is inferred from the category name.<br>
                    Negative amounts are treated as expenses automatically.
                </div>

                <div style="margin-bottom:16px;">
                    <label style="display:block; font-weight:600; margin-bottom:8px;">Select CSV file(s):</label>
                    <input type="file" id="csvFileInput" accept=".csv" multiple
                           style="width:100%; padding:10px; border:2px dashed #cbd5e0; border-radius:8px; cursor:pointer;">
                </div>

                <div id="csvPreviewArea" style="display:none; margin-bottom:16px;">
                    <div style="font-weight:600; margin-bottom:8px;">Preview (first 5 rows):</div>
                    <div id="csvPreviewTable" style="overflow-x:auto; font-size:0.82rem;"></div>
                    <div id="csvParseStats" style="margin-top:8px; color:#4a5568;"></div>
                </div>

                <div id="csvImportProgress" style="display:none; margin-bottom:16px;">
                    <div style="background:#e2e8f0; border-radius:4px; height:8px; overflow:hidden;">
                        <div id="csvProgressBar" style="background:#4f46e5; height:100%; width:0%; transition:width 0.3s;"></div>
                    </div>
                    <div id="csvProgressText" style="margin-top:6px; font-size:0.85rem; color:#4a5568;"></div>
                </div>

                <div id="csvImportResult" style="display:none; margin-bottom:16px;"></div>

                <div style="display:flex; gap:12px; justify-content:flex-end;">
                    <button onclick="closeCsvImportModal()"
                            style="padding:10px 20px; border:1px solid #cbd5e0; border-radius:8px; background:#fff; cursor:pointer;">
                        Cancel
                    </button>
                    <button id="csvImportBtn" onclick="runCsvImport()" disabled
                            style="padding:10px 24px; background:#4f46e5; color:#fff; border:none;
                                   border-radius:8px; cursor:pointer; font-weight:600; opacity:0.5;">
                        Import Transactions
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Wire up file input
        document.getElementById('csvFileInput').addEventListener('change', handleCsvFileSelect);
    }

    const modal = document.getElementById('csvImportModal');
    modal.style.display = 'flex';
    // Reset state
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvPreviewArea').style.display = 'none';
    document.getElementById('csvImportResult').style.display = 'none';
    document.getElementById('csvImportProgress').style.display = 'none';
    document.getElementById('csvImportBtn').disabled = true;
    document.getElementById('csvImportBtn').style.opacity = '0.5';
    window._csvParsedRows = null;
}

function closeCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    if (modal) modal.style.display = 'none';
}

function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).filter(l => l.trim()).map(line => {
        // Handle quoted fields
        const cols = [];
        let cur = '', inQuote = false;
        for (const ch of line) {
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        cols.push(cur.trim());
        const row = {};
        headers.forEach((h, i) => row[h] = cols[i] || '');
        return row;
    });
}

async function handleCsvFileSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    let allRows = [];
    for (const file of files) {
        const text = await file.text();
        const rows = parseCsv(text);
        allRows = allRows.concat(rows);
    }

    window._csvParsedRows = allRows;

    // Show preview
    const previewArea = document.getElementById('csvPreviewArea');
    const previewTable = document.getElementById('csvPreviewTable');
    const parseStats = document.getElementById('csvParseStats');
    previewArea.style.display = 'block';

    if (allRows.length === 0) {
        previewTable.innerHTML = '<p style="color:#e53e3e;">No rows found. Check CSV format.</p>';
        return;
    }

    const headers = Object.keys(allRows[0]);
    const preview = allRows.slice(0, 5);
    previewTable.innerHTML = `
        <table style="border-collapse:collapse; width:100%;">
            <thead>
                <tr>${headers.map(h => `<th style="border:1px solid #e2e8f0; padding:6px 10px; background:#f7fafc; text-align:left;">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${preview.map(row => `<tr>${headers.map(h => `<td style="border:1px solid #e2e8f0; padding:5px 10px;">${row[h] || ''}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>
    `;
    parseStats.textContent = `${allRows.length} total rows across ${files.length} file(s) ready to import.`;

    const btn = document.getElementById('csvImportBtn');
    btn.disabled = false;
    btn.style.opacity = '1';
}

async function runCsvImport() {
    const rows = window._csvParsedRows;
    if (!rows || rows.length === 0) return;

    const token = localStorage.getItem('token');
    const btn = document.getElementById('csvImportBtn');
    const progress = document.getElementById('csvImportProgress');
    const progressBar = document.getElementById('csvProgressBar');
    const progressText = document.getElementById('csvProgressText');
    const resultDiv = document.getElementById('csvImportResult');

    btn.disabled = true;
    btn.innerHTML = 'Importing...';
    progress.style.display = 'block';
    progressBar.style.width = '30%';
    progressText.textContent = `Sending ${rows.length} rows to server...`;
    resultDiv.style.display = 'none';

    try {
        const resp = await fetch('/api/financials/import-csv', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rows })
        });

        progressBar.style.width = '100%';
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.error || 'Import failed');

        resultDiv.style.display = 'block';
        const hasErrors = data.errors && data.errors.length > 0;
        resultDiv.innerHTML = `
            <div style="background:${data.inserted > 0 ? '#f0fff4' : '#fff5f5'};
                        border:1px solid ${data.inserted > 0 ? '#9ae6b4' : '#feb2b2'};
                        border-radius:8px; padding:16px;">
                <div style="font-weight:700; font-size:1rem; margin-bottom:8px;">
                    ${data.inserted > 0 ? '✅' : '⚠️'} Import Complete
                </div>
                <div>✔ <strong>${data.inserted}</strong> transactions imported</div>
                ${data.skipped > 0 ? `<div>⚠ <strong>${data.skipped}</strong> rows skipped</div>` : ''}
                ${hasErrors ? `
                    <details style="margin-top:10px;">
                        <summary style="cursor:pointer; color:#4a5568;">Show skipped row details</summary>
                        <div style="margin-top:8px; font-size:0.8rem; max-height:120px; overflow-y:auto;">
                            ${data.errors.map(e => `<div>Row ${e.row}: ${e.reason}</div>`).join('')}
                        </div>
                    </details>
                ` : ''}
            </div>
        `;

        // Reload data if anything was imported
        if (data.inserted > 0) {
            await loadFinancialData();
        }

    } catch (err) {
        progressBar.style.width = '100%';
        progressBar.style.background = '#e53e3e';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `<div style="background:#fff5f5; border:1px solid #feb2b2; border-radius:8px; padding:16px; color:#c53030;">
            ❌ Error: ${err.message}
        </div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Import Transactions';
        progressText.textContent = 'Done.';
    }
}

window.wipeAllData = wipeAllData;
window.openCsvImportModal = openCsvImportModal;
window.closeCsvImportModal = closeCsvImportModal;
window.runCsvImport = runCsvImport;