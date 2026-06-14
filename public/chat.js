// ========== ЧАТ ==========

let currentProposalId = null;
let currentChatTitle = '';
let allMessages = [];
let otherChats = [];

// Получаем ID чата из URL
function getProposalIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/chat\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Функция уведомлений
function showNotificationChat(message, type = 'success') {
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

// Загрузка сообщений чата
async function loadMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '<div class="empty-row">Загрузка сообщений...</div>';
    
    try {
        const response = await fetch(`/api/chats/${currentProposalId}/messages`);
        const data = await response.json();
        
        if (data.success) {
            allMessages = data.messages;
            currentChatTitle = data.title;
            document.getElementById('chatTitle').textContent = data.title;
            document.getElementById('chatParticipants').textContent = `👥 ${data.participants_count} участников`;
            
            renderMessages(allMessages);
        } else {
            messagesContainer.innerHTML = '<div class="empty-row">Ошибка загрузки сообщений</div>';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        messagesContainer.innerHTML = '<div class="empty-row">Ошибка загрузки</div>';
    }
}

// Отображение сообщений
function renderMessages(messages) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-row">Пока нет сообщений. Напишите первым!</div>';
        return;
    }
    
    messagesContainer.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.is_mine ? 'chat-message--mine' : 'chat-message--other'}">
            <div class="chat-message__author">${escapeHtmlChat(msg.user_name)}</div>
            <div class="chat-message__text">${escapeHtmlChat(msg.text)}</div>
            <div class="chat-message__time">${formatChatTime(msg.created_at)}</div>
        </div>
    `).join('');
    
    // Скролл вниз
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Форматирование времени
function formatChatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Отправка сообщения
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) {
        showNotificationChat('Введите сообщение', 'error');
        return;
    }
    
    if (text.length > 1000) {
        showNotificationChat('Сообщение слишком длинное (макс. 1000 символов)', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/chats/${currentProposalId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await response.json();
        
        if (data.success) {
            input.value = '';
            allMessages.push(data.message);
            renderMessages(allMessages);
        } else {
            showNotificationChat(data.message || 'Ошибка отправки', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotificationChat('Ошибка соединения', 'error');
    }
}

// Загрузка списка других чатов
async function loadOtherChats() {
    const container = document.getElementById('otherChatsList');
    if (!container) return;
    
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        if (data.success) {
            otherChats = data.chats.filter(chat => chat.proposal_id !== currentProposalId);
            
            if (otherChats.length === 0) {
                container.innerHTML = '<div class="empty-row">Нет других чатов</div>';
                return;
            }
            
            container.innerHTML = otherChats.map(chat => `
                <div class="chat-list-item" data-id="${chat.proposal_id}">
                    <div class="chat-list-item__icon">💬</div>
                    <div class="chat-list-item__info">
                        <div class="chat-list-item__title">${escapeHtmlChat(chat.title)}</div>
                        <div class="chat-list-item__meta">👥 ${chat.participants_count} участников</div>
                    </div>
                    ${chat.unread_count > 0 ? `<div class="chat-list-item__unread">${chat.unread_count}</div>` : ''}
                </div>
            `).join('');
            
            // Обработчики кликов по чатам
            document.querySelectorAll('.chat-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    window.location.href = `/chat/${id}`;
                });
            });
        }
    } catch (error) {
        console.error('Ошибка:', error);
        container.innerHTML = '<div class="empty-row">Ошибка загрузки</div>';
    }
}

// Выйти из чата
async function leaveChat() {
    if (confirm('Вы уверены, что хотите выйти из чата? Он исчезнет из вашего списка чатов.')) {
        try {
            const response = await fetch(`/api/chats/${currentProposalId}/leave`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                showNotificationChat('Вы вышли из чата', 'success');
                setTimeout(() => {
                    window.location.href = '/profile';
                }, 1000);
            } else {
                showNotificationChat('Ошибка при выходе', 'error');
            }
        } catch (error) {
            showNotificationChat('Ошибка соединения', 'error');
        }
    }
}

// Поиск по чату
function searchInChat() {
    const query = document.getElementById('searchQueryInput').value.trim().toLowerCase();
    const modal = document.getElementById('searchModal');
    const resultsContainer = document.getElementById('searchResultsList');
    
    if (!query) {
        showNotificationChat('Введите текст для поиска', 'error');
        return;
    }
    
    const results = allMessages.filter(msg => msg.text.toLowerCase().includes(query));
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="empty-row">Ничего не найдено</div>';
    } else {
        resultsContainer.innerHTML = results.map(msg => `
            <div class="search-result-msg">
                <div class="search-result-msg__author">${escapeHtmlChat(msg.user_name)}</div>
                <div class="search-result-msg__text">${escapeHtmlChat(msg.text)}</div>
                <div class="search-result-msg__time">${formatChatTime(msg.created_at)}</div>
            </div>
        `).join('');
    }
}

// Уведомления (заглушка)
function toggleNotifications() {
    showNotificationChat('Уведомления будут доступны в следующей версии', 'info');
}

// Эскейпинг HTML
function escapeHtmlChat(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    currentProposalId = getProposalIdFromUrl();
    
    if (currentProposalId !== null) {
        loadMessages();
        loadOtherChats();
        
        // Обработчики кнопок
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
        
        const leaveBtn = document.getElementById('leaveChatBtn');
        if (leaveBtn) leaveBtn.addEventListener('click', leaveChat);
        
        const notificationsBtn = document.getElementById('notificationsBtn');
        if (notificationsBtn) notificationsBtn.addEventListener('click', toggleNotifications);
        
        const searchChatBtn = document.getElementById('searchChatBtn');
        const searchModal = document.getElementById('searchModal');
        const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
        const doSearchBtn = document.getElementById('doSearchBtn');
        
        if (searchChatBtn && searchModal) {
            searchChatBtn.addEventListener('click', () => {
                searchModal.style.display = 'flex';
                document.getElementById('searchQueryInput').value = '';
                document.getElementById('searchResultsList').innerHTML = '';
            });
        }
        
        if (closeSearchModalBtn && searchModal) {
            closeSearchModalBtn.addEventListener('click', () => {
                searchModal.style.display = 'none';
            });
            searchModal.addEventListener('click', (e) => {
                if (e.target === searchModal) searchModal.style.display = 'none';
            });
        }
        
        if (doSearchBtn) {
            doSearchBtn.addEventListener('click', searchInChat);
        }
        
        // Обновление списка чатов каждые 30 секунд
        setInterval(loadOtherChats, 30000);
        // Обновление сообщений каждые 5 секунд
        setInterval(loadMessages, 5000);
    }
});