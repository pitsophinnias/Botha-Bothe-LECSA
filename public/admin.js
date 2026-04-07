// admin.js — LECSA Admin Dashboard
// Handles: users (list, add, role-change, delete, pw-reset), roles (list, add, edit, delete), action logs

const API = {
    headers: () => ({ 
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, 
        'Content-Type': 'application/json' 
    }),
    get: (url) => fetch(url, { headers: API.headers() }),
    post: (url, body) => fetch(url, { 
        method: 'POST',   
        headers: API.headers(), 
        body: JSON.stringify(body) 
    }),
    put: (url, body) => fetch(url, { 
        method: 'PUT',    
        headers: API.headers(), 
        body: JSON.stringify(body) 
    }),
    delete: (url) => fetch(url, { 
        method: 'DELETE', 
        headers: API.headers() 
    }),
};

// ── State ────────────────────────────────────────────────────────────────────
let allUsers = [];
let allRoles = [];
let allLogs  = [];

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');

    if (!token || !['admin', 'pastor'].includes(role)) {
        window.location.href = 'login.html';
        return;
    }

    // Tab switching
    document.querySelectorAll('.tabs-bar button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tabs-bar button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('logoutLink')?.addEventListener('click', logout);

    await Promise.all([fetchUsers(), fetchRoles(), fetchActionLogs()]);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function roleBadge(role) {
    const known = ['admin','pastor','secretary','board_member','user'];
    const cls   = known.includes(role) ? role : 'custom';
    return `<span class="role-badge ${cls}">${role}</span>`;
}

function permChip(val, label) {
    return `<span class="perm-chip ${val ? 'perm-yes' : 'perm-no'}">${label}</span>`;
}

function openModal(id)  { 
    document.getElementById(id).classList.add('open'); 
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('open'); 
}

// Close modals when clicking outside
document.addEventListener('click', e => {
    if (e.target.classList.contains('a-modal-overlay')) {
        e.target.classList.remove('open');
    }
});

function updateStats() {
    document.getElementById('statUsers').textContent  = allUsers.length;
    document.getElementById('statRoles').textContent  = allRoles.length;
    document.getElementById('statLogs').textContent   = allLogs.length;
    document.getElementById('statAdmins').textContent = allUsers.filter(u => ['admin','pastor'].includes(u.role)).length;
}

// ── USERS ─────────────────────────────────────────────────────────────────────
async function fetchUsers() {
    try {
        const resp = await API.get('/api/admin/users');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        allUsers = await resp.json();
        renderUsers(allUsers);
        updateStats();
        populateRoleSelects();
    } catch (err) {
        console.error('Error fetching users:', err);
        document.getElementById('userTableBody').innerHTML =
            '<tr><td colspan="5" class="empty-state" style="color:#e74c3c;">Failed to load users: ' + err.message + '</td></tr>';
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('userTableBody');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found.</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="color:#bdc3c7;font-size:.8rem;">${u.id}</td>
            <td><strong>${u.username}</strong></td>
            <td>
                <select class="role-inline" data-user-id="${u.id}" onchange="quickRoleChange('${u.id}', this.value)">
                    ${allRoles.map(r => `<option value="${r.role_name}" ${u.role === r.role_name ? 'selected' : ''}>${r.role_name}</option>`).join('')}
                </select>
            </td>
            <td style="font-size:.8rem;color:#95a5a6;">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
            <td>
                <button class="btn-xs btn-warning" onclick="openResetPwModal('${u.id}', '${u.username}')">
                    <i class="fas fa-key"></i> Reset PW
                </button>
                <button class="btn-xs btn-danger" style="margin-left:4px;" onclick="deleteUser('${u.id}', '${u.username}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    renderUsers(allUsers.filter(u => u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)));
}

async function quickRoleChange(userId, newRole) {
    try {
        const resp = await API.put(`/api/admin/users/${userId}/role`, { role: newRole });
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Failed to update role'); 
            await fetchUsers(); 
            return; 
        }
        // Update local state
        const u = allUsers.find(x => x.id === userId);
        if (u) u.role = newRole;
        updateStats();
        alert('Role updated successfully!');
    } catch (err) {
        console.error('Error updating role:', err);
        alert('Network error: ' + err.message);
        await fetchUsers();
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Delete user "${username}"?\n\nThis cannot be undone.`)) return;
    try {
        const resp = await API.delete(`/api/admin/users/${userId}`);
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Delete failed'); 
            return; 
        }
        alert(data.message);
        await fetchUsers();
        await fetchActionLogs();
    } catch (err) {
        console.error('Error deleting user:', err);
        alert('Network error: ' + err.message);
    }
}

// Add user
function openAddUserModal() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    populateRoleSelects();
    openModal('addUserModal');
}

async function submitAddUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role     = document.getElementById('newUserRole').value;

    if (!username) { alert('Username is required.'); return; }
    if (!password || password.length < 6) { alert('Password must be at least 6 characters.'); return; }

    try {
        const resp = await API.post('/api/auth/register', { username, password });
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Registration failed'); 
            return; 
        }

        // If a non-default role was chosen, update it immediately
        if (role && role !== 'user') {
            const userId = data.user?.id;
            if (userId) {
                const roleResp = await API.put(`/api/admin/users/${userId}/role`, { role });
                if (!roleResp.ok) {
                    console.error('Failed to update role');
                }
            }
        }

        closeModal('addUserModal');
        alert('User created successfully!');
        await fetchUsers();
        await fetchActionLogs();
    } catch (err) {
        console.error('Error creating user:', err);
        alert('Network error: ' + err.message);
    }
}

// Reset password
function openResetPwModal(userId, username) {
    document.getElementById('resetPwUserId').value = userId;
    document.getElementById('resetPwLabel').textContent = `Resetting password for: ${username}`;
    document.getElementById('resetPwValue').value = '';
    openModal('resetPwModal');
}

async function submitResetPassword() {
    const userId      = document.getElementById('resetPwUserId').value;
    const new_password = document.getElementById('resetPwValue').value;
    if (!new_password || new_password.length < 6) { 
        alert('Password must be at least 6 characters.'); 
        return; 
    }

    try {
        const resp = await API.post(`/api/admin/users/${userId}/reset-password`, { new_password });
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Reset failed'); 
            return; 
        }
        alert(`✓ ${data.message}`);
        closeModal('resetPwModal');
        await fetchActionLogs();
    } catch (err) {
        console.error('Error resetting password:', err);
        alert('Network error: ' + err.message);
    }
}

// ── ROLES ─────────────────────────────────────────────────────────────────────
async function fetchRoles() {
    try {
        const resp = await API.get('/api/admin/roles');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        allRoles = await resp.json();
        renderRoles();
        updateStats();
        populateRoleSelects();
    } catch (err) {
        console.error('Error fetching roles:', err);
        document.getElementById('roleTableBody').innerHTML =
            '<tr><td colspan="6" class="empty-state" style="color:#e74c3c;">Failed to load roles: ' + err.message + '</td></tr>';
    }
}

function renderRoles() {
    const tbody = document.getElementById('roleTableBody');
    if (!allRoles.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No roles found.</td></tr>';
        return;
    }
    const LOCKED = ['admin','pastor'];
    tbody.innerHTML = allRoles.map(r => {
        const locked = LOCKED.includes(r.role_name);
        return `
        <tr>
            <td>${roleBadge(r.role_name)}${locked ? ' <i class="fas fa-lock" style="color:#bdc3c7;font-size:.7rem;" title="Locked"></i>' : ''}</td>
            <td>${permChip(r.can_view, 'View')}</td>
            <td>${permChip(r.can_add, 'Add')}</td>
            <td>${permChip(r.can_update, 'Update')}</td>
            <td>${permChip(r.can_archive, 'Archive')}</td>
            <td>
                ${locked ? '<span style="font-size:.78rem;color:#bdc3c7;">Protected</span>' : `
                <button class="btn-xs btn-primary" onclick="openEditRoleModal('${r.role_name}', ${r.can_view}, ${r.can_add}, ${r.can_update}, ${r.can_archive})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-xs btn-danger" style="margin-left:4px;" onclick="deleteRole('${r.role_name}')">
                    <i class="fas fa-trash"></i>
                </button>`}
            </td>
        </tr>`;
    }).join('');
}

function populateRoleSelects() {
    ['newUserRole'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = allRoles.map(r =>
            `<option value="${r.role_name}" ${r.role_name === current ? 'selected' : ''}>${r.role_name}</option>`
        ).join('');
    });
}

// Add role
function openAddRoleModal() {
    document.getElementById('addRoleName').value = '';
    ['addCanView','addCanAdd','addCanUpdate','addCanArchive'].forEach(id => {
        document.getElementById(id).checked = false;
    });
    openModal('addRoleModal');
}

async function submitAddRole() {
    const role_name   = document.getElementById('addRoleName').value.trim();
    const can_view    = document.getElementById('addCanView').checked;
    const can_add     = document.getElementById('addCanAdd').checked;
    const can_update  = document.getElementById('addCanUpdate').checked;
    const can_archive = document.getElementById('addCanArchive').checked;

    if (!role_name) { 
        alert('Role name is required.'); 
        return; 
    }

    try {
        const resp = await API.post('/api/admin/roles', { role_name, can_view, can_add, can_update, can_archive });
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Failed to create role'); 
            return; 
        }
        alert(`✓ Role "${role_name}" created.`);
        closeModal('addRoleModal');
        await fetchRoles();
        await fetchUsers();
    } catch (err) {
        console.error('Error creating role:', err);
        alert('Network error: ' + err.message);
    }
}

// Edit role
function openEditRoleModal(role_name, can_view, can_add, can_update, can_archive) {
    document.getElementById('editRoleName').value = role_name;
    document.getElementById('editRoleLabel').textContent = `Editing permissions for: ${role_name}`;
    document.getElementById('editCanView').checked    = can_view;
    document.getElementById('editCanAdd').checked     = can_add;
    document.getElementById('editCanUpdate').checked  = can_update;
    document.getElementById('editCanArchive').checked = can_archive;
    openModal('editRoleModal');
}

async function submitEditRole() {
    const role_name   = document.getElementById('editRoleName').value;
    const can_view    = document.getElementById('editCanView').checked;
    const can_add     = document.getElementById('editCanAdd').checked;
    const can_update  = document.getElementById('editCanUpdate').checked;
    const can_archive = document.getElementById('editCanArchive').checked;

    try {
        const resp = await API.put(`/api/admin/roles/${role_name}`, { can_view, can_add, can_update, can_archive });
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Update failed'); 
            return; 
        }
        alert('Role updated successfully!');
        closeModal('editRoleModal');
        await fetchRoles();
    } catch (err) {
        console.error('Error updating role:', err);
        alert('Network error: ' + err.message);
    }
}

// Delete role
async function deleteRole(role_name) {
    if (!confirm(`Delete role "${role_name}"?\n\nAny users with this role will be moved to the "user" role.`)) return;
    try {
        const resp = await API.delete(`/api/admin/roles/${role_name}`);
        const data = await resp.json();
        if (!resp.ok) { 
            alert(data.error || 'Delete failed'); 
            return; 
        }
        alert(`✓ ${data.message}`);
        await fetchRoles();
        await fetchUsers();
    } catch (err) {
        console.error('Error deleting role:', err);
        alert('Network error: ' + err.message);
    }
}

// ── ACTION LOGS ───────────────────────────────────────────────────────────────
async function fetchActionLogs() {
    const limit = document.getElementById('logLimit')?.value || 100;
    try {
        const resp = await API.get(`/api/admin/action_logs?limit=${limit}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        allLogs = await resp.json();
        renderLogs(allLogs);
        updateStats();
    } catch (err) {
        console.error('Error fetching logs:', err);
        document.getElementById('logTableBody').innerHTML =
            '<tr><td colspan="5" class="empty-state" style="color:#e74c3c;">Failed to load logs: ' + err.message + '</td></tr>';
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('logTableBody');
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No logs found.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(log => {
        let details = '';
        try {
            const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            details = Object.entries(d || {}).map(([k,v]) => `<span style="color:#555;">${k}:</span> ${v}`).join(' &bull; ');
        } catch { 
            details = String(log.details || ''); 
        }

        return `
        <tr>
            <td style="color:#bdc3c7;font-size:.78rem;">${log.id}</td>
            <td><strong>${log.username || 'System'}</strong></td>
            <td><span class="log-action">${log.action}</span></td>
            <td class="log-details">${details}</td>
            <td class="log-time">${new Date(log.timestamp).toLocaleString()}</td>
        </tr>`;
    }).join('');
}

function filterLogs() {
    const q = document.getElementById('logSearch').value.toLowerCase();
    renderLogs(allLogs.filter(l =>
        (l.username || '').toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        JSON.stringify(l.details || '').toLowerCase().includes(q)
    ));
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}