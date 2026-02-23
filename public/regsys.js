async function fetchRecentActivities() {
    const recentMember = document.getElementById('recentMember');
    const recentBaptism = document.getElementById('recentBaptism');
    const recentWedding = document.getElementById('recentWedding');
    
    if (!recentMember || !recentBaptism || !recentWedding) {
        console.warn('Recent activity elements not found');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.warn('No token found for fetching activities');
            // Don't redirect here - just show error messages
            recentMember.innerHTML = `
                <strong>Not logged in</strong><br>
                <small>Please login</small>
            `;
            recentBaptism.innerHTML = `
                <strong>Not logged in</strong><br>
                <small>Please login</small>
            `;
            recentWedding.innerHTML = `
                <strong>Not logged in</strong><br>
                <small>Please login</small>
            `;
            return;
        }
        
        console.log('DEBUG: Token found, fetching data...');
        
        // REMOVED TOKEN VERIFICATION - Let the actual API calls fail if token is invalid
        
        // Fetch newest member from Kabelo page
        try {
            const memberResponse = await fetch('/api/members?limit=1&order=desc', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (memberResponse.ok) {
                const members = await memberResponse.json();
                if (members && members.length > 0) {
                    const newestMember = members[0];
                    // Find the most recent non-archived member
                    const activeMembers = members.filter(member => 
                        !member.archived && 
                        member.status !== 'Moved' && 
                        member.status !== 'Deceased'
                    );
                    
                    if (activeMembers.length > 0) {
                        const member = activeMembers[0];
                        recentMember.innerHTML = `
                            <strong>${member.lebitso || ''} ${member.fane || ''}</strong><br>
                            <small>Member #${member.palo || ''}</small>
                        `;
                    } else {
                        recentMember.innerHTML = `
                            <strong>No active members</strong><br>
                            <small>Register a new member</small>
                        `;
                    }
                } else {
                    recentMember.innerHTML = `
                        <strong>No members registered</strong><br>
                        <small>Add first member in Kabelo</small>
                    `;
                }
            } else if (memberResponse.status === 401 || memberResponse.status === 403) {
                // Token is invalid or expired
                console.log('Token invalid (401/403) in member fetch');
                handleTokenExpired();
                return;
            } else if (memberResponse.status === 404) {
                recentMember.innerHTML = `
                    <strong>Members table not set up</strong><br>
                    <small>Contact administrator</small>
                `;
            } else {
                recentMember.innerHTML = `
                    <strong>Error loading members</strong><br>
                    <small>Status: ${memberResponse.status}</small>
                `;
            }
        } catch (memberError) {
            console.warn('Member fetch error:', memberError);
            recentMember.innerHTML = `
                <strong>Error loading members</strong><br>
                <small>Check connection</small>
            `;
        }
        
        // Fetch newest baptism from Likolobetso page
        try {
            const baptismResponse = await fetch('/api/baptisms?limit=1&order_by=baptism_date&order=desc', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (baptismResponse.ok) {
                const baptisms = await baptismResponse.json();
                if (baptisms && baptisms.length > 0) {
                    const newestBaptism = baptisms[0];
                    // Find the most recent non-archived baptism
                    const activeBaptisms = baptisms.filter(baptism => 
                        !baptism.archived
                    );
                    
                    if (activeBaptisms.length > 0) {
                        const baptism = activeBaptisms[0];
                        const baptismDate = baptism.baptism_date ? 
                            new Date(baptism.baptism_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            }) : 'Date not set';
                        
                        recentBaptism.innerHTML = `
                            <strong>${baptism.first_name || ''} ${baptism.surname || ''}</strong><br>
                            <small>Baptized on ${baptismDate}</small>
                        `;
                    } else {
                        recentBaptism.innerHTML = `
                            <strong>No recent baptisms</strong><br>
                            <small>Record a new baptism</small>
                        `;
                    }
                } else {
                    recentBaptism.innerHTML = `
                        <strong>No baptisms recorded</strong><br>
                        <small>Record first baptism</small>
                    `;
                }
            } else if (baptismResponse.status === 401 || baptismResponse.status === 403) {
                // Token is invalid or expired
                console.log('Token invalid (401/403) in baptism fetch');
                handleTokenExpired();
                return;
            } else if (baptismResponse.status === 404) {
                recentBaptism.innerHTML = `
                    <strong>Baptisms table not set up</strong><br>
                    <small>Contact administrator</small>
                `;
            } else {
                recentBaptism.innerHTML = `
                    <strong>Error loading baptisms</strong><br>
                    <small>Status: ${baptismResponse.status}</small>
                `;
            }
        } catch (baptismError) {
            console.warn('Baptism fetch error:', baptismError);
            recentBaptism.innerHTML = `
                <strong>Error loading baptisms</strong><br>
                <small>Check connection</small>
            `;
        }
        
        // Fetch newest wedding from Manyalo page
        try {
            const weddingResponse = await fetch('/api/weddings?limit=1&order_by=wedding_date&order=desc', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (weddingResponse.ok) {
                const weddings = await weddingResponse.json();
                if (weddings && weddings.length > 0) {
                    const newestWedding = weddings[0];
                    // Find the most recent non-archived wedding
                    const activeWeddings = weddings.filter(wedding => 
                        !wedding.archived
                    );
                    
                    if (activeWeddings.length > 0) {
                        const wedding = activeWeddings[0];
                        const weddingDate = wedding.wedding_date ? 
                            new Date(wedding.wedding_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            }) : 'Date not set';
                        
                        // Combine names
                        const groomName = `${wedding.groom_first_name || ''} ${wedding.groom_surname || ''}`.trim();
                        const brideName = `${wedding.bride_first_name || ''} ${wedding.bride_surname || ''}`.trim();
                        
                        recentWedding.innerHTML = `
                            <strong>${groomName} & ${brideName}</strong><br>
                            <small>Married on ${weddingDate}</small>
                        `;
                    } else {
                        recentWedding.innerHTML = `
                            <strong>No recent weddings</strong><br>
                            <small>Record a new wedding</small>
                        `;
                    }
                } else {
                    recentWedding.innerHTML = `
                        <strong>No weddings recorded</strong><br>
                        <small>Record first wedding</small>
                    `;
                }
            } else if (weddingResponse.status === 401 || weddingResponse.status === 403) {
                // Token is invalid or expired
                console.log('Token invalid (401/403) in wedding fetch');
                handleTokenExpired();
                return;
            } else if (weddingResponse.status === 404) {
                recentWedding.innerHTML = `
                    <strong>Weddings table not set up</strong><br>
                    <small>Contact administrator</small>
                `;
            } else {
                recentWedding.innerHTML = `
                    <strong>Error loading weddings</strong><br>
                    <small>Status: ${weddingResponse.status}</small>
                `;
            }
        } catch (weddingError) {
            console.warn('Wedding fetch error:', weddingError);
            recentWedding.innerHTML = `
                <strong>Error loading weddings</strong><br>
                <small>Check connection</small>
            `;
        }
        
        console.log('Recent activities loaded successfully');
        
    } catch (err) {
        console.error('Main fetch error:', err);
        
        // Set error messages with better formatting
        recentMember.innerHTML = `
            <strong>Error loading</strong><br>
            <small>${err.message || 'Connection issue'}</small>
        `;
        recentBaptism.innerHTML = `
            <strong>Error loading</strong><br>
            <small>${err.message || 'Connection issue'}</small>
        `;
        recentWedding.innerHTML = `
            <strong>Error loading</strong><br>
            <small>${err.message || 'Connection issue'}</small>
        `;
        
        // Only redirect on actual authentication errors, not on 404s
        if (err.message.includes('401') || err.message.includes('403')) {
            console.log('Authentication issue, redirecting to login...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
    }
}

// Add this function to handle token expiration
function handleTokenExpired() {
    console.log('Token expired or invalid, clearing storage...');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('login.html')) {
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

// Enhanced function to refresh activities when new records are added
async function refreshRecentActivities() {
    console.log('Refreshing recent activities...');
    await fetchRecentActivities();
}

// Function to update specific activity
async function updateRecentMember(memberData) {
    const recentMember = document.getElementById('recentMember');
    if (recentMember && memberData) {
        recentMember.innerHTML = `
            <strong>${memberData.lebitso || ''} ${memberData.fane || ''}</strong><br>
            <small>Member #${memberData.palo || ''}</small>
        `;
    }
}

async function updateRecentBaptism(baptismData) {
    const recentBaptism = document.getElementById('recentBaptism');
    if (recentBaptism && baptismData) {
        const baptismDate = baptismData.baptism_date ? 
            new Date(baptismData.baptism_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'Date not set';
        
        recentBaptism.innerHTML = `
            <strong>${baptismData.first_name || ''} ${baptismData.surname || ''}</strong><br>
            <small>Baptized on ${baptismDate}</small>
        `;
    }
}

async function updateRecentWedding(weddingData) {
    const recentWedding = document.getElementById('recentWedding');
    if (recentWedding && weddingData) {
        const weddingDate = weddingData.wedding_date ? 
            new Date(weddingData.wedding_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'Date not set';
        
        const groomName = `${weddingData.groom_first_name || ''} ${weddingData.groom_surname || ''}`.trim();
        const brideName = `${weddingData.bride_first_name || ''} ${weddingData.bride_surname || ''}`.trim();
        
        recentWedding.innerHTML = `
            <strong>${groomName} & ${brideName}</strong><br>
            <small>Married on ${weddingDate}</small>
        `;
    }
}

function logout() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    } catch (err) {
        console.warn('Logout error:', err);
        alert('Error logging out: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing...');
    
    // Check authentication - SIMPLIFIED VERSION
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = 'login.html';
        return;
    }
    
    // Show admin link for privileged roles
    const role = localStorage.getItem('role');
    if (['admin', 'pastor', 'secretary'].includes(role)) {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.style.display = 'block';
            console.log('Admin link shown for role:', role);
        }
    }
    
    // Setup sidebar toggle
    const toggleButton = document.getElementById('toggleSidebar');
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const content = document.getElementById('content');
            if (sidebar && content) {
                sidebar.classList.toggle('open');
                content.classList.toggle('shift');
                console.log('Sidebar toggled');
            }
        });
    }
    
    // Setup logout link
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Logout clicked');
            logout();
        });
    }
    
    // Fix the image 404 error
    const bannerImg = document.querySelector('img[src*="banner.png"]');
    if (bannerImg && bannerImg.src.includes('banner.png')) {
        console.log('Banner image found, checking if it exists...');
        // If image doesn't load, hide it or show placeholder
        bannerImg.onerror = function() {
            console.log('Banner image failed to load, hiding...');
            this.style.display = 'none';
        };
    }
    
    // Fetch recent activities (skip on financials page if needed)
    const currentPage = window.location.pathname;
    if (!currentPage.includes('financials.html')) {
        console.log('Fetching recent activities...');
        fetchRecentActivities();
        
        // Refresh every 30 seconds
        setInterval(fetchRecentActivities, 30000);
    }
});

// Make functions available globally for other pages to update activities
window.refreshRecentActivities = refreshRecentActivities;
window.updateRecentMember = updateRecentMember;
window.updateRecentBaptism = updateRecentBaptism;
window.updateRecentWedding = updateRecentWedding;