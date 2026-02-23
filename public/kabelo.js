// Kabelo Management System
document.addEventListener('DOMContentLoaded', () => {
    console.log('Kabelo page loaded, checking authentication...');
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize page
    initializePage();
    
    // Event Listeners
    const memberForm = document.getElementById('memberForm');
    const searchInput = document.getElementById('search');
    
    if (memberForm) {
        memberForm.addEventListener('submit', handleMemberRegistration);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
});

// Global variables
let currentMembers = [];
let currentYear = new Date().getFullYear().toString();

async function initializePage() {
    try {
        await fetchMembers();
        displayMembers(currentMembers);
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Failed to load members. Please refresh the page.');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

async function fetchMembers() {
    const token = localStorage.getItem('token');
    
    try {
        console.log('Fetching members from server...');
        const response = await fetch('/api/members', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Fetched members from server:', data);
        currentMembers = data;
    } catch (error) {
        console.error('Error fetching members:', error);
        showError('Failed to fetch members. Please check your connection.');
    }
}

function displayMembers(members) {
    console.log('Displaying', members.length, 'members');
    
    const table = document.getElementById('membersList');
    if (!table) {
        console.error('Table not found!');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.error('Table body not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    const totalCount = document.getElementById('totalCount');
    if (totalCount) {
        totalCount.textContent = `(${members.length})`;
    }
    
    if (members.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="10" style="text-align: center; padding: 40px; color: #666;">
                No members found. Add your first member using the form above.
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    members.forEach((member, index) => {
        const row = document.createElement('tr');
        
        const formattedDate = member.created_at ? 
            new Date(member.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'N/A';
        
        // Get current year receipt
        const currentReceipt = member[`receipt_${currentYear}`] || '';
        
        row.innerHTML = `
            <td>${member.palo || index + 1}</td>
            <td>${member.lebitso || ''}</td>
            <td>${member.fane || ''}</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>N/A</td>
            <td>${formattedDate}</td>
            <td class="receipt-cell">
                <input 
                    type="text" 
                    class="receipt-input ${currentReceipt ? 'receipt-paid' : 'receipt-unpaid'}" 
                    value="${currentReceipt}"
                    placeholder="Enter receipt #"
                    data-member-palo="${member.palo}"
                    data-year="${currentYear}"
                >
                <button class="action-button save-receipt" data-member-palo="${member.palo}" data-year="${currentYear}">
                    ${currentReceipt ? '✏️ Edit' : '💾 Save'}
                </button>
            </td>
            <td>
                <button class="action-button edit-member" data-member-palo="${member.palo}">✏️ Edit</button>
                <button class="action-button delete-member" data-member-palo="${member.palo}">🗑️ Archive</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    addEventListeners();
}

function addEventListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-member').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const memberPalo = button.getAttribute('data-member-palo');
            editMember(memberPalo);
        });
    });
    
    // Archive buttons
    document.querySelectorAll('.delete-member').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const memberPalo = button.getAttribute('data-member-palo');
            archiveMember(memberPalo);
        });
    });
    
    // Save receipt buttons
    document.querySelectorAll('.save-receipt').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const memberPalo = button.getAttribute('data-member-palo');
            const year = button.getAttribute('data-year');
            const input = document.querySelector(`.receipt-input[data-member-palo="${memberPalo}"][data-year="${year}"]`);
            if (input) {
                saveReceipt(memberPalo, year, input.value);
            }
        });
    });
    
    // Enter key on receipt inputs
    document.querySelectorAll('.receipt-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const memberPalo = input.getAttribute('data-member-palo');
                const year = input.getAttribute('data-year');
                saveReceipt(memberPalo, year, input.value);
            }
        });
    });
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayMembers(currentMembers);
        return;
    }
    
    const filteredMembers = currentMembers.filter(member => 
        (member.lebitso && member.lebitso.toLowerCase().includes(searchTerm)) ||
        (member.fane && member.fane.toLowerCase().includes(searchTerm)) ||
        (member.palo && member.palo.toString().includes(searchTerm))
    );
    
    displayMembers(filteredMembers);
}

async function handleMemberRegistration(event) {
    event.preventDefault();
    
    const lebitso = document.getElementById('lebitso').value.trim();
    const fane = document.getElementById('fane').value.trim();
    
    if (!lebitso || !fane) {
        showError('Please fill in both first name and last name');
        return;
    }
    
    const token = localStorage.getItem('token');
    
    try {
        console.log('Registering new member:', { lebitso, fane });
        
        const response = await fetch('/api/members', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lebitso, fane })
        });
        
        console.log('Registration response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to register member');
        }
        
        const result = await response.json();
        console.log('Member registered successfully:', result);
        
        showSuccess('Member registered successfully!');
        document.getElementById('memberForm').reset();
        
        await fetchMembers();
        displayMembers(currentMembers);
        
    } catch (error) {
        console.error('Error registering member:', error);
        showError('Failed to register member: ' + error.message);
    }
}

function editMember(memberPalo) {
    console.log('Edit member clicked:', memberPalo);
    const member = currentMembers.find(m => m.palo === memberPalo);
    if (!member) {
        showError('Member not found');
        return;
    }
    
    // Redirect to details page
    window.location.href = `details.html?type=member&id=${memberPalo}&from=kabelo.html`;
}

function showEditModal(member) {
    // Remove any existing modals
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.3s ease-out;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease-out;
    `;
    
    modal.innerHTML = `
        <h2 style="color: #333; margin-top: 0; padding-bottom: 15px; border-bottom: 2px solid #c19a6b;">
            Edit Member #${member.palo}
        </h2>
        <form id="editMemberForm">
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">
                    First Name (Lebitso):
                </label>
                <input type="text" id="edit-lebitso" value="${member.lebitso || ''}" required
                    style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">
                    Last Name (Fane):
                </label>
                <input type="text" id="edit-fane" value="${member.fane || ''}" required
                    style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box;">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button type="submit" class="btn-primary" 
                    style="padding: 10px 20px; background: #c19a6b; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Update
                </button>
                <button type="button" class="btn-secondary" id="cancelEdit"
                    style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                    Cancel
                </button>
            </div>
        </form>
    `;
    
    // Add styles for animations
    if (!document.querySelector('#modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideDown {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Append to document
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    
    // Add event listeners
    const form = modal.querySelector('#editMemberForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lebitso = document.getElementById('edit-lebitso').value.trim();
        const fane = document.getElementById('edit-fane').value.trim();
        
        if (!lebitso || !fane) {
            alert('Please fill in both fields');
            return;
        }
        
        await updateMember(member.palo, lebitso, fane);
    });
    
    modal.querySelector('#cancelEdit').addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
    
    // Close when clicking overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            modal.remove();
            overlay.remove();
        }
    });
}

async function updateMember(memberPalo, lebitso, fane) {
    const token = localStorage.getItem('token');
    
    try {
        console.log('Updating member:', memberPalo, { lebitso, fane });
        
        const response = await fetch(`/api/members/${memberPalo}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lebitso, fane })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update member');
        }
        
        // Close modal
        document.querySelector('.modal')?.remove();
        document.querySelector('.modal-overlay')?.remove();
        
        showSuccess('Member updated successfully!');
        
        // Refresh members list
        await fetchMembers();
        displayMembers(currentMembers);
        
    } catch (error) {
        console.error('Error updating member:', error);
        showError('Failed to update member: ' + error.message);
    }
}

async function archiveMember(memberPalo) {
    console.log('Archive member clicked:', memberPalo);
    
    if (!confirm('Are you sure you want to archive this member? This action cannot be undone.')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    
    try {
        const reason = prompt('Please enter reason for archiving (Moved or Deceased):', 'Moved');
        if (!reason || !['Moved', 'Deceased'].includes(reason)) {
            showError('Please enter a valid reason: Moved or Deceased');
            return;
        }
        
        console.log('Archiving member:', memberPalo, 'reason:', reason);
        
        const response = await fetch(`/api/members/${memberPalo}/archive`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: reason })
        });
        
        console.log('Archive response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to archive member');
        }
        
        const result = await response.json();
        console.log('Member archived successfully:', result);
        
        await fetchMembers();
        displayMembers(currentMembers);
        
        showSuccess(`Member archived as ${reason}!`);
        
    } catch (error) {
        console.error('Error archiving member:', error);
        showError('Failed to archive member: ' + error.message);
    }
}

async function saveReceipt(memberPalo, year, receiptNumber) {
    const button = document.querySelector(`.save-receipt[data-member-palo="${memberPalo}"][data-year="${year}"]`);
    const input = document.querySelector(`.receipt-input[data-member-palo="${memberPalo}"][data-year="${year}"]`);
    
    if (!button || !input) return;
    
    receiptNumber = receiptNumber.trim();
    
    // Save to server
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/members/${memberPalo}/receipt`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ year, receipt: receiptNumber })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save receipt');
        }
        
        // Update UI
        input.className = `receipt-input ${receiptNumber ? 'receipt-paid' : 'receipt-unpaid'}`;
        button.textContent = receiptNumber ? '✏️ Edit' : '💾 Save';
        
        showSuccess('Receipt saved successfully!');
        
    } catch (error) {
        console.error('Error saving receipt:', error);
        showError('Failed to save receipt: ' + error.message);
    }
}

// Helper functions for showing messages
function showError(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = '#dc3545';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = '#28a745';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
    } else {
        alert(message);
    }
}