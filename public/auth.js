// ========== ЛОГИКА СТРАНИЦЫ ВХОДА ==========
const loginForm = document.getElementById('loginForm');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotModal = document.getElementById('forgotModal');
const closeForgotModalBtn = document.getElementById('closeForgotModalBtn');
const forgotForm = document.getElementById('forgotForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            
            if (data.success) {
                window.location.href = data.redirect || '/';
            } else {
                errorDiv.textContent = data.message;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка соединения с сервером';
            errorDiv.style.display = 'block';
        }
    });
}

// Восстановление пароля (заглушка)
if (forgotPasswordLink && forgotModal) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal.style.display = 'flex';
    });
}

if (closeForgotModalBtn && forgotModal) {
    closeForgotModalBtn.addEventListener('click', () => {
        forgotModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            forgotModal.style.display = 'none';
        }
    });
}

if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;
        const errorDiv = document.getElementById('forgotError');
        const successDiv = document.getElementById('forgotSuccess');
        
        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            
            if (data.success) {
                successDiv.textContent = data.message;
                successDiv.style.display = 'block';
                errorDiv.style.display = 'none';
                setTimeout(() => {
                    forgotModal.style.display = 'none';
                    successDiv.style.display = 'none';
                    document.getElementById('resetEmail').value = '';
                }, 3000);
            } else {
                errorDiv.textContent = data.message;
                errorDiv.style.display = 'block';
                successDiv.style.display = 'none';
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.style.display = 'block';
        }
    });
}

// ========== ЛОГИКА СТРАНИЦЫ РЕГИСТРАЦИИ ==========
const registerForm = document.getElementById('registerForm');
const attachCardCheckbox = document.getElementById('attachCardCheckbox');
const cardFields = document.getElementById('cardFields');

if (attachCardCheckbox && cardFields) {
    attachCardCheckbox.addEventListener('change', (e) => {
        cardFields.style.display = e.target.checked ? 'block' : 'none';
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const firstname = document.getElementById('firstname').value;
        const lastname = document.getElementById('lastname').value;
        const phone = document.getElementById('phone')?.value || '';
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const agree = document.getElementById('agreeCheckbox').checked;
        
        const attachCard = attachCardCheckbox ? attachCardCheckbox.checked : false;
        let card_number = '', card_expiry = '', card_cvv = '';
        
        if (attachCard) {
            card_number = document.getElementById('card_number')?.value || '';
            card_expiry = document.getElementById('card_expiry')?.value || '';
            card_cvv = document.getElementById('card_cvv')?.value || '';
        }
        
        const errorDiv = document.getElementById('registerError');
        
        if (password.length < 6) {
            errorDiv.textContent = 'Пароль должен быть не менее 6 символов';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email, password, firstname, lastname, phone,
                    card_number, card_expiry, card_cvv,
                    agree
                })
            });
            const data = await response.json();
            
            if (data.success) {
                window.location.href = '/';
            } else {
                errorDiv.textContent = data.message;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка соединения с сервером';
            errorDiv.style.display = 'block';
        }
    });
}