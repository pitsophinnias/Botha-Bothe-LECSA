// Global variables
let currentUser = null;

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('LECSA Church initialized');
    
    // Setup form submissions
    setupLoginForm();
    setupRegisterForm();
    
    // Setup mobile menu
    setupMobileMenu();
    
    // Check if user is already logged in
    checkLoginStatus();
});

// ==============================================
// AUTHENTICATION FUNCTIONS
// ==============================================

function checkLoginStatus() {
    console.log('Checking login status...');
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    
    // Debug: Show exactly what we have in localStorage
    console.log('Token exists?', !!token, token ? 'length: ' + token.length : '');
    console.log('User string exists?', !!user, user ? 'length: ' + user.length : '');
    console.log('Role exists?', !!role, 'Role value:', role);
    console.log('Current full pathname:', window.location.pathname);
    console.log('Current page filename:', window.location.pathname.split('/').pop());

    if (token && user && role) {
        console.log('Found token, user, and role in localStorage → attempting to parse user');
        
        try {
            currentUser = JSON.parse(user);
            console.log('User parsed successfully:', currentUser);
            console.log('Parsed user role:', currentUser.role);
            console.log('LocalStorage role matches parsed?', currentUser.role === role);
            
            updateUIForLoggedInUser();
            
            // If on login/register page but already logged in → redirect to dashboard
            if (window.location.pathname.includes('login.html')) {
                console.log('On login.html but already logged in → redirecting to regsys.html');
                setTimeout(() => {
                    window.location.href = 'regsys.html';
                }, 1000);
            }
            
            if (window.location.pathname.includes('register.html')) {
                console.log('On register.html but already logged in → redirecting to regsys.html');
                setTimeout(() => {
                    window.location.href = 'regsys.html';
                }, 1000);
            }
            
            // If we're already on a protected page (like regsys.html), we should STAY
            console.log('Already logged in on this page → no redirect needed');
            
        } catch (error) {
            console.error('CRITICAL ERROR: Failed to parse user JSON!', error);
            console.error('Bad user string was:', user);
            console.error('Clearing invalid login data...');
            
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            updateUIForLoggedOutUser();
        }
    } else {
        console.log('MISSING login data → treating as logged out');
        console.log('Missing items:', {
            hasToken: !!token,
            hasUser: !!user,
            hasRole: !!role
        });
        
        const protectedPages = ['regsys.html', 'kabelo.html', 'likolobetso.html', 'manyalo.html', 'archives.html', 'admin.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html'; // fallback
        
        console.log('Is this a protected page?', protectedPages.includes(currentPage));
        console.log('Protected pages list:', protectedPages);
        console.log('Detected current page:', currentPage);
        
        if (protectedPages.includes(currentPage)) {
            console.log(`PROTECTED PAGE DETECTED (${currentPage}) without valid login → redirecting to login.html`);
            showNotification('Please log in to continue', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } else {
            console.log('Not a protected page → staying here as logged-out user');
        }
        
        updateUIForLoggedOutUser();
    }
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const message = document.getElementById('loginMessage');
            
            if (!usernameInput || !passwordInput || !message) {
                console.error('Login form elements not found');
                return;
            }
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            
            // Basic validation
            if (!username || !password) {
                message.textContent = 'Please enter both username and password';
                message.style.color = '#e74c3c';
                return;
            }
            
            try {
                // Try the new auth endpoint first
                console.log('Attempting login with new endpoint...');
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                console.log('Login response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Login successful:', data);
                    
                    // Store token and user info
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('role', data.user.role);
                    
                    currentUser = data.user;
                    
                    // Show success message
                    showNotification('Login successful! Redirecting...', 'success');
                    
                    // Redirect to regsys.html after a short delay
                    setTimeout(() => {
                        window.location.href = 'regsys.html';
                    }, 1000);
                    
                } else {
                    console.log('New endpoint failed, trying legacy endpoint...');
                    // Try legacy endpoint as fallback
                    const legacyResponse = await fetch('/api/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });
                    
                    console.log('Legacy login response status:', legacyResponse.status);
                    
                    if (legacyResponse.ok) {
                        const legacyData = await legacyResponse.json();
                        console.log('Legacy login successful:', legacyData);
                        
                        // Store token and user info from legacy endpoint
                        localStorage.setItem('token', legacyData.token);
                        localStorage.setItem('role', legacyData.role);
                        if (legacyData.user) {
                            localStorage.setItem('user', JSON.stringify(legacyData.user));
                        } else {
                            // Create user object from legacy data
                            localStorage.setItem('user', JSON.stringify({
                                id: 'legacy',
                                username: username,
                                role: legacyData.role
                            }));
                        }
                        
                        // Show success message
                        showNotification('Login successful! Redirecting...', 'success');
                        
                        // Redirect to regsys.html after a short delay
                        setTimeout(() => {
                            window.location.href = 'regsys.html';
                        }, 1000);
                    } else {
                        const errorData = await legacyResponse.json().catch(() => ({}));
                        message.textContent = errorData.error || 'Invalid username or password';
                        message.style.color = '#e74c3c';
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                message.textContent = 'Network error. Please try again.';
                message.style.color = '#e74c3c';
            }
        });
    }
}

function setupRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const message = document.getElementById('registerMessage') || document.getElementById('message');
            const error = document.getElementById('error');
            
            if (!usernameInput || !passwordInput) {
                console.error('Register form elements not found');
                return;
            }
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            
            // Clear previous messages
            if (message) {
                message.textContent = '';
                message.style.display = 'none';
            }
            if (error) {
                error.textContent = '';
                error.style.display = 'none';
            }
            
            // Validation
            if (!username || !password) {
                showRegisterError('Please fill in all fields');
                return;
            }
            
            if (password.length < 6) {
                showRegisterError('Password must be at least 6 characters long');
                return;
            }
            
            // Username validation (alphanumeric and underscores)
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                showRegisterError('Username can only contain letters, numbers, and underscores');
                return;
            }
            
            try {
                // Try the new auth endpoint first
                console.log('Attempting registration with new endpoint...');
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                console.log('Register response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Registration successful:', data);
                    showNotification('Registration successful! Redirecting to login...', 'success');
                    
                    // Redirect to login page after a short delay
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                    
                } else {
                    console.log('New endpoint failed, trying legacy endpoint...');
                    // Try legacy endpoint as fallback
                    const legacyResponse = await fetch('/api/register/public', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });
                    
                    console.log('Legacy register response status:', legacyResponse.status);
                    
                    if (legacyResponse.ok) {
                        const legacyData = await legacyResponse.json();
                        console.log('Legacy registration successful:', legacyData);
                        showNotification('Registration successful! Redirecting to login...', 'success');
                        
                        // Redirect to login page after a short delay
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 2000);
                    } else {
                        const errorData = await legacyResponse.json().catch(() => ({}));
                        showRegisterError(errorData.error || 'Registration failed');
                    }
                }
            } catch (error) {
                console.error('Registration error:', error);
                showRegisterError('Network error. Please try again.');
            }
        });
    }
}

function logout() {
    console.log('Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    currentUser = null;
    
    // Show notification
    showNotification('Logged out successfully', 'info');
    
    // Update UI
    updateUIForLoggedOutUser();
    
    // Redirect to home page
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ==============================================
// UI UPDATE FUNCTIONS
// ==============================================

function updateUIForLoggedInUser() {
    console.log('Updating UI for logged in user:', currentUser);
    
    // Update navigation on pages that have it
    const navLinks = document.querySelectorAll('nav a, .side-menu a');
    
    // Replace login/register links with logout/profile
    navLinks.forEach(link => {
        if (link.href.includes('login.html') || link.textContent.includes('Login')) {
            link.textContent = 'Logout';
            link.href = '#';
            link.onclick = function(e) {
                e.preventDefault();
                logout();
            };
        }
        
        if (link.href.includes('register.html') || link.textContent.includes('Register')) {
            link.style.display = 'none';
        }
    });
    
    // Add welcome message if there's a suitable container
    const authSection = document.querySelector('.auth-section');
    if (authSection && currentUser) {
        // Remove existing welcome message if any
        const existingWelcome = document.querySelector('.welcome-message');
        if (existingWelcome) {
            existingWelcome.remove();
        }
        
        const welcomeMsg = document.createElement('p');
        welcomeMsg.className = 'welcome-message';
        welcomeMsg.innerHTML = `<i class="fas fa-user"></i> Welcome, ${currentUser.username}!`;
        welcomeMsg.style.marginTop = '10px';
        welcomeMsg.style.color = '#333';
        welcomeMsg.style.fontWeight = 'bold';
        authSection.appendChild(welcomeMsg);
    }
    
    // Show admin link for privileged roles
    if (currentUser && ['pastor', 'secretary'].includes(currentUser.role)) {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.style.display = 'block';
            console.log('Admin link shown for role:', currentUser.role);
        }
    }
}

function updateUIForLoggedOutUser() {
    console.log('Updating UI for logged out user');
    
    // Reset navigation
    const navLinks = document.querySelectorAll('nav a, .side-menu a');
    
    navLinks.forEach(link => {
        if (link.textContent === 'Logout') {
            link.textContent = 'Login';
            link.href = 'login.html';
            link.onclick = null;
        }
        
        if (link.style.display === 'none') {
            link.style.display = '';
        }
    });
    
    // Remove welcome message
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    // Hide admin link
    const adminLink = document.getElementById('adminLink');
    if (adminLink) {
        adminLink.style.display = 'none';
    }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function showRegisterError(message) {
    const registerError = document.getElementById('register-error') || document.getElementById('error');
    if (registerError) {
        registerError.textContent = message;
        registerError.style.color = '#e74c3c';
        registerError.style.display = 'block';
    }
    
    const messageElement = document.getElementById('registerMessage') || document.getElementById('message');
    if (messageElement) {
        messageElement.style.display = 'none';
    }
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
}

function setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const menuClose = document.querySelector('.menu-close');
    const sideMenu = document.querySelector('.side-menu');
    const headerWrapper = document.querySelector('.header-wrapper');
    
    if (menuToggle && menuClose && sideMenu && headerWrapper) {
        menuToggle.addEventListener('click', () => {
            sideMenu.classList.toggle('active');
            headerWrapper.classList.toggle('menu-active');
        });
        
        menuClose.addEventListener('click', () => {
            sideMenu.classList.remove('active');
            headerWrapper.classList.remove('menu-active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!sideMenu.contains(e.target) && !menuToggle.contains(e.target) && sideMenu.classList.contains('active')) {
                sideMenu.classList.remove('active');
                headerWrapper.classList.remove('menu-active');
            }
        });
    }
}

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
        
        .notification {
            animation: slideIn 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);
}

// Make functions globally available for HTML onclick attributes
window.logout = logout;