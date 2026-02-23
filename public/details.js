document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const recordType = urlParams.get('type'); // 'member', 'baptism', 'wedding'
    const recordId = urlParams.get('id');
    const fromPage = urlParams.get('from'); // Original page for back button
    
    if (!recordType || !recordId) {
        document.getElementById('error').textContent = 'Invalid record details.';
        return;
    }
    
    // Setup sidebar
    setupSidebar();
    
    // Setup back button
    document.getElementById('backButton').addEventListener('click', () => {
        if (fromPage) {
            window.location.href = fromPage;
        } else {
            window.history.back();
        }
    });
    
    // Load record details
    loadRecordDetails(recordType, recordId);
});

async function loadRecordDetails(type, id) {
    try {
        const token = localStorage.getItem('token');
        let endpoint = '';
        
        switch(type) {
            case 'member':
                endpoint = `/api/members/${id}`;
                break;
            case 'baptism':
                endpoint = `/api/baptisms/${id}`;
                break;
            case 'wedding':
                endpoint = `/api/weddings/${id}`;
                break;
            default:
                throw new Error('Invalid record type');
        }
        
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch record details');
        }
        
        const record = await response.json();
        displayRecordDetails(type, record);
        
    } catch (error) {
        console.error('Error loading details:', error);
        document.getElementById('error').textContent = error.message;
    }
}

function displayRecordDetails(type, record) {
    const container = document.getElementById('detailsContent');
    const title = document.getElementById('detailsTitle');
    
    switch(type) {
        case 'member':
            title.textContent = 'Member Details';
            container.innerHTML = generateMemberDetails(record);
            break;
        case 'baptism':
            title.textContent = 'Baptism Details';
            container.innerHTML = generateBaptismDetails(record);
            break;
        case 'wedding':
            title.textContent = 'Wedding Details';
            container.innerHTML = generateWeddingDetails(record);
            break;
    }
}

function generateMemberDetails(member) {
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    return `
        <div class="details-card">
            <h2>${member.lebitso || ''} ${member.fane || ''}</h2>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">Member ID:</span>
                    <span class="detail-value">${member.palo || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Date Joined:</span>
                    <span class="detail-value">${formatDate(member.created_at)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${member.phone || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Gender:</span>
                    <span class="detail-value">${member.gender || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Role:</span>
                    <span class="detail-value">${member.role || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${member.location || 'N/A'}</span>
                </div>
            </div>
            
            <h3>Payment Receipts</h3>
            <div class="receipts-grid">
                ${Object.keys(member)  // <-- Changed from record to member
                    .filter(key => key.startsWith('receipt_'))
                    .map(year => `
                        <div class="receipt-item">
                            <span class="receipt-year">${year.replace('receipt_', '')}:</span>
                            <span class="receipt-number">${member[year] || 'Not Paid'}</span>
                        </div>
                    `).join('')}
            </div>
        </div>
    `;
}

function generateBaptismDetails(baptism) {
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    return `
        <div class="details-card">
            <h2>${baptism.first_name || ''} ${baptism.middle_name || ''} ${baptism.surname || ''}</h2>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">Baptism ID:</span>
                    <span class="detail-value">${baptism.id || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Date of Birth:</span>
                    <span class="detail-value">${formatDate(baptism.date_of_birth)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Baptism Date:</span>
                    <span class="detail-value">${formatDate(baptism.baptism_date)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Pastor:</span>
                    <span class="detail-value">${baptism.pastor || 'N/A'}</span>
                </div>
            </div>
            
            <h3>Parents Information</h3>
            <div class="parents-grid">
                <div class="parent-card">
                    <h4>Father</h4>
                    <p>${baptism.father_first_name || ''} ${baptism.father_middle_name || ''} ${baptism.father_surname || ''}</p>
                </div>
                <div class="parent-card">
                    <h4>Mother</h4>
                    <p>${baptism.mother_first_name || ''} ${baptism.mother_middle_name || ''} ${baptism.mother_surname || ''}</p>
                </div>
            </div>
        </div>
    `;
}

function generateWeddingDetails(wedding) {
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    return `
        <div class="details-card">
            <h2>Wedding Details</h2>
            <div class="couple-grid">
                <div class="person-card">
                    <h3>Groom</h3>
                    <p><strong>Name:</strong> ${wedding.groom_first_name || ''} ${wedding.groom_middle_name || ''} ${wedding.groom_surname || ''}</p>
                    <p><strong>ID Number:</strong> ${wedding.groom_id_number || 'N/A'}</p>
                </div>
                <div class="person-card">
                    <h3>Bride</h3>
                    <p><strong>Name:</strong> ${wedding.bride_first_name || ''} ${wedding.bride_middle_name || ''} ${wedding.bride_surname || ''}</p>
                    <p><strong>ID Number:</strong> ${wedding.bride_id_number || 'N/A'}</p>
                </div>
            </div>
            
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">Wedding Date:</span>
                    <span class="detail-value">${formatDate(wedding.wedding_date)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Pastor:</span>
                    <span class="detail-value">${wedding.pastor || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${wedding.location || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Wedding ID:</span>
                    <span class="detail-value">${wedding.id || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

function setupSidebar() {
    // Similar sidebar setup as in archives.js
    const userRole = localStorage.getItem('role');
    const sidebar = document.getElementById('sidebar');
    
    // Add menu items
    const menuItems = [
        { icon: 'fas fa-tachometer-alt', text: 'Dashboard', href: 'regsys.html' },
        { icon: 'fas fa-users', text: 'Kabelo', href: 'kabelo.html' },
        { icon: 'fas fa-water', text: 'Likolobetso', href: 'likolobetso.html' },
        { icon: 'fas fa-heart', text: 'Manyalo', href: 'manyalo.html' },
        { icon: 'fas fa-money-bill-wave', text: 'Libuka', href: 'financials.html' },
        { icon: 'fas fa-archive', text: 'Archives', href: 'archives.html' },
    ];
    
    const menuLogo = sidebar.querySelector('.menu-logo');
    menuItems.forEach(item => {
        const link = document.createElement('a');
        link.href = item.href;
        link.innerHTML = `<i class="${item.icon}"></i><span>${item.text}</span>`;
        menuLogo.after(link);
    });
    
    // Setup sidebar toggle
    const toggleButton = document.getElementById('toggleSidebar');
    const content = document.getElementById('content');
    const menuClose = document.getElementById('menuClose');

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
    
    // Setup logout
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            window.location.href = 'login.html';
        });
    }
}