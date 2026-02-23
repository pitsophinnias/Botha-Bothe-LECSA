document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const registerError = document.getElementById('register-error');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // Basic validation
            if (!username || !password || !confirmPassword) {
                registerError.textContent = 'Please fill in all fields';
                registerError.style.display = 'block';
                return;
            }

            if (password !== confirmPassword) {
                registerError.textContent = 'Passwords do not match';
                registerError.style.display = 'block';
                return;
            }

            if (password.length < 6) {
                registerError.textContent = 'Password must be at least 6 characters long';
                registerError.style.display = 'block';
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Registration successful! Please login.');
                    window.location.href = 'login.html';
                } else {
                    registerError.textContent = data.error || 'Error during registration';
                    registerError.style.display = 'block';
                }
            } catch (error) {
                console.error('Registration error:', error);
                registerError.textContent = 'Error during registration. Please try again.';
                registerError.style.display = 'block';
            }
        });
    }
});