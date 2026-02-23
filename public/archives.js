console.log('archives.js loaded at:', new Date().toISOString());

async function fetchArchives(search = '') {
    console.log('fetchArchives called with search:', search);
    const errorEl = document.getElementById('error') || document.createElement('div');
    errorEl.id = 'error';
    document.body.prepend(errorEl);
    
    if (!localStorage.getItem('token')) {
        errorEl.textContent = 'Please log in to view archives';
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/archives?search=${encodeURIComponent(search)}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch archives: ${response.status}`);
        }
        
        const archives = await response.json();
        console.log('Fetched archives from API:', archives);
        
        // Clear existing content
        document.getElementById('movedList').innerHTML = '';
        document.getElementById('deceasedList').innerHTML = '';
        document.getElementById('baptismList').innerHTML = '';
        document.getElementById('weddingList').innerHTML = '';
        
        // Separate records by type and status
        const movedMembers = archives.filter(a => 
            a.record_type === 'member' && 
            a.details && 
            a.details.status === 'Moved'
        );
        
        const deceasedMembers = archives.filter(a => 
            a.record_type === 'member' && 
            a.details && 
            a.details.status === 'Deceased'
        );
        
        const archivedBaptisms = archives.filter(a => 
            a.record_type === 'baptism'
        );
        
        const archivedWeddings = archives.filter(a => 
            a.record_type === 'wedding'
        );
        
        // Display moved members
        if (movedMembers.length > 0) {
            movedMembers.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="border p-2">${record.details?.lebitso || 'Unknown'}</td>
                    <td class="border p-2">${record.details?.fane || 'Unknown'}</td>
                    <td class="border p-2">${record.palo || 'N/A'}</td>
                    <td class="border p-2">
                        <button class="detailsBtn bg-blue-500 text-white p-1 rounded" 
                                data-record='${JSON.stringify(record)}'
                                data-open="false">Details</button>
                        ${['pastor', 'secretary'].includes(localStorage.getItem('role')) ? 
                            `<button class="restoreBtn bg-green-500 text-white p-1 rounded ml-2" 
                                     data-id="${record.id}" data-type="${record.record_type}">
                                Restore
                            </button>` : ''}
                    </td>
                `;
                document.getElementById('movedList').appendChild(row);
            });
        } else {
            document.getElementById('movedList').innerHTML = `
                <tr>
                    <td colspan="4" class="border p-2 text-center">No moved members found</td>
                </tr>
            `;
        }
        
        // Display deceased members
        if (deceasedMembers.length > 0) {
            deceasedMembers.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="border p-2">${record.details?.lebitso || 'Unknown'}</td>
                    <td class="border p-2">${record.details?.fane || 'Unknown'}</td>
                    <td class="border p-2">${record.palo || 'N/A'}</td>
                    <td class="border p-2">
                        <button class="detailsBtn bg-blue-500 text-white p-1 rounded" 
                                data-record='${JSON.stringify(record)}'
                                data-open="false">Details</button>
                    </td>
                `;
                document.getElementById('deceasedList').appendChild(row);
            });
        } else {
            document.getElementById('deceasedList').innerHTML = `
                <tr>
                    <td colspan="4" class="border p-2 text-center">No deceased members found</td>
                </tr>
            `;
        }
        
        // Display archived baptisms
        if (archivedBaptisms.length > 0) {
            archivedBaptisms.forEach(record => {
                const row = document.createElement('tr');
                const baptismData = record.details || {};
                row.innerHTML = `
                    <td class="border p-2">${baptismData.first_name || ''} ${baptismData.middle_name || ''} ${baptismData.surname || ''}</td>
                    <td class="border p-2">${baptismData.baptism_date ? new Date(baptismData.baptism_date).toLocaleDateString() : 'N/A'}</td>
                    <td class="border p-2">
                        <button class="detailsBtn bg-blue-500 text-white p-1 rounded" 
                                data-record='${JSON.stringify(record)}'
                                data-open="false">Details</button>
                    </td>
                `;
                document.getElementById('baptismList').appendChild(row);
            });
        } else {
            document.getElementById('baptismList').innerHTML = `
                <tr>
                    <td colspan="3" class="border p-2 text-center">No archived baptisms found</td>
                </tr>
            `;
        }
        
        // Display archived weddings
        if (archivedWeddings.length > 0) {
            archivedWeddings.forEach(record => {
                const row = document.createElement('tr');
                const weddingData = record.details || {};
                row.innerHTML = `
                    <td class="border p-2">${weddingData.groom_first_name || ''} ${weddingData.groom_middle_name || ''} ${weddingData.groom_surname || ''}</td>
                    <td class="border p-2">${weddingData.bride_first_name || ''} ${weddingData.bride_middle_name || ''} ${weddingData.bride_surname || ''}</td>
                    <td class="border p-2">${weddingData.wedding_date ? new Date(weddingData.wedding_date).toLocaleDateString() : 'N/A'}</td>
                    <td class="border p-2">
                        <button class="detailsBtn bg-blue-500 text-white p-1 rounded" 
                                data-record='${JSON.stringify(record)}'
                                data-open="false">Details</button>
                    </td>
                `;
                document.getElementById('weddingList').appendChild(row);
            });
        } else {
            document.getElementById('weddingList').innerHTML = `
                <tr>
                    <td colspan="4" class="border p-2 text-center">No archived weddings found</td>
                </tr>
            `;
        }
        
        // Re-attach event listeners
        setTimeout(() => {
            document.querySelectorAll('.detailsBtn').forEach(btn => btn.addEventListener('click', () => toggleDetails(btn)));
            document.querySelectorAll('.restoreBtn').forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                restoreRecord(btn.dataset.id, btn.dataset.type);
            }));
        }, 100);
        
    } catch (err) {
        console.error('Fetch error:', err);
        errorEl.textContent = `Error loading archives: ${err.message}`;
    }
}

// Keep the toggleDetails function as is...
// Keep the restoreRecord function as is, but update it to handle different record types...
// Keep the utility functions as is...

// Add this function to handle sidebar menu
function setupSidebarMenu() {
    const userRole = localStorage.getItem('role');
    const adminLink = document.getElementById('adminLink');
    
    // Show admin link only for pastors
    if (adminLink && userRole === 'pastor') {
        adminLink.style.display = 'block';
    }
    
    // Update sidebar links based on your requirements
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Remove existing links except logout
        const existingLinks = sidebar.querySelectorAll('a:not(#logoutLink)');
        existingLinks.forEach(link => link.remove());
        
        // Add new menu structure
        const menuItems = [
            { icon: 'fas fa-tachometer-alt', text: 'Dashboard', href: 'regsys.html' },
            { icon: 'fas fa-users', text: 'Kabelo', href: 'kabelo.html' },
            { icon: 'fas fa-water', text: 'Likolobetso', href: 'likolobetso.html' },
            { icon: 'fas fa-heart', text: 'Manyalo', href: 'manyalo.html' },
            { icon: 'fas fa-money-bill-wave', text: 'Libuka', href: 'financials.html' },
            { icon: 'fas fa-archive', text: 'Archives', href: 'archives.html' },
        ];
        
        // Insert menu items after the logo
        const menuLogo = sidebar.querySelector('.menu-logo');
        menuItems.forEach(item => {
            const link = document.createElement('a');
            link.href = item.href;
            link.innerHTML = `<i class="${item.icon}"></i><span>${item.text}</span>`;
            menuLogo.after(link);
        });
        
        // Add admin link for pastors
        if (userRole === 'pastor') {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.id = 'adminLink';
            adminLink.innerHTML = '<i class="fas fa-user-shield"></i><span>Admin</span>';
            sidebar.insertBefore(adminLink, document.getElementById('logoutLink'));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded at:', new Date().toISOString());
    
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please log in to access this page');
        window.location.href = 'login.html';
        return;
    }
    
    // Setup sidebar menu
    setupSidebarMenu();
    
    // Setup sidebar toggle
    const toggleButton = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
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
    
    // Load archives
    fetchArchives();
    handleSearch('search', fetchArchives);
});