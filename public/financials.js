// financials.js - COMPLETE UPDATED VERSION
document.addEventListener('DOMContentLoaded', function() {
    // Select DOM elements for form, tables, and tab buttons
    const financialForm = document.getElementById('financialForm');
    const tables = {
        weekly: document.getElementById('weeklyTable')?.querySelector('tbody'),
        monthly: document.getElementById('monthlyTable')?.querySelector('tbody'),
        quarterly: document.getElementById('quarterlyTable')?.querySelector('tbody'),
        yearly: document.getElementById('yearlyTable')?.querySelector('tbody'),
        categories: document.getElementById('categoriesTable')?.querySelector('tbody')
    };
    const tabButtons = document.querySelectorAll('.tab-button');

    // Validate DOM elements
    if (!financialForm) {
        console.error('Missing financialForm element');
        alert('Error: Form not found on the page');
        return;
    }
    
    // Check tables
    for (const [period, table] of Object.entries(tables)) {
        if (!table) {
            console.warn(`Missing ${period}Table tbody element`);
        }
    }

    // Handle form submission for recording transactions
    financialForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log('Form submit triggered');
        
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to continue');
            window.location.href = 'login.html';
            return;
        }

        // Build transaction object from form inputs
        const transaction = {
            date: document.getElementById('transactionDate').value,
            description: document.getElementById('description').value,
            category: document.getElementById('category').value,
            amount: parseFloat(document.getElementById('amount').value),
            week_start: document.getElementById('weekStart').value,
            reference: document.getElementById('reference').value || null,
            notes: '' // Add notes field if needed
        };

        console.log('Transaction data to send:', transaction);

        // Validate form inputs
        if (!transaction.date || !transaction.description || !transaction.category || 
            isNaN(transaction.amount) || transaction.amount <= 0) {
            console.error('Invalid form data:', transaction);
            alert('Please fill all fields with valid data (amount must be positive)');
            return;
        }

        try {
            // Send POST request to record transaction
            const response = await fetch('/api/financials', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });

            console.log('Response status:', response.status);
            
            // Check for HTTP errors
            if (!response.ok) {
                let errorText = 'Unknown error';
                try {
                    const errorData = await response.json();
                    errorText = errorData.error || 'Failed to record transaction';
                } catch {
                    errorText = await response.text();
                }
                throw new Error(errorText);
            }

            const result = await response.json();
            console.log('Transaction recorded:', result);
            
            // Show success message
            const formMessage = document.getElementById('formMessage');
            if (formMessage) {
                formMessage.textContent = result.message || 'Transaction recorded successfully';
                formMessage.className = 'form-message success';
                setTimeout(() => {
                    formMessage.textContent = '';
                    formMessage.className = 'form-message';
                }, 3000);
            } else {
                alert(result.message || 'Transaction recorded successfully');
            }
            
            // Reset only specific form fields, keep week start
            const weekStartValue = document.getElementById('weekStart').value;
            document.getElementById('transactionDate').value = '';
            document.getElementById('description').value = '';
            document.getElementById('category').value = '';
            document.getElementById('amount').value = '';
            document.getElementById('reference').value = '';
            
            // Keep week start value
            document.getElementById('weekStart').value = weekStartValue;
            
            // Refresh relevant tables
            fetchTransactions('weekly');
            updateSummary();
            
        } catch (error) {
            console.error('Error recording transaction:', error);
            
            // Show error message
            const formMessage = document.getElementById('formMessage');
            if (formMessage) {
                formMessage.textContent = 'Failed to record transaction: ' + error.message;
                formMessage.className = 'form-message error';
            } else {
                alert('Failed to record transaction: ' + error.message);
            }
        }
    });

    // Initialize tab-switching functionality
    function initializeTabSwitching() {
        // Set up tab-switching event listeners
        tabButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                // Remove active class from all tabs and content
                tabButtons.forEach(function(btn) { btn.classList.remove('active'); });
                document.querySelectorAll('.report-content').forEach(function(content) { content.classList.remove('active'); });

                // Activate the clicked tab and its content
                button.classList.add('active');
                const reportId = button.dataset.tab + 'Report';
                const reportElement = document.getElementById(reportId);
                if (reportElement) {
                    reportElement.classList.add('active');
                    fetchTransactions(button.dataset.tab);
                } else {
                    console.error('Report element not found: ' + reportId);
                }
            });
        });
    }

    // Check if week start date is Monday
    function isMonday(date) {
        const day = new Date(date).getDay();
        return day === 1; // Monday is 1
    }

    // Update form to auto-set Monday
    const transactionDateInput = document.getElementById('transactionDate');
    if (transactionDateInput) {
        transactionDateInput.addEventListener('change', function() {
            const date = this.value;
            if (date && !isMonday(date)) {
                alert('Weekly reports should start on Monday. Please select a Monday date.');
                this.value = '';
            } else {
                // Show finish button
                const finishWeekBtn = document.getElementById('finishWeek');
                if (finishWeekBtn) {
                    finishWeekBtn.style.display = 'inline-block';
                }
            }
        });
    }

    // Handle finishing the week
    const finishWeekBtn = document.getElementById('finishWeek');
    if (finishWeekBtn) {
        finishWeekBtn.addEventListener('click', async function() {
            const weekStart = document.getElementById('transactionDate').value;
            if (!weekStart) {
                alert('Please select a week start date first');
                return;
            }
            
            if (!isMonday(weekStart)) {
                alert('Week must start on Monday');
                return;
            }
            
            if (!confirm('Are you sure you want to close this week\'s book? This will finalize all transactions for the week.')) {
                return;
            }
            
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/financials/close-week', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ week_start: weekStart })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    alert(result.message || 'Week closed successfully! Monthly, Quarterly, and Yearly reports have been updated.');
                    
                    // Hide finish button
                    finishWeekBtn.style.display = 'none';
                    
                    // Reset form
                    const weekStartValue = document.getElementById('weekStart').value;
                    document.getElementById('financialForm').reset();
                    document.getElementById('weekStart').value = weekStartValue;
                    
                    // Refresh all tables
                    fetchTransactions('weekly');
                    fetchTransactions('monthly');
                    fetchTransactions('quarterly');
                    fetchTransactions('yearly');
                    
                    // Update closed weeks display
                    loadClosedWeeks();
                    
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to close week');
                }
            } catch (error) {
                console.error('Error closing week:', error);
                alert('Failed to close week: ' + error.message);
            }
        });
    }

    // Fetch and display transactions for a given period
    async function fetchTransactions(period) {
        const tableBody = tables[period];
        if (!tableBody) {
            console.error(`No table body for period: ${period}`);
            return;
        }

        try {
            // Retrieve JWT token from localStorage
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No token found, please log in');
            }

            // Use different endpoint for categories
            const endpoint = period === 'categories' 
                ? '/api/financials/categories' 
                : `/api/financials?period=${period}`;
            
            // Make API request
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            // Check for HTTP errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch ${period} data`);
            }

            // Parse data
            const data = await response.json();
            console.log(`${period} data fetched:`, data);
            tableBody.innerHTML = ''; // Clear existing table content

            // Handle empty data
            if ((period === 'categories' && (!data.categories || data.categories.length === 0)) ||
                (period !== 'categories' && data.length === 0)) {
                const colspan = period === 'weekly' ? '7' : 
                              period === 'categories' ? '6' : '5';
                tableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 20px;">No ${period} data found</td></tr>`;
                
                // Also update category summary if empty
                if (period === 'categories') {
                    updateCategorySummary(data);
                }
                return;
            }

            // Handle different data structures based on period
            if (period === 'weekly') {
                // Populate weekly table with individual transactions
                let weeklyTotal = 0;
                data.forEach(function(transaction) {
                    const amount = parseFloat(transaction.amount);
                    if (isNaN(amount)) {
                        console.warn(`Invalid amount in ${period} transaction:`, transaction);
                        return;
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(transaction.transaction_date).toLocaleDateString()}</td>
                        <td>${transaction.description}</td>
                        <td>${transaction.category}</td>
                        <td>${transaction.type || (transaction.amount >= 0 ? 'income' : 'expense')}</td>
                        <td style="color: ${transaction.type === 'expense' ? '#e74c3c' : '#27ae60'};">
                            LSL ${Math.abs(amount).toFixed(2)}
                        </td>
                        <td>${transaction.reference || '-'}</td>
                        <td>
                            <button class="action-btn small-btn" onclick="viewTransactionDetails(${transaction.id})">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                    
                    // Add to total (income positive, expense negative)
                    if (transaction.type === 'expense') {
                        weeklyTotal -= amount;
                    } else {
                        weeklyTotal += amount;
                    }
                });
                
                // Update weekly total footer
                const weeklyTotalElement = document.getElementById('weeklyTableTotal');
                if (weeklyTotalElement) {
                    weeklyTotalElement.textContent = `LSL ${weeklyTotal.toFixed(2)}`;
                    weeklyTotalElement.style.color = weeklyTotal >= 0 ? '#27ae60' : '#e74c3c';
                }
                
            } else if (period === 'categories') {
                // Populate categories table
                const categories = data.categories || [];
                const totals = data.totals || {};
                const topCategories = data.top_categories || {};
                
                // Update category summary cards
                updateCategorySummary(data);
                
                // Populate categories table
                categories.forEach(function(category) {
                    const amount = parseFloat(category.total_amount) || 0;
                    const count = parseInt(category.transaction_count) || 0;
                    const typeTotal = category.type === 'income' ? totals.income : totals.expenses;
                    const typePercentage = typeTotal > 0 ? (Math.abs(amount) / typeTotal * 100).toFixed(1) : '0.0';
                    const totalPercentage = totals.amount > 0 ? (Math.abs(amount) / totals.amount * 100).toFixed(1) : '0.0';
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${category.category}</td>
                        <td>
                            <span class="type-badge ${category.type}">
                                ${category.type === 'income' ? 'Income' : 'Expense'}
                            </span>
                        </td>
                        <td>${count}</td>
                        <td style="color: ${category.type === 'expense' ? '#e74c3c' : '#27ae60'}; font-weight: bold;">
                            LSL ${Math.abs(amount).toFixed(2)}
                        </td>
                        <td>${typePercentage}%</td>
                        <td>${totalPercentage}%</td>
                    `;
                    tableBody.appendChild(row);
                });
                
                // Update category totals footer
                const totalCountEl = document.getElementById('categoriesTotalCount');
                const totalAmountEl = document.getElementById('categoriesTotalAmount');
                
                if (totalCountEl) totalCountEl.textContent = totals.transactions || 0;
                if (totalAmountEl) totalAmountEl.textContent = `LSL ${(totals.amount || 0).toFixed(2)}`;
                
            } else {
                // Populate monthly, quarterly, yearly tables with aggregated data
                data.forEach(function(aggregate) {
                    const income = parseFloat(aggregate.income) || 0;
                    const expenses = parseFloat(aggregate.expenses) || 0;
                    const balance = parseFloat(aggregate.balance) || income - expenses;
                    
                    if (isNaN(income) || isNaN(expenses) || isNaN(balance)) {
                        console.warn(`Invalid values in ${period} aggregate:`, aggregate);
                        return;
                    }
                    
                    let periodLabel;
                    if (period === 'monthly') {
                        const monthDate = new Date(aggregate.month);
                        periodLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    } else if (period === 'quarterly') {
                        periodLabel = `Q${aggregate.quarter} ${aggregate.year}`;
                    } else {
                        periodLabel = aggregate.year;
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${periodLabel}</td>
                        <td style="color: #27ae60;">LSL ${income.toFixed(2)}</td>
                        <td style="color: #e74c3c;">LSL ${expenses.toFixed(2)}</td>
                        <td style="color: ${balance >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                            LSL ${balance.toFixed(2)}
                        </td>
                        <td>${aggregate.transaction_count || 0}</td>
                    `;
                    tableBody.appendChild(row);
                });
                
                // Update totals in footer
                updateAggregateTotals(period, data);
            }
            
            // Update summary display for weekly period
            if (period === 'weekly') {
                updateSummary();
            }
            
        } catch (error) {
            console.error(`Error fetching ${period} data:`, error);
            const colspan = period === 'weekly' ? '7' : 
                          period === 'categories' ? '6' : '5';
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${colspan}" style="text-align: center; padding: 20px; color: #e74c3c;">
                        Failed to load ${period} data: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
    
    // Update aggregate totals in table footers
    function updateAggregateTotals(period, data) {
        let totalIncome = 0;
        let totalExpenses = 0;
        let totalBalance = 0;
        
        data.forEach(aggregate => {
            totalIncome += parseFloat(aggregate.income) || 0;
            totalExpenses += parseFloat(aggregate.expenses) || 0;
            totalBalance += parseFloat(aggregate.balance) || (parseFloat(aggregate.income) - parseFloat(aggregate.expenses));
        });
        
        // Update appropriate total elements
        if (period === 'monthly') {
            const incomeEl = document.getElementById('monthlyIncomeTotal');
            const expenseEl = document.getElementById('monthlyExpenseTotal');
            const balanceEl = document.getElementById('monthlyBalanceTotal');
            
            if (incomeEl) incomeEl.textContent = `LSL ${totalIncome.toFixed(2)}`;
            if (expenseEl) expenseEl.textContent = `LSL ${totalExpenses.toFixed(2)}`;
            if (balanceEl) balanceEl.textContent = `LSL ${totalBalance.toFixed(2)}`;
        } else if (period === 'quarterly') {
            const incomeEl = document.getElementById('quarterlyIncomeTotal');
            const expenseEl = document.getElementById('quarterlyExpenseTotal');
            const balanceEl = document.getElementById('quarterlyBalanceTotal');
            
            if (incomeEl) incomeEl.textContent = `LSL ${totalIncome.toFixed(2)}`;
            if (expenseEl) expenseEl.textContent = `LSL ${totalExpenses.toFixed(2)}`;
            if (balanceEl) balanceEl.textContent = `LSL ${totalBalance.toFixed(2)}`;
        } else if (period === 'yearly') {
            const incomeEl = document.getElementById('yearlyIncomeTotal');
            const expenseEl = document.getElementById('yearlyExpenseTotal');
            const balanceEl = document.getElementById('yearlyBalanceTotal');
            
            if (incomeEl) incomeEl.textContent = `LSL ${totalIncome.toFixed(2)}`;
            if (expenseEl) expenseEl.textContent = `LSL ${totalExpenses.toFixed(2)}`;
            if (balanceEl) balanceEl.textContent = `LSL ${totalBalance.toFixed(2)}`;
        }
    }
    
    // Update summary display
    async function updateSummary() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch('/api/financials/summary', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            if (!response.ok) {
                console.log('Summary endpoint not available or error:', response.status);
                return;
            }
            
            const data = await response.json();
            console.log('Summary data received:', data);
            
            // Update current week info
            if (data.current_week) {
                const countEl = document.getElementById('transactionCount');
                const totalEl = document.getElementById('weeklyTotal');
                const statusEl = document.getElementById('weekStatus');
                
                // Convert to numbers and ensure they're valid
                const transactionCount = Number(data.current_week.transaction_count) || 0;
                const weeklyBalance = Number(data.current_week.balance) || 0;
                
                if (countEl) countEl.textContent = transactionCount;
                if (totalEl) totalEl.textContent = `LSL ${weeklyBalance.toFixed(2)}`;
                
                // Update status
                if (statusEl) {
                    statusEl.textContent = transactionCount > 0 ? 'Open' : 'No Transactions';
                    statusEl.className = transactionCount > 0 ? 'status-open' : 'status-empty';
                }
            }
            
            // Update quick summary cards
            if (data.overall) {
                const incomeEl = document.getElementById('totalIncome');
                const expenseEl = document.getElementById('totalExpense');
                const balanceEl = document.getElementById('netBalance');
                
                // Convert to numbers and ensure they're valid
                const totalIncome = Number(data.overall.total_income) || 0;
                const totalExpenses = Number(data.overall.total_expenses) || 0;
                const netBalance = Number(data.overall.net_balance) || 0;
                
                console.log('Summary numbers:', { totalIncome, totalExpenses, netBalance });
                
                if (incomeEl) incomeEl.textContent = `LSL ${totalIncome.toFixed(2)}`;
                if (expenseEl) expenseEl.textContent = `LSL ${totalExpenses.toFixed(2)}`;
                if (balanceEl) balanceEl.textContent = `LSL ${netBalance.toFixed(2)}`;
            }
            
        } catch (error) {
            console.error('Error updating summary:', error);
            // Don't show alert, just log the error
        }
    }
    
    // Update category summary
    function updateCategorySummary(data) {
        const topIncomeCategory = document.getElementById('topIncomeCategory');
        const topIncomeAmount = document.getElementById('topIncomeAmount');
        const topExpenseCategory = document.getElementById('topExpenseCategory');
        const topExpenseAmount = document.getElementById('topExpenseAmount');
        
        const topIncome = data.top_categories?.income;
        const topExpense = data.top_categories?.expense;
        
        if (topIncomeCategory) {
            topIncomeCategory.textContent = topIncome?.category || '-';
        }
        if (topIncomeAmount) {
            topIncomeAmount.textContent = topIncome 
                ? `LSL ${Math.abs(topIncome.total_amount || 0).toFixed(2)}` 
                : 'LSL 0.00';
        }
        if (topExpenseCategory) {
            topExpenseCategory.textContent = topExpense?.category || '-';
        }
        if (topExpenseAmount) {
            topExpenseAmount.textContent = topExpense 
                ? `LSL ${Math.abs(topExpense.total_amount || 0).toFixed(2)}` 
                : 'LSL 0.00';
        }
    }
    
    // Load closed weeks
    async function loadClosedWeeks() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch('/api/financials/closed-weeks', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            if (!response.ok) {
                console.log('Closed weeks endpoint not available yet');
                return;
            }
            
            const data = await response.json();
            const tableBody = document.querySelector('#closedWeeksTable tbody');
            
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (data.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 20px;">
                            No closed weeks found
                        </td>
                    </tr>
                `;
                return;
            }
            
            data.forEach(week => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(week.week_start).toLocaleDateString()}</td>
                    <td>${new Date(week.week_end).toLocaleDateString()}</td>
                    <td style="color: #27ae60;">LSL ${parseFloat(week.income_total || 0).toFixed(2)}</td>
                    <td style="color: #e74c3c;">LSL ${parseFloat(week.expense_total || 0).toFixed(2)}</td>
                    <td style="color: ${(week.net_balance || 0) >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                        LSL ${parseFloat(week.net_balance || 0).toFixed(2)}
                    </td>
                    <td>${week.closed_by || 'Unknown'}</td>
                    <td>
                        <button class="action-btn small-btn" onclick="viewWeekDetails(${week.id})">
                            <i class="fas fa-eye"></i> Details
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading closed weeks:', error);
        }
    }
    
    // Initialize export buttons
    function initializeExportButtons() {
        document.querySelectorAll('.export-button').forEach(button => {
            button.addEventListener('click', function() {
                const period = this.dataset.period;
                exportToCSV(period);
            });
        });
    }
    
    // Export data to CSV
    async function exportToCSV(period) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please log in to export data');
                return;
            }
            
            // Use different endpoint for categories
            const endpoint = period === 'categories' 
                ? '/api/financials/categories' 
                : `/api/financials?period=${period}`;
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch data for export');
            }
            
            const data = await response.json();
            
            // Check if data is empty
            let hasData = false;
            if (period === 'categories') {
                hasData = data.categories && data.categories.length > 0;
            } else {
                hasData = data.length > 0;
            }
            
            if (!hasData) {
                alert(`No ${period} data to export`);
                return;
            }
            
            // Convert data to CSV
            let csvContent = '';
            
            if (period === 'weekly') {
                // Weekly transaction CSV
                csvContent = 'Date,Description,Category,Type,Amount,Reference\n';
                data.forEach(transaction => {
                    csvContent += `"${new Date(transaction.transaction_date).toLocaleDateString()}","${transaction.description}","${transaction.category}","${transaction.type || 'income'}","${transaction.amount}","${transaction.reference || ''}"\n`;
                });
            } else if (period === 'categories') {
                // Categories CSV
                csvContent = 'Category,Type,Transaction Count,Total Amount\n';
                data.categories.forEach(category => {
                    csvContent += `"${category.category}","${category.type}","${category.transaction_count}","${category.total_amount}"\n`;
                });
            } else {
                // Aggregate CSV (monthly, quarterly, yearly)
                csvContent = 'Period,Income,Expenses,Balance,Transaction Count\n';
                data.forEach(aggregate => {
                    let periodLabel;
                    if (period === 'monthly') {
                        const monthDate = new Date(aggregate.month);
                        periodLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    } else if (period === 'quarterly') {
                        periodLabel = `Q${aggregate.quarter} ${aggregate.year}`;
                    } else {
                        periodLabel = aggregate.year;
                    }
                    
                    csvContent += `"${periodLabel}","${aggregate.income || 0}","${aggregate.expenses || 0}","${aggregate.balance || 0}","${aggregate.transaction_count || 0}"\n`;
                });
            }
            
            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `financials_${period}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            alert(`${period} data exported successfully!`);
            
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Failed to export data: ' + error.message);
        }
    }
    
    // Make helper functions available globally
    window.viewTransactionDetails = function(id) {
        alert(`Viewing transaction details for ID: ${id}\n\nThis would show more detailed information in a modal.`);
        // You could implement a modal here to show full transaction details
    };
    
    window.viewWeekDetails = function(id) {
        alert(`Viewing week details for ID: ${id}\n\nThis would show all transactions for this closed week.`);
        // You could implement a modal here to show week details
    };

    // Initialize everything when page loads
    initializeTabSwitching();
    initializeExportButtons();
    
    // Fetch initial data
    fetchTransactions('weekly');
    updateSummary();
    loadClosedWeeks();
    
    // Set up auto-refresh for transaction date min
    const weekStartInput = document.getElementById('weekStart');
    const transDateInput = document.getElementById('transactionDate');
    
    if (weekStartInput && transDateInput) {
        weekStartInput.addEventListener('change', function() {
            transDateInput.min = this.value;
        });
        
        // Set initial min date
        if (weekStartInput.value) {
            transDateInput.min = weekStartInput.value;
        }
    }
    
    // Set up month filter for closed weeks
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', function() {
            // You could implement filtering by month here
            console.log('Filter by month:', this.value);
        });
    }
    
    // Set up refresh button for archive
    const refreshArchiveBtn = document.getElementById('refreshArchive');
    if (refreshArchiveBtn) {
        refreshArchiveBtn.addEventListener('click', function() {
            loadClosedWeeks();
        });
    }
    
    // Set up clear form button
    const clearFormBtn = document.getElementById('clearForm');
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', function() {
            document.getElementById('financialForm').reset();
            document.getElementById('formMessage').textContent = '';
            document.getElementById('formMessage').className = 'form-message';
            
            // Reset week start to current Monday
            if (weekStartInput) {
                const today = new Date();
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                const lastMonday = new Date(today.setDate(diff));
                weekStartInput.value = lastMonday.toISOString().split('T')[0];
            }
        });
    }
    
    // Add CSS for type badges
    const style = document.createElement('style');
    style.textContent = `
        .type-badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .type-badge.income {
            background-color: #e8f5e9;
            color: #2e7d32;
        }
        .type-badge.expense {
            background-color: #ffebee;
            color: #c62828;
        }
    `;
    document.head.appendChild(style);
});