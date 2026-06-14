// ========== ПРОФИЛЬ: ЗАГРУЗКА ДАННЫХ ==========

let currentUserData = {};

function showNotificationProfile(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        cursor: pointer;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    notification.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
}

function isProfilePage() {
    return window.location.pathname === '/profile';
}

async function loadUserProfile() {
    if (!isProfilePage()) return;
    
    try {
        const response = await fetch('/api/user');
        const user = await response.json();
        currentUserData = user;
        
        const greeting = getGreeting();
        const firstName = user.firstname || 'Пользователь';
        const greetingEl = document.getElementById('greetingText');
        if (greetingEl) {
            greetingEl.innerHTML = `${greeting}, <span id="userFirstName">${escapeHtmlProfile(firstName)}</span>!`;
        }
        
        const fullNameEl = document.getElementById('userFullName');
        if (fullNameEl) fullNameEl.textContent = (user.firstname || '') + ' ' + (user.lastname || '').trim() || 'Не указано';
        
        const userIdEl = document.getElementById('userId');
        if (userIdEl) userIdEl.textContent = user.id || '—';
        
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = user.email || '—';
        
        const userCardEl = document.getElementById('userCard');
        if (userCardEl) {
            if (user.card_last4) {
                userCardEl.textContent = `•••• ${user.card_last4}`;
            } else {
                userCardEl.textContent = 'не привязана';
            }
        }
        
        loadUserStats();
        loadUserProposals();
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function loadUserStats() {
    if (!isProfilePage()) return;
    try {
        const response = await fetch('/api/user/stats');
        const stats = await response.json();
        
        const proposalsCountEl = document.getElementById('proposalsCount');
        if (proposalsCountEl) proposalsCountEl.textContent = stats.proposalsCount || 0;
        
        const realizedCountEl = document.getElementById('realizedCount');
        if (realizedCountEl) realizedCountEl.textContent = stats.realizedCount || 0;
        
        const donationSumEl = document.getElementById('donationSum');
        if (donationSumEl) donationSumEl.textContent = (stats.donationSum || 0).toLocaleString() + ' ₽';
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadUserProposals() {
    if (!isProfilePage()) return;
    try {
        const response = await fetch('/api/user/proposals');
        const data = await response.json();
        
        const activeTbody = document.getElementById('activeIdeasList');
        if (activeTbody) {
            if (data.active && data.active.length > 0) {
                activeTbody.innerHTML = data.active.map(proposal => `
                    <tr class="clickable-row" data-lat="${proposal.lat || ''}" data-lng="${proposal.lng || ''}" data-address="${escapeHtmlProfile(proposal.address)}">
                        <td>${escapeHtmlProfile(proposal.title)}</td>
                        <td>${escapeHtmlProfile(proposal.address)}</td>
                        <td>№${proposal.id}</td>
                        <td>${proposal.likes || 0}</td>
                    </tr>
                `).join('');
            } else {
                activeTbody.innerHTML = '<tr><td colspan="4" class="empty-row">У вас пока нет активных идей</td></tr>';
            }
        }
        
        const realizedTbody = document.getElementById('realizedIdeasList');
        if (realizedTbody) {
            if (data.realized && data.realized.length > 0) {
                realizedTbody.innerHTML = data.realized.map(proposal => `
                    <tr class="clickable-row" data-lat="${proposal.lat || ''}" data-lng="${proposal.lng || ''}" data-address="${escapeHtmlProfile(proposal.address)}">
                        <td>${escapeHtmlProfile(proposal.title)}</td>
                        <td>${escapeHtmlProfile(proposal.address)}</td>
                        <td>№${proposal.id}</td>
                        <td>${formatDateProfile(proposal.created_at)}</td>
                    </tr>
                `).join('');
            } else {
                realizedTbody.innerHTML = '<tr><td colspan="4" class="empty-row">У вас пока нет реализованных идей</td></tr>';
            }
        }
        
        document.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const lat = row.dataset.lat;
                const lng = row.dataset.lng;
                const address = row.dataset.address;
                
                if (lat && lng && lat !== '' && lng !== '' && window.openProposalFormModal) {
                    window.currentLat = parseFloat(lat);
                    window.currentLng = parseFloat(lng);
                    const addressInput = document.getElementById('proposalAddress');
                    if (addressInput && address) {
                        addressInput.value = address;
                    }
                    window.openProposalFormModal([parseFloat(lat), parseFloat(lng)], address || 'Адрес не определён');
                } else {
                    showNotificationProfile('Координаты для этой заявки не найдены', 'error');
                }
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

async function loadUserChats() {
    const chatsContainer = document.getElementById('chatsList');
    if (!chatsContainer) return;
    
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        if (data.success && data.chats.length > 0) {
            chatsContainer.innerHTML = data.chats.map(chat => `
                <div class="chat-list-item-small" data-id="${chat.proposal_id}">
                    <div class="chat-list-item-small__icon">💬</div>
                    <div class="chat-list-item-small__info">
                        <div class="chat-list-item-small__title">${escapeHtmlProfile(chat.title)}</div>
                        <div class="chat-list-item-small__meta">${chat.participants_count} участников</div>
                    </div>
                    ${chat.unread_count > 0 ? `<div class="chat-list-item-small__unread">${chat.unread_count}</div>` : ''}
                </div>
            `).join('');
            
            document.querySelectorAll('.chat-list-item-small').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    window.location.href = `/chat/${id}`;
                });
            });
        } else {
            chatsContainer.innerHTML = '<div class="chat-placeholder">У вас пока нет чатов</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
        chatsContainer.innerHTML = '<div class="chat-placeholder">Ошибка загрузки</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadUserChats(); // Добавь эту строку
});

const proposalModal = document.getElementById('proposalModal');
const closeProposalModalBtn = document.getElementById('closeProposalModalBtn');

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
        document.getElementById('editFirstname').value = currentUserData.firstname || '';
        document.getElementById('editLastname').value = currentUserData.lastname || '';
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
            };
            reader.readAsDataURL(file);
        }
    });
}

if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const firstname = document.getElementById('editFirstname').value;
        const lastname = document.getElementById('editLastname').value;
        const email = document.getElementById('editEmail').value;
        const phone = document.getElementById('editPhone').value;
        let card_number = document.getElementById('editCardNumber').value;
        const card_expiry = document.getElementById('editCardExpiry').value;
        const card_cvv = document.getElementById('editCardCvv').value;
        
        card_number = card_number.replace(/\s/g, '');
        
        const errorDiv = document.getElementById('editError');
        const successDiv = document.getElementById('editSuccess');
        
        try {
            const response = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstname, lastname, email, phone, card_number, card_expiry, card_cvv })
            });
            const data = await response.json();
            
            if (data.success) {
                errorDiv.style.display = 'none';
                showNotificationProfile('✅ Профиль успешно обновлён!', 'success');
                
                setTimeout(() => {
                    editModal.style.display = 'none';
                    location.reload();
                }, 1500);
            } else {
                errorDiv.textContent = data.message;
                errorDiv.style.display = 'block';
                showNotificationProfile(data.message, 'error');
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка соединения';
            errorDiv.style.display = 'block';
            showNotificationProfile('Ошибка соединения с сервером', 'error');
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

// ========== МОДАЛЬНОЕ ОКНО С ИНФОРМАЦИЕЙ О ЗАЯВКАХ ==========
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
function escapeHtmlProfile(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateProfile(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
});