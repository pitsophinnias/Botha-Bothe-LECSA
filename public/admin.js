async function fetchUsers() {
    const userCount = document.getElementById('userCount');
    const tbody = document.querySelector('#userTable tbody');
    if (!userCount || !tbody) {
        console.error('User table elements not found');
        return;
    }
    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const users = await response.json();
        userCount.textContent = users.length;
        tbody.innerHTML = '';
        const roles = await fetchRoles();
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border p-2">${user.id}</td>
                <td class="border p-2">${user.username}</td>
                <td class="border p-2">
                    <select class="role-select" data-user-id="${user.id}">
                        ${roles.map(role => `<option value="${role.role_name}" ${user.role === role.role_name ? 'selected' : ''}>${role.role_name}</option>`).join('')}
                    </select>
                </td>
                <td class="border p-2"><button class="action-button update-role" data-user-id="${user.id}">Update Role</button></td>
            `;
            tbody.appendChild(tr);
        });
        document.querySelectorAll('.update-role').forEach(button => {
            button.addEventListener('click', updateUserRole);
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        tbody.innerHTML = '<tr><td colspan="4">Failed to load users.</td></tr>';
    }
}

async function fetchRoles() {
    const tbody = document.querySelector('#roleTable tbody');
    if (!tbody) {
        console.error('Role table not found');
        return [];
    }
    try {
        const response = await fetch('/api/admin/roles', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const roles = await response.json();
        tbody.innerHTML = '';
        roles.forEach(role => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border p-2">${role.role_name}</td>
                <td class="border p-2">${role.can_view ? 'Yes' : 'No'}</td>
                <td class="border p-2">${role.can_add ? 'Yes' : 'No'}</td>
                <td class="border p-2">${role.can_update ? 'Yes' : 'No'}</td>
                <td class="border p-2">${role.can_archive ? 'Yes' : 'No'}</td>
            `;
            tbody.appendChild(tr);
        });
        return roles;
    } catch (err) {
        console.error('Error fetching roles:', err);
        tbody.innerHTML = '<tr><td colspan="5">Failed to load roles.</td></tr>';
        return [];
    }
}

async function fetchActionLogs() {
    const tbody = document.querySelector('#actionLogTable tbody');
    if (!tbody) {
        console.error('Action log table not found');
        return;
    }
    try {
        const response = await fetch('/api/admin/action_logs', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const logs = await response.json();
        tbody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="border p-2">${log.id}</td>
                <td class="border p-2">${log.username}</td>
                <td class="border p-2">${log.action}</td>
                <td class="border p-2">${JSON.stringify(log.details)}</td>
                <td class="border p-2">${new Date(log.timestamp).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error fetching action logs:', err);
        tbody.innerHTML = '<tr><td colspan="5">Failed to load action logs.</td></tr>';
    }
}

async function addRole() {
    const roleNameInput = document.getElementById('roleName');
    const canView = document.getElementById('canView');
    const canAdd = document.getElementById('canAdd');
    const canUpdate = document.getElementById('canUpdate');
    const canArchive = document.getElementById('canArchive');
    
    if (!roleNameInput || !canView || !canAdd || !canUpdate || !canArchive) {
        console.error('Role form elements not found');
        alert('Form elements missing. Please try again.');
        return;
    }
    
    const roleName = roleNameInput.value.trim();
    if (!roleName) {
        alert('Please enter a role name');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/roles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
                role_name: roleName,
                can_view: canView.checked,
                can_add: canAdd.checked,
                can_update: canUpdate.checked,
                can_archive: canArchive.checked
            })
        });
        if (response.ok) {
            alert('Role added successfully');
            fetchRoles();
            roleNameInput.value = '';
            canView.checked = false;
            canAdd.checked = false;
            canUpdate.checked = false;
            canArchive.checked = false;
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to add role');
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

async function updateUserRole(event) {
    const userId = event.target.dataset.userId;
    const select = event.target.parentElement.querySelector('.role-select');
    if (!select) {
        console.error('Role select element not found');
        alert('Role selection missing. Please try again.');
        return;
    }
    const role = select.value;
    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({ role })
        });
        if (response.ok) {
            alert('Role updated successfully');
            fetchUsers();
            fetchActionLogs();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to update role');
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

function logout() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
    } catch (err) {
        console.error('LocalStorage error:', err);
    }
    window.location.href = 'login.html';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    if (sidebar && content) {
        sidebar.classList.toggle('open');
        content.classList.toggle('shift');
    } else {
        console.error('Sidebar or content element not found');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    let token, role;
    try {
        token = localStorage.getItem('token');
        role = localStorage.getItem('role');
    } catch (err) {
        console.error('LocalStorage error:', err);
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/roles', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const roles = await response.json();
        const adminRoles = roles.map(r => r.role_name);
        if (!token || !adminRoles.includes(role)) {
            window.location.href = 'login.html';
            return;
        }
    } catch (err) {
        console.error('Error fetching roles:', err);
        window.location.href = 'login.html';
        return;
    }

    fetchUsers();
    fetchRoles();
    fetchActionLogs();

    const addRoleButton = document.getElementById('addRoleButton');
    if (addRoleButton) {
        addRoleButton.addEventListener('click', addRole);
    }
    
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', logout);
    }
    
    const toggleButton = document.getElementById('toggleSidebar');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
    } else {
        console.error('Toggle button not found');
    }
});