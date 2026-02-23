document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // Check if already logged in
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
        console.log('Already logged in, redirecting...');
        window.location.href = 'regsys.html';
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            // Basic validation
            if (!username || !password) {
                showError('Please enter both username and password');
                return;
            }

            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;
            loginError.style.display = 'none';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();
                console.log('Login response:', data);

                if (response.ok) {
                    // Debug logging
                    console.log('Login successful!');
                    console.log('Token received:', data.token ? 'Yes' : 'No');
                    console.log('Token length:', data.token?.length);
                    console.log('User role:', data.user?.role);
                    
                    // Store authentication data
                    if (data.token) {
                        localStorage.setItem('token', data.token);
                        console.log('Token stored in localStorage');
                    }
                    
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                        localStorage.setItem('role', data.user.role || 'member');
                        localStorage.setItem('userId', data.user.id || '');
                        localStorage.setItem('userName', data.user.name || username);
                        console.log('User data stored');
                    }
                    
                    // Immediately redirect to registration system - token will be validated on next API call
                    console.log('Login successful, redirecting...');
                    
                    // Clear any old intervals
                    if (window.recentActivitiesInterval) {
                        clearInterval(window.recentActivitiesInterval);
                    }
                    
                    // Redirect to registration system
                    window.location.href = 'regsys.html';
                    
                } else {
                    // Login failed
                    console.error('Login failed:', data.error);
                    showError(data.error || 'Invalid username or password');
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('Network error. Please check your connection.');
            } finally {
                // Reset button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    function showError(message) {
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
            
            // Auto-hide error after 5 seconds
            setTimeout(() => {
                loginError.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }
});