// ========== ПРОФИЛЬ: ЗАГРУЗКА ДАННЫХ ==========

let currentUserData = {};

// Форматирование времени суток для приветствия
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
}

// Загрузка данных пользователя
async function loadUserProfile() {
    try {
        const response = await fetch('/api/user');
        const user = await response.json();
        currentUserData = user;
        
        // Приветствие
        const greeting = getGreeting();
        const firstName = user.fullname ? user.fullname.split(' ')[0] : 'Пользователь';
        document.getElementById('greetingText').innerHTML = `${greeting}, <span id="userFirstName">${escapeHtml(firstName)}</span>!`;
        document.getElementById('userFullName').textContent = user.fullname || 'Не указано';
        document.getElementById('userId').textContent = user.id || '—';
        document.getElementById('userEmail').textContent = user.email || '—';
        
        // Карта
        if (user.card_last4) {
            document.getElementById('userCard').textContent = `•••• ${user.card_last4}`;
        } else {
            document.getElementById('userCard').textContent = 'не привязана';
        }
        
        // Загрузка статистики
        loadUserStats();
        
        // Загрузка заявок
        loadUserProposals();
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// Загрузка статистики
async function loadUserStats() {
    try {
        const response = await fetch('/api/user/stats');
        const stats = await response.json();
        
        document.getElementById('proposalsCount').textContent = stats.proposalsCount || 0;
        document.getElementById('realizedCount').textContent = stats.realizedCount || 0;
        document.getElementById('donationSum').textContent = (stats.donationSum || 0).toLocaleString() + ' ₽';
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка заявок пользователя
async function loadUserProposals() {
    try {
        const response = await fetch('/api/user/proposals');
        const data = await response.json();
        
        // Активные заявки
        const activeTbody = document.getElementById('activeIdeasList');
        if (data.active && data.active.length > 0) {
            activeTbody.innerHTML = data.active.map(proposal => `
                <tr class="clickable-row" data-id="${proposal.id}" data-type="active">
                    <td>${escapeHtml(proposal.title)}</td>
                    <td>${escapeHtml(proposal.address)}</td>
                    <td>№${proposal.id}</td>
                    <td>${proposal.likes || 0}</td>
                </tr>
            `).join('');
        } else {
            activeTbody.innerHTML = '<tr><td colspan="4" class="empty-row">У вас пока нет активных идей</td></tr>';
        }
        
        // Реализованные заявки
        const realizedTbody = document.getElementById('realizedIdeasList');
        if (data.realized && data.realized.length > 0) {
            realizedTbody.innerHTML = data.realized.map(proposal => `
                <tr class="clickable-row" data-id="${proposal.id}" data-type="realized">
                    <td>${escapeHtml(proposal.title)}</td>
                    <td>${escapeHtml(proposal.address)}</td>
                    <td>№${proposal.id}</td>
                    <td>${formatDate(proposal.created_at)}</td>
                </tr>
            `).join('');
        } else {
            realizedTbody.innerHTML = '<tr><td colspan="4" class="empty-row">У вас пока нет реализованных идей</td></tr>';
        }
        
        // Добавляем обработчики кликов на строки таблицы
        document.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                openProposalModal(row.dataset.id);
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

// Модальное окно для заявки (заглушка)
const proposalModal = document.getElementById('proposalModal');
const closeProposalModalBtn = document.getElementById('closeProposalModalBtn');
const proposalModalContent = document.getElementById('proposalModalContent');

function openProposalModal(proposalId) {
    if (proposalModal && proposalModalContent) {
        proposalModalContent.innerHTML = `
            <p>Заявка №${proposalId}</p>
            <p>Детали заявки будут доступны после реализации карты на главной странице</p>
        `;
        proposalModal.style.display = 'flex';
    }
}

if (closeProposalModalBtn && proposalModal) {
    closeProposalModalBtn.addEventListener('click', () => {
        proposalModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === proposalModal) {
            proposalModal.style.display = 'none';
        }
    });
}

// ========== РЕДАКТИРОВАНИЕ ПРОФИЛЯ ==========
const editProfileBtn = document.getElementById('editProfileBtn');
const editModal = document.getElementById('editProfileModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const editForm = document.getElementById('editProfileForm');
const avatarInput = document.getElementById('avatarInput');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const avatarPreview = document.getElementById('avatarPreview');

if (editProfileBtn && editModal) {
    editProfileBtn.addEventListener('click', () => {
        // Заполняем форму текущими данными
        document.getElementById('editFullname').value = currentUserData.fullname || '';
        document.getElementById('editEmail').value = currentUserData.email || '';
        document.getElementById('editPhone').value = currentUserData.phone || '';
        document.getElementById('editCardNumber').value = currentUserData.card_number || '';
        document.getElementById('editCardExpiry').value = currentUserData.card_expiry || '';
        document.getElementById('editCardCvv').value = '';
        
        editModal.style.display = 'flex';
    });
}

if (closeEditModalBtn && editModal) {
    closeEditModalBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
    });
}

// Загрузка аватара (заглушка)
if (uploadAvatarBtn && avatarInput) {
    uploadAvatarBtn.addEventListener('click', () => {
        avatarInput.click();
    });
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                avatarPreview.textContent = '';
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                avatarPreview.appendChild(img);
                // TODO: отправка аватара на сервер
            };
            reader.readAsDataURL(file);
        }
    });
}

// Сохранение данных профиля
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullname = document.getElementById('editFullname').value;
        const email = document.getElementById('editEmail').value;
        const phone = document.getElementById('editPhone').value;
        let card_number = document.getElementById('editCardNumber').value;
        const card_expiry = document.getElementById('editCardExpiry').value;
        const card_cvv = document.getElementById('editCardCvv').value;
        
        // Очистка номера карты от пробелов
        card_number = card_number.replace(/\s/g, '');
        
        const errorDiv = document.getElementById('editError');
        const successDiv = document.getElementById('editSuccess');
        
        try {
            const response = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, email, phone, card_number, card_expiry, card_cvv })
            });
            const data = await response.json();
            
            if (data.success) {
                successDiv.textContent = data.message;
                successDiv.style.display = 'block';
                errorDiv.style.display = 'none';
                
                // Обновляем отображаемые данные
                setTimeout(() => {
                    editModal.style.display = 'none';
                    location.reload();
                }, 1500);
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

// ========== КНОПКА ВЫЙТИ ==========
const logoutBtn = document.getElementById('logoutBtnProfile');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    });
}

// ========== МОДАЛЬНОЕ ОКНО С ИНФОРМАЦИЕЙ О ЗАЯВКАХ (кнопка i) ==========
const ideasInfoBtn = document.getElementById('ideasInfoBtn');
const ideasInfoModal = document.getElementById('ideasInfoModal');
const closeIdeasInfoBtn = document.getElementById('closeIdeasInfoBtn');

if (ideasInfoBtn && ideasInfoModal) {
    ideasInfoBtn.addEventListener('click', () => {
        ideasInfoModal.style.display = 'flex';
    });
}

if (closeIdeasInfoBtn && ideasInfoModal) {
    closeIdeasInfoBtn.addEventListener('click', () => {
        ideasInfoModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === ideasInfoModal) {
            ideasInfoModal.style.display = 'none';
        }
    });
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
});