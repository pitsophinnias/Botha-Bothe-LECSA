// Global variables
let currentUser = null;
let currentWeddings = [];

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Weddings page loaded, checking authentication...');
    
    // Check authentication
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    
    if (!token || !user || !role) {
        console.log('No valid authentication found, redirecting to login');
        alert('Please log in to access this page');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        console.log('Authenticated as:', currentUser.username);
        
        // Initialize the page
        initializeWeddingsPage();
        
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        alert('Session expired, please log in again');
        window.location.href = 'login.html';
    }
});

function initializeWeddingsPage() {
    console.log('Initializing Weddings page for user:', currentUser.username);
    
    // Get DOM elements
    const weddingForm = document.getElementById('weddingForm');
    const weddingList = document.getElementById('weddingList');
    const searchInput = document.getElementById('search');
    
    if (!weddingList) {
        console.error('weddingList element not found');
        return;
    }
    
    // Fix table width for Actions column
    const actionsTh = document.querySelector('table th:last-child');
    if (actionsTh) {
        actionsTh.style.width = '100px';
        actionsTh.style.minWidth = '100px';
    }
    const table = document.querySelector('table');
    if (table) {
        table.style.width = 'auto';
        table.style.tableLayout = 'auto';
    }
    
    // Set up form submission
    if (weddingForm && currentUser.role !== 'board_member') {
        weddingForm.addEventListener('submit', handleWeddingSubmit);
    } else if (weddingForm) {
        // Disable form for board members
        weddingForm.querySelectorAll('input, button').forEach(element => {
            element.disabled = true;
        });
        weddingForm.querySelector('button').textContent = 'Record Wedding (Read Only)';
    }
    
    // Set up search
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            const searchTerm = searchInput.value.trim();
            loadWeddings(searchTerm);
        }, 300));
    }
    
    // Setup sidebar
    setupSidebar();
    
    // Initial load of weddings
    loadWeddings();
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

async function handleWeddingSubmit(event) {
    event.preventDefault();
    console.log('=== FRONTEND: Handling wedding form submission ===');
    
    const form = document.getElementById('weddingForm');
    if (!form) {
        console.error('Wedding form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    // Log all form data
    console.log('Form data entries:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }
    
    const weddingData = {
        groom_first_name: formData.get('groom_first_name').trim(),
        groom_middle_name: formData.get('groom_middle_name').trim(),
        groom_surname: formData.get('groom_surname').trim(),
        groom_id_number: formData.get('groom_id_number').trim(),
        bride_first_name: formData.get('bride_first_name').trim(),
        bride_middle_name: formData.get('bride_middle_name').trim(),
        bride_surname: formData.get('bride_surname').trim(),
        bride_id_number: formData.get('bride_id_number').trim(),
        wedding_date: formData.get('wedding_date'),
        pastor: formData.get('pastor').trim(),
        location: formData.get('location').trim()
    };

    console.log('Data to be sent to server:', weddingData);

    // Validate required fields
    const requiredFields = [
        'groom_first_name', 'groom_surname', 
        'bride_first_name', 'bride_surname',
        'wedding_date', 'pastor', 'location'
    ];
    
    const emptyFields = requiredFields.filter(field => !weddingData[field] || weddingData[field].toString().trim() === '');
    if (emptyFields.length > 0) {
        console.log('Validation failed - empty fields:', emptyFields);
        showNotification(`Please fill in all required fields: ${emptyFields.join(', ')}`, 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Session expired, please log in again', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }
        
        console.log('Sending request to /api/weddings with token:', token.substring(0, 20) + '...');
        
        const response = await fetch('/api/weddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(weddingData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            
            throw new Error(errorData.error || `Failed to add wedding (${response.status})`);
        }
        
        const result = await response.json();
        console.log('Success response:', result);
        
        showNotification(result.message || 'Wedding recorded successfully!', 'success');
        form.reset();
        loadWeddings();
        
    } catch (err) {
        console.error('Wedding submission error:', err);
        showNotification(`Error: ${err.message}`, 'error');
    }
}

async function loadWeddings(search = '') {
    console.log('Loading weddings with search:', search);
    
    const weddingList = document.getElementById('weddingList');
    if (!weddingList) return;
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Please log in to view weddings');
        }
        
        const response = await fetch(`/api/weddings?search=${encodeURIComponent(search)}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch weddings');
        }
        
        const weddings = await response.json();
        console.log('Fetched weddings:', weddings);
        
        if (!Array.isArray(weddings)) {
            throw new Error('Invalid server response format');
        }

        currentWeddings = weddings; // Store for search/filter if needed

        if (weddings.length === 0) {
            weddingList.innerHTML = `
                <tr>
                    <td colspan="4" class="border p-2 text-center">
                        No wedding records found ${search ? 'for your search' : ''}
                    </td>
                </tr>
            `;
            return;
        }

        weddingList.innerHTML = weddings.map(w => {
            const formatDate = (dateStr) => {
                if (!dateStr) return 'N/A';
                try {
                    return new Date(dateStr).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } catch (e) {
                    return 'Invalid date';
                }
            };
            
            const groomName = `${w.groom_first_name || ''} ${w.groom_middle_name || ''} ${w.groom_surname || ''}`.trim();
            const brideName = `${w.bride_first_name || ''} ${w.bride_middle_name || ''} ${w.bride_surname || ''}`.trim();
            
            return `
                <tr>
                    <td class="border p-2">${groomName || 'Unknown'}</td>
                    <td class="border p-2">${brideName || 'Unknown'}</td>
                    <td class="border p-2">${formatDate(w.wedding_date)}</td>
                    <td class="border p-2">
                        <button style="background-color: #3498db; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;" 
                                onclick="viewDetails(${w.id})">
                            Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Load weddings error:', err);
        
        if (err.message.includes('Session expired') || err.message.includes('Please log in')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            showNotification(err.message, 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }
        
        weddingList.innerHTML = `
            <tr>
                <td colspan="4" class="border p-2 text-center text-red-500">
                    Error: ${err.message}
                </td>
            </tr>
        `;
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

        const response = await fetch(`/api/weddings/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch wedding details');
        }

        const wedding = await response.json();
        
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
            <h2 style="margin-bottom: 15px;">Wedding Details</h2>
            <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                <div>
                    <strong>Groom:</strong> ${wedding.groom_first_name || ''} ${wedding.groom_middle_name || ''} ${wedding.groom_surname || ''}
                </div>
                <div>
                    <strong>Groom ID:</strong> ${wedding.groom_id_number || 'N/A'}
                </div>
                <div>
                    <strong>Bride:</strong> ${wedding.bride_first_name || ''} ${wedding.bride_middle_name || ''} ${wedding.bride_surname || ''}
                </div>
                <div>
                    <strong>Bride ID:</strong> ${wedding.bride_id_number || 'N/A'}
                </div>
                <div>
                    <strong>Wedding Date:</strong> ${formatDate(wedding.wedding_date)}
                </div>
                <div>
                    <strong>Pastor:</strong> ${wedding.pastor || 'N/A'}
                </div>
                <div>
                    <strong>Location:</strong> ${wedding.location || 'N/A'}
                </div>
                <div>
                    <strong>Record ID:</strong> ${wedding.id}
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
                    <title>Marriage Certificate</title>
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
                            <h1>MARRIAGE CERTIFICATE</h1>
                            <h3>Botha-Bothe LECSA Parish</h3>
                        </div>
                        <div class="content">
                            <div class="section">
                                <h3>Groom's Information</h3>
                                <p><strong>Full Name:</strong> ${wedding.groom_first_name} ${wedding.groom_middle_name || ''} ${wedding.groom_surname}</p>
                                <p><strong>ID Number:</strong> ${wedding.groom_id_number || 'N/A'}</p>
                            </div>
                            <div class="section">
                                <h3>Bride's Information</h3>
                                <p><strong>Full Name:</strong> ${wedding.bride_first_name} ${wedding.bride_middle_name || ''} ${wedding.bride_surname}</p>
                                <p><strong>ID Number:</strong> ${wedding.bride_id_number || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="section">
                            <h3>Wedding Details</h3>
                            <p><strong>Date:</strong> ${formatDate(wedding.wedding_date)}</p>
                            <p><strong>Location:</strong> ${wedding.location}</p>
                            <p><strong>Officiating Pastor:</strong> ${wedding.pastor}</p>
                        </div>
                        <div class="signature">
                            <p>_________________________</p>
                            <p><strong>Pastor:</strong> ${wedding.pastor}</p>
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        <div class="footer">
                            <p>This certifies that the above marriage was recorded in the Botha-Bothe LECSA Parish Registry</p>
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
                showEditModal(wedding);
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
        console.error('Error loading wedding details:', error);
        showNotification('Failed to load wedding details: ' + error.message, 'error');
    }
}

function showEditModal(wedding) {
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
        <h2 style="margin-bottom: 15px;">Edit Wedding Record</h2>
        <form id="editWeddingForm">
            <div style="margin-bottom: 10px;">
                <label for="groom_first_name">Groom First Name:</label>
                <input type="text" id="groom_first_name" name="groom_first_name" value="${wedding.groom_first_name || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="groom_middle_name">Groom Middle Name:</label>
                <input type="text" id="groom_middle_name" name="groom_middle_name" value="${wedding.groom_middle_name || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="groom_surname">Groom Surname:</label>
                <input type="text" id="groom_surname" name="groom_surname" value="${wedding.groom_surname || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="groom_id_number">Groom ID Number:</label>
                <input type="text" id="groom_id_number" name="groom_id_number" value="${wedding.groom_id_number || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="bride_first_name">Bride First Name:</label>
                <input type="text" id="bride_first_name" name="bride_first_name" value="${wedding.bride_first_name || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="bride_middle_name">Bride Middle Name:</label>
                <input type="text" id="bride_middle_name" name="bride_middle_name" value="${wedding.bride_middle_name || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="bride_surname">Bride Surname:</label>
                <input type="text" id="bride_surname" name="bride_surname" value="${wedding.bride_surname || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="bride_id_number">Bride ID Number:</label>
                <input type="text" id="bride_id_number" name="bride_id_number" value="${wedding.bride_id_number || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label for="wedding_date">Wedding Date:</label>
                <input type="date" id="wedding_date" name="wedding_date" value="${wedding.wedding_date ? wedding.wedding_date.split('T')[0] : ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="pastor">Pastor:</label>
                <input type="text" id="pastor" name="pastor" value="${wedding.pastor || ''}" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label for="location">Location:</label>
                <input type="text" id="location" name="location" value="${wedding.location || ''}" required>
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
    const editForm = document.getElementById('editWeddingForm');
    editForm.addEventListener('submit', (e) => handleEditSubmit(e, wedding.id, overlay, modal));

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
    
    const form = document.getElementById('editWeddingForm');
    const formData = new FormData(form);
    
    const weddingData = {
        groom_first_name: formData.get('groom_first_name').trim(),
        groom_middle_name: formData.get('groom_middle_name').trim(),
        groom_surname: formData.get('groom_surname').trim(),
        groom_id_number: formData.get('groom_id_number').trim(),
        bride_first_name: formData.get('bride_first_name').trim(),
        bride_middle_name: formData.get('bride_middle_name').trim(),
        bride_surname: formData.get('bride_surname').trim(),
        bride_id_number: formData.get('bride_id_number').trim(),
        wedding_date: formData.get('wedding_date'),
        pastor: formData.get('pastor').trim(),
        location: formData.get('location').trim()
    };

    // Validate required fields (same as add)
    const requiredFields = [
        'groom_first_name', 'groom_surname', 
        'bride_first_name', 'bride_surname',
        'wedding_date', 'pastor', 'location'
    ];
    
    const emptyFields = requiredFields.filter(field => !weddingData[field] || weddingData[field].toString().trim() === '');
    if (emptyFields.length > 0) {
        showNotification(`Please fill in all required fields: ${emptyFields.join(', ')}`, 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Session expired, please log in again', 'error');
            setTimeout(() => window.location.href = 'login.html', 1000);
            return;
        }
        
        const response = await fetch(`/api/weddings/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(weddingData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update wedding');
        }
        
        const result = await response.json();
        showNotification(result.message || 'Wedding updated successfully!', 'success');
        
        modal.remove();
        overlay.remove();
        loadWeddings();
        
    } catch (err) {
        console.error('Edit wedding error:', err);
        showNotification(`Error: ${err.message}`, 'error');
    }
}

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