// Global variables
let currentUser = null;
let currentBaptisms = [];

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Baptisms page loaded, checking authentication...');
    
    // Check authentication
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    
    if (!token || !user || !role) {
        console.log('No valid authentication found, redirecting to login');
        showNotification('Please log in to access this page', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        console.log('Authenticated as:', currentUser.username);
        
        // Initialize the page
        initializeBaptismsPage();
        
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        showNotification('Session expired, please log in again', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
});

function initializeBaptismsPage() {
    console.log('Initializing Baptisms page for user:', currentUser.username);
    
    // Get DOM elements
    const baptismForm = document.getElementById('baptismForm');
    const searchInput = document.getElementById('searchInput');
    
    // Set up form submission
    if (baptismForm && currentUser.role !== 'board_member') {
        baptismForm.addEventListener('submit', handleBaptismSubmit);
    } else if (baptismForm) {
        // Disable form for board members
        baptismForm.querySelectorAll('input, button').forEach(element => {
            element.disabled = true;
        });
        baptismForm.querySelector('button').textContent = 'Add Baptism (Read Only)';
    }
    
    // Set up search
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            const searchTerm = searchInput.value.trim();
            loadBaptisms(searchTerm);
        }, 300));
    }
    
    // Setup sidebar
    setupSidebar();
    
    // Initial load of baptisms
    loadBaptisms();
}

function setupSidebar() {
    const toggleButton = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const menuClose = document.getElementById('menuClose');
    const logoutLink = document.getElementById('logoutLink');

    if (toggleButton && sidebar && content) {
        toggleButton.addEventListener('click', function() {
            sidebar.classList.toggle('open');
            content.classList.toggle('shift');
        });
    }

    if (menuClose) {
        menuClose.addEventListener('click', function() {
            sidebar.classList.remove('open');
            content.classList.remove('shift');
        });
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    showNotification('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}

async function handleBaptismSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    const baptismData = {
        first_name: formData.get('first_name').trim(),
        middle_name: formData.get('middle_name').trim(),
        surname: formData.get('surname').trim(),
        date_of_birth: formData.get('date_of_birth'),
        father_first_name: formData.get('father_first_name').trim(),
        father_middle_name: formData.get('father_middle_name').trim(),
        father_surname: formData.get('father_surname').trim(),
        mother_first_name: formData.get('mother_first_name').trim(),
        mother_middle_name: formData.get('mother_middle_name').trim(),
        mother_surname: formData.get('mother_surname').trim(),
        baptism_date: formData.get('baptism_date'),
        pastor: formData.get('pastor').trim()
    };

    // Validate required fields
    const requiredFields = [
        'first_name', 'surname', 'date_of_birth', 'father_first_name', 'father_surname',
        'mother_first_name', 'mother_surname', 'baptism_date', 'pastor'
    ];
    
    const emptyFields = requiredFields.filter(field => !baptismData[field]);
    if (emptyFields.length > 0) {
        showNotification(`Please fill in all required fields: ${emptyFields.join(', ')}`, 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/baptisms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(baptismData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add baptism');
        }

        const result = await response.json();
        showNotification(result.message || 'Baptism added successfully', 'success');
        event.target.reset();
        loadBaptisms();

    } catch (error) {
        console.error('Error adding baptism:', error);
        showNotification('Failed to add baptism: ' + error.message, 'error');
    }
}

async function loadBaptisms(search = '') {
    const baptismList = document.getElementById('baptismList');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/baptisms?search=${encodeURIComponent(search)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch baptisms');
        }

        const baptisms = await response.json();
        currentBaptisms = baptisms;

        baptismList.innerHTML = baptisms.map(b => {
            const formatDate = (dateStr) => {
                if (!dateStr) return 'N/A';
                return new Date(dateStr).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            };

            return `
                <tr>
                    <td class="border p-2">${b.first_name || ''}</td>
                    <td class="border p-2">${b.middle_name || ''}</td>
					<td class="border p-2">${b.surname || ''}</td>
                    <td class="border p-2">${formatDate(b.baptism_date)}</td>
                    <td class="border p-2">
                        <button style="background-color: #3498db; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;" 
                                onclick="viewDetails(${b.id})">
                            Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading baptisms:', error);
        showNotification('Failed to load baptisms: ' + error.message, 'error');
    }
}

async function viewDetails(id) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Session expired, please log in again', 'error');
            setTimeout(() => window.location.href = 'login.html', 1000);
            return;
        }

        const response = await fetch(`/api/baptisms/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch baptism details');
        }

        const baptism = await response.json();
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        `;

        // Format date helper
        const formatDate = (dateStr) => {
            if (!dateStr) return 'N/A';
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Modal content
        let buttonsHtml = `
            <button id="printCert" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                Print Certificate
            </button>
            <button id="closeModal" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close
            </button>
        `;
        
        if (currentUser.role !== 'board_member') {
            buttonsHtml = `
                <button id="editBtn" style="padding: 8px 16px; background: #ffc107; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    Edit
                </button>
            ` + buttonsHtml;
        }

        modal.innerHTML = `
            <h2 style="margin-bottom: 15px;">Baptism Details</h2>
            <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                <div>
                    <strong>First Name:</strong> ${baptism.first_name || ''}
                </div>
                <div>
                    <strong>Middle Name:</strong> ${baptism.middle_name || ''}
                </div>
                <div>
                    <strong>Surname:</strong> ${baptism.surname || ''}
                </div>
                <div>
                    <strong>Date of Birth:</strong> ${formatDate(baptism.date_of_birth)}
                </div>
                <div>
                    <strong>Father's Name:</strong> ${baptism.father_first_name || ''} ${baptism.father_middle_name || ''} ${baptism.father_surname || ''}
                </div>
                <div>
                    <strong>Mother's Name:</strong> ${baptism.mother_first_name || ''} ${baptism.mother_middle_name || ''} ${baptism.mother_surname || ''}
                </div>
                <div>
                    <strong>Baptism Date:</strong> ${formatDate(baptism.baptism_date)}
                </div>
                <div>
                    <strong>Pastor:</strong> ${baptism.pastor || 'N/A'}
                </div>
                <div>
                    <strong>Record ID:</strong> ${baptism.id}
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                ${buttonsHtml}
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close button
        document.getElementById('closeModal').addEventListener('click', () => {
            modal.remove();
            overlay.remove();
        });

        // Print certificate
        document.getElementById('printCert').addEventListener('click', () => {
            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Baptism Certificate</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .certificate { border: 2px solid #000; padding: 20px; max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .header h1 { font-size: 24px; margin: 0; }
                        .header h3 { font-size: 18px; margin: 5px 0; }
                        .content { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                        .section { margin-bottom: 15px; }
                        .section h3 { border-bottom: 1px solid #000; padding-bottom: 5px; }
                        .signature { margin-top: 40px; text-align: right; }
                        .footer { margin-top: 20px; font-size: 12px; text-align: center; }
                        @media print {
                            body { margin: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="certificate">
                        <div class="header">
                            <img src="/images/logo.jpg" alt="Botha-Bothe LECSA Parish" style="width: 150px; margin-bottom: 20px;">
                            <h1>BAPTISM CERTIFICATE</h1>
                            <h3>Botha-Bothe LECSA Parish</h3>
                        </div>
                        <div class="section">
                            <h3>Child's Information</h3>
                            <p><strong>Names:</strong> ${baptism.first_name} ${baptism.middle_name || ''} ${baptism.surname}</p>
                            <p><strong>Date of Birth:</strong> ${formatDate(baptism.date_of_birth)}</p>
                        </div>
                        <div class="content">
                            <div class="section">
                                <h3>Father's Information</h3>
                                <p><strong>Names:</strong> ${baptism.father_first_name} ${baptism.father_middle_name || ''} ${baptism.father_surname}</p>
                            </div>
                            <div class="section">
                                <h3>Mother's Information</h3>
                                <p><strong>Names:</strong> ${baptism.mother_first_name} ${baptism.mother_middle_name || ''} ${baptism.mother_surname}</p>
                            </div>
                        </div>
                        <div class="section">
                            <h3>Baptism Details</h3>
                            <p><strong>Date:</strong> ${formatDate(baptism.baptism_date)}</p>
                            <p><strong>Officiating Pastor:</strong> ${baptism.pastor}</p>
                        </div>
                        <div class="signature">
                            <p>_________________________</p>
                            <p><strong>Pastor:</strong> ${baptism.pastor}</p>
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        <div class="footer">
                            <p>This certifies that the above baptism was recorded in the Botha-Bothe LECSA Parish Registry</p>
                        </div>
                    </div>
                    <div class="no-print" style="text-align: center; margin-top: 20px;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Print Certificate
                        </button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                            Close
                        </button>
                    </div>
                </body>
                </html>
            `;
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
        });
        
        // Edit button if available
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                modal.remove();
                overlay.remove();
                showEditModal(baptism);
            });
        }
        
        // Close when clicking overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                modal.remove();
                overlay.remove();
            }
        });

    } catch (error) {
        console.error('Error loading baptism details:', error);
        showNotification('Failed to load baptism details: ' + error.message, 'error');
    }
}

function showEditModal(baptism) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
    `;

    modal.innerHTML = `
        <h2 style="margin-bottom: 15px;">Edit Baptism Record</h2>
        <form id="editBaptismForm">
            <div style="margin-bottom: 10px;">
                <label for="first_name">First Name:</label>
                <input type="text" id="first_name" name="first_name" value="${baptism.first_name || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="middle_name">Middle Name:</label>
                <input type="text" id="middle_name" name="middle_name" value="${baptism.middle_name || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="surname">Surname:</label>
                <input type="text" id="surname" name="surname" value="${baptism.surname || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="date_of_birth">Date of Birth:</label>
                <input type="date" id="date_of_birth" name="date_of_birth" value="${baptism.date_of_birth ? baptism.date_of_birth.split('T')[0] : ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="father_first_name">Father's First Name:</label>
                <input type="text" id="father_first_name" name="father_first_name" value="${baptism.father_first_name || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="father_middle_name">Father's Middle Name:</label>
                <input type="text" id="father_middle_name" name="father_middle_name" value="${baptism.father_middle_name || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="father_surname">Father's Surname:</label>
                <input type="text" id="father_surname" name="father_surname" value="${baptism.father_surname || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="mother_first_name">Mother's First Name:</label>
                <input type="text" id="mother_first_name" name="mother_first_name" value="${baptism.mother_first_name || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="mother_middle_name">Mother's Middle Name:</label>
                <input type="text" id="mother_middle_name" name="mother_middle_name" value="${baptism.mother_middle_name || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="mother_surname">Mother's Surname:</label>
                <input type="text" id="mother_surname" name="mother_surname" value="${baptism.mother_surname || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="baptism_date">Baptism Date:</label>
                <input type="date" id="baptism_date" name="baptism_date" value="${baptism.baptism_date ? baptism.baptism_date.split('T')[0] : ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="pastor">Pastor:</label>
                <input type="text" id="pastor" name="pastor" value="${baptism.pastor || ''}" required>
            </div>
            <div style="text-align: right;">
                <button type="submit" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    Save Changes
                </button>
                <button type="button" id="cancelEdit" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle form submit
    const editForm = document.getElementById('editBaptismForm');
    editForm.addEventListener('submit', (e) => handleEditSubmit(e, baptism.id, overlay, modal));

    // Cancel button
    document.getElementById('cancelEdit').addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            modal.remove();
            overlay.remove();
        }
    });
}

async function handleEditSubmit(event, id, overlay, modal) {
    event.preventDefault();
    
    const form = document.getElementById('editBaptismForm');
    const formData = new FormData(form);
    
    const baptismData = {
        first_name: formData.get('first_name').trim(),
        middle_name: formData.get('middle_name').trim(),
        surname: formData.get('surname').trim(),
        date_of_birth: formData.get('date_of_birth'),
        father_first_name: formData.get('father_first_name').trim(),
        father_middle_name: formData.get('father_middle_name').trim(),
        father_surname: formData.get('father_surname').trim(),
        mother_first_name: formData.get('mother_first_name').trim(),
        mother_middle_name: formData.get('mother_middle_name').trim(),
        mother_surname: formData.get('mother_surname').trim(),
        baptism_date: formData.get('baptism_date'),
        pastor: formData.get('pastor').trim()
    };

    // Validate required fields
    const requiredFields = [
        'first_name', 'surname', 'date_of_birth', 'father_first_name', 'father_surname',
        'mother_first_name', 'mother_surname', 'baptism_date', 'pastor'
    ];
    
    const emptyFields = requiredFields.filter(field => !baptismData[field]);
    if (emptyFields.length > 0) {
        showNotification(`Please fill in all required fields: ${emptyFields.join(', ')}`, 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/baptisms/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(baptismData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update baptism');
        }
        
        const result = await response.json();
        showNotification(result.message || 'Baptism updated successfully!', 'success');
        
        modal.remove();
        overlay.remove();
        loadBaptisms();
        
    } catch (err) {
        console.error('Edit baptism error:', err);
        showNotification(`Error: ${err.message}`, 'error');
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        z-index: 1000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set color based on type
    if (type === 'success') {
        notification.style.background = '#2ecc71';
    } else if (type === 'error') {
        notification.style.background = '#e74c3c';
    } else if (type === 'warning') {
        notification.style.background = '#f39c12';
    } else {
        notification.style.background = '#3498db';
    }
    
    notification.innerHTML = `
        ${message}
        <span style="margin-left: 10px; cursor: pointer; font-weight: bold;" 
              onclick="this.parentElement.remove()">&times;</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
    
    // Add CSS animation for notifications if not exists
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Make functions available globally
window.viewDetails = viewDetails;