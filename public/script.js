// ========== ЯНДЕКС КАРТА ==========

let currentMap;
let markers = [];
let miniMap = null;
let miniMapPlacemark = null;
let currentLat = null;
let currentLng = null;
let isLiking = false;

// ========== ФУНКЦИЯ ДЛЯ УВЕДОМЛЕНИЙ ==========
function showNotification(message, type = 'success') {
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

// Добавляем CSS для анимации уведомлений
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ========== ЗАГРУЗКА МЕТОК НА КАРТУ ==========

async function loadProposalsToMap(map) {
    try {
        const response = await fetch('/api/proposals/published');
        const proposals = await response.json();
        
        console.log('📋 Загружено заявок:', proposals.length);
        
        markers.forEach(marker => {
            map.geoObjects.remove(marker);
        });
        markers = [];
        
        proposals.forEach(proposal => {
            const marker = new ymaps.Placemark(
                [proposal.lat, proposal.lng],
                {},
                {
                    preset: 'islands#blueCircleIcon',
                    iconColor: '#0066cc'
                }
            );
            
            marker.events.add('click', () => {
                currentLat = proposal.lat;
                currentLng = proposal.lng;
                document.getElementById('proposalAddress').value = proposal.address;
                openProposalFormModal([proposal.lat, proposal.lng], proposal.address);
            });
            
            map.geoObjects.add(marker);
            markers.push(marker);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

function addMarkerToMap(proposal) {
    if (!currentMap) return;
    
    const marker = new ymaps.Placemark(
        [proposal.lat, proposal.lng],
        {},
        {
            preset: 'islands#blueCircleIcon',
            iconColor: '#0066cc'
        }
    );
    
    marker.events.add('click', () => {
        currentLat = proposal.lat;
        currentLng = proposal.lng;
        document.getElementById('proposalAddress').value = proposal.address;
        openProposalFormModal([proposal.lat, proposal.lng], proposal.address);
    });
    
    currentMap.geoObjects.add(marker);
    markers.push(marker);
}

// ========== КАРТА (ОСНОВНАЯ) ==========

function initMap() {
    const mapContainer = document.getElementById('yandexMap');
    if (!mapContainer) return;
    
    currentMap = new ymaps.Map('yandexMap', {
        center: [59.93, 30.31],
        zoom: 12
    });
    
    console.log('✅ Карта загружена');
    
    loadProposalsToMap(currentMap);
    
    // Клик по карте
    currentMap.events.add('click', (e) => {
        const coords = e.get('coords');
        currentLat = coords[0];
        currentLng = coords[1];
        
        ymaps.geocode(coords, {
            results: 1,
            kind: 'house'
        }).then((res) => {
            const firstGeoObject = res.geoObjects.get(0);
            let address = 'Адрес не определён';
            if (firstGeoObject) {
                address = firstGeoObject.getAddressLine();
            }
            document.getElementById('proposalAddress').value = address;
            openProposalFormModal(coords, address);
        }).catch(() => {
            openProposalFormModal(coords, 'Адрес не определён');
        });
    });
}

// ========== ЗАГРУЗКА КАРТЫ ==========

function loadYandexMap() {
    if (document.getElementById('yandexMap')) {
        const script = document.createElement('script');
        script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
        script.onload = () => {
            ymaps.ready(initMap);
        };
        document.head.appendChild(script);
    }
}

// ========== МОДАЛЬНОЕ ОКНО ДЛЯ ФОРМЫ ЗАЯВКИ ==========

function openProposalFormModal(coords, address) {
    const modal = document.getElementById('proposalFormModal');
    const addressInput = document.getElementById('proposalAddress');
    const titleInput = document.getElementById('proposalTitle');
    const descInput = document.getElementById('proposalDescription');
    const errorDiv = document.getElementById('proposalFormError');
    const otherList = document.getElementById('otherProposalsList');
    const miniMapSearch = document.getElementById('miniMapSearch');
    
    if (!modal) return;
    
    if (addressInput) addressInput.value = address;
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (miniMapSearch) miniMapSearch.value = '';
    if (errorDiv) errorDiv.style.display = 'none';
    if (otherList) otherList.innerHTML = '<p class="empty-row">Загрузка...</p>';
    
    modal.style.display = 'flex';
    
    setTimeout(() => {
        initMiniMap(coords, address);
    }, 100);
    
    loadOtherProposalsByCoords(coords, address);
}

// Загрузка заявок по координатам (радиус 500 метров)
async function loadOtherProposalsByCoords(coords, address) {
    const otherList = document.getElementById('otherProposalsList');
    if (!otherList) return;
    
    console.log('🔍 Загружаем заявки для координат:', coords);
    
    try {
        const response = await fetch('/api/proposals/published');
        const allProposals = await response.json();
        
        // Функция для вычисления расстояния между двумя точками
        function getDistance(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        
        // Фильтруем заявки в радиусе 500 метров
        const nearbyProposals = allProposals.filter(proposal => {
            const distance = getDistance(coords[0], coords[1], proposal.lat, proposal.lng);
            return distance <= 0.5;
        });
        
        console.log('📋 Найдено заявок рядом:', nearbyProposals.length);
        
        if (nearbyProposals.length === 0) {
            otherList.innerHTML = '<p class="empty-row">Пока нет идей рядом с этим местом. Будьте первым!</p>';
            return;
        }
        
        // Сортируем по расстоянию
        nearbyProposals.sort((a, b) => {
            const distA = getDistance(coords[0], coords[1], a.lat, a.lng);
            const distB = getDistance(coords[0], coords[1], b.lat, b.lng);
            return distA - distB;
        });
        
        otherList.innerHTML = nearbyProposals.map(proposal => `
            <div class="other-proposal-card" data-id="${proposal.id}">
                <div class="other-proposal-header">
                    <div class="other-proposal-author">
                        <span class="author-icon">👤</span>
                        <span class="author-name">${escapeHtml(proposal.author_name || 'Пользователь')}</span>
                        <span class="proposal-date">${formatDate(proposal.created_at)}</span>
                    </div>
                </div>
                <div class="other-proposal-title">"${escapeHtml(proposal.title)}"</div>
                <div class="other-proposal-description">${escapeHtml(proposal.description)}</div>
                <div class="other-proposal-actions">
                    <button class="like-btn" data-id="${proposal.id}" data-likes="${proposal.likes}">
                        👍 <span class="likes-count">${proposal.likes}</span>
                    </button>
                    <button class="chat-btn" data-id="${proposal.id}">💬 Чат</button>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.removeEventListener('click', handleLikeClick);
            btn.addEventListener('click', handleLikeClick);
        });
        
        document.querySelectorAll('.chat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showNotification('Чат будет доступен в следующей версии', 'info');
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        otherList.innerHTML = '<p class="empty-row">Ошибка загрузки. Попробуйте снова.</p>';
    }
}

// Инициализация мини-карты
function initMiniMap(coords, currentAddress) {
    const miniMapContainer = document.getElementById('miniMap');
    if (!miniMapContainer) return;
    
    miniMapContainer.innerHTML = '';
    
    if (typeof ymaps === 'undefined') {
        setTimeout(() => initMiniMap(coords, currentAddress), 200);
        return;
    }
    
    miniMap = new ymaps.Map('miniMap', {
        center: [coords[0], coords[1]],
        zoom: 17,
        controls: ['zoomControl']
    });
    
    miniMapPlacemark = new ymaps.Placemark(
        [coords[0], coords[1]],
        {},
        { preset: 'islands#blueCircleIcon' }
    );
    miniMap.geoObjects.add(miniMapPlacemark);
    
    // Поиск на мини-карте
    const miniMapSearch = document.getElementById('miniMapSearch');
    const miniMapSearchBtn = document.getElementById('miniMapSearchBtn');
    
    if (miniMapSearchBtn && miniMapSearch) {
        const newBtn = miniMapSearchBtn.cloneNode(true);
        miniMapSearchBtn.parentNode.replaceChild(newBtn, miniMapSearchBtn);
        
        newBtn.onclick = async () => {
            const query = miniMapSearch.value.trim();
            if (!query) {
                showNotification('Введите адрес для поиска', 'error');
                return;
            }
            
            showNotification('Поиск адреса...', 'info');
            
            try {
                const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=ваш_ключ&geocode=${encodeURIComponent(query)}&format=json`);
                // В бесплатной версии Яндекс.Карт API ключ не нужен для геокодирования на клиенте
                // Используем ymaps.geocode
                ymaps.geocode(query, { results: 1 }).then((res) => {
                    const firstGeoObject = res.geoObjects.get(0);
                    if (firstGeoObject) {
                        const newCoords = firstGeoObject.geometry.getCoordinates();
                        miniMap.setCenter(newCoords, 17);
                        miniMapPlacemark.geometry.setCoordinates(newCoords);
                        currentLat = newCoords[0];
                        currentLng = newCoords[1];
                        const newAddress = firstGeoObject.getAddressLine();
                        document.getElementById('proposalAddress').value = newAddress;
                        loadOtherProposalsByCoords(newCoords, newAddress);
                        showNotification('Адрес найден', 'success');
                    } else {
                        showNotification('Адрес не найден', 'error');
                    }
                }).catch((err) => {
                    console.error('Ошибка геокодирования:', err);
                    showNotification('Ошибка поиска адреса', 'error');
                });
            } catch (error) {
                console.error('Ошибка:', error);
                showNotification('Ошибка поиска', 'error');
            }
        };
    }
    
    // Клик на мини-карте
    miniMap.events.add('click', (e) => {
        const newCoords = e.get('coords');
        currentLat = newCoords[0];
        currentLng = newCoords[1];
        miniMapPlacemark.geometry.setCoordinates(newCoords);
        
        ymaps.geocode(newCoords).then((res) => {
            const firstGeoObject = res.geoObjects.get(0);
            const address = firstGeoObject ? firstGeoObject.getAddressLine() : 'Адрес не определён';
            document.getElementById('proposalAddress').value = address;
            loadOtherProposalsByCoords(newCoords, address);
        }).catch(() => {
            document.getElementById('proposalAddress').value = 'Адрес не определён';
            loadOtherProposalsByCoords(newCoords, 'Адрес не определён');
        });
    });
}

// Обработчик лайка
async function handleLikeClick(e) {
    e.stopPropagation();
    if (isLiking) return;
    
    const btn = e.currentTarget;
    const proposalId = btn.dataset.id;
    const likesSpan = btn.querySelector('.likes-count');
    
    isLiking = true;
    btn.style.opacity = '0.6';
    
    try {
        const response = await fetch('/api/proposals/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId })
        });
        const data = await response.json();
        
        if (data.success) {
            if (likesSpan) likesSpan.textContent = data.likes;
            btn.dataset.likes = data.likes;
            showNotification('👍 Вы поддержали эту идею!', 'success');
        } else {
            showNotification(data.message || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Ошибка при лайке:', error);
        showNotification('Ошибка соединения', 'error');
    } finally {
        isLiking = false;
        btn.style.opacity = '1';
    }
}

// Отправка новой заявки
const proposalForm = document.getElementById('proposalForm');
if (proposalForm) {
    proposalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('proposalTitle')?.value.trim() || '';
        const description = document.getElementById('proposalDescription')?.value.trim() || '';
        const address = document.getElementById('proposalAddress')?.value || '';
        const errorDiv = document.getElementById('proposalFormError');
        
        if (!title || !description) {
            if (errorDiv) {
                errorDiv.textContent = 'Заполните название и описание';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (title.length < 5) {
            if (errorDiv) {
                errorDiv.textContent = 'Название должно быть не менее 5 символов';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (description.length < 10) {
            if (errorDiv) {
                errorDiv.textContent = 'Описание должно быть не менее 10 символов';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        try {
            const response = await fetch('/api/proposals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    address,
                    lat: currentLat,
                    lng: currentLng
                })
            });
            const data = await response.json();
            
            if (data.success) {
                const modal = document.getElementById('proposalFormModal');
                if (modal) modal.style.display = 'none';
                
                if (data.proposal) {
                    addMarkerToMap(data.proposal);
                }
                
                showNotification('✅ Заявка успешно создана! Она появится на карте и в вашем профиле.', 'success');
            } else {
                if (errorDiv) {
                    errorDiv.textContent = data.message;
                    errorDiv.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Ошибка при создании заявки:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Ошибка соединения с сервером';
                errorDiv.style.display = 'block';
            }
        }
    });
}

// Закрытие модального окна формы по крестику
const closeProposalFormBtn = document.getElementById('closeProposalFormBtn');
if (closeProposalFormBtn) {
    closeProposalFormBtn.addEventListener('click', () => {
        const modal = document.getElementById('proposalFormModal');
        if (modal) modal.style.display = 'none';
    });
}

// ========== МОДАЛЬНОЕ ОКНО ДЛЯ КНОПКИ i (правила) ==========
const infoModal = document.getElementById('infoModal');
const openBtn = document.getElementById('infoModalBtn');
const closeBtn = document.getElementById('closeModalBtn');

if (openBtn && infoModal && closeBtn) {
    openBtn.addEventListener('click', () => {
        infoModal.style.display = 'flex';
    });
    closeBtn.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });
}

// ========== ЗАГЛУШКИ ДЛЯ КНОПОК ==========
const searchBtn = document.querySelector('.search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        showNotification('🔍 Поиск по сайту пока в разработке', 'info');
    });
}

// ========== НОВОСТИ НА ГЛАВНОЙ СТРАНИЦЕ ==========
async function loadMainNews() {
    const newsGrid = document.getElementById('mainNewsGrid');
    if (!newsGrid) return;
    
    try {
        const response = await fetch('/api/news/main');
        const news = await response.json();
        
        if (news.length === 0) {
            newsGrid.innerHTML = '<p>Новостей пока нет</p>';
            return;
        }
        
        newsGrid.innerHTML = news.map(item => `
            <div class="news-card" data-news-id="${item.id}">
                <div class="news-card__image ${!item.image ? 'placeholder-img' : ''}" style="${item.image ? `background-image: url(${item.image}); background-size: cover; background-position: center;` : ''}"></div>
                <h3 class="news-card__title">${escapeHtml(item.title)}</h3>
                <p class="news-card__date">${formatDate(item.date)}</p>
                <p class="news-card__excerpt">${escapeHtml(item.excerpt)}</p>
                <button class="news-card__read-more btn-link" data-id="${item.id}">Читать далее →</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.news-card__read-more').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                openNewsModal(id);
            });
        });
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
    }
}

// ========== НОВОСТИ НА СТРАНИЦЕ /NEWS ==========
let currentPage = 1;
let totalPages = 1;

async function loadNewsPage(page = 1) {
    const newsGrid = document.getElementById('newsGrid');
    const paginationDiv = document.getElementById('pagination');
    if (!newsGrid) return;
    
    try {
        const response = await fetch(`/api/news?page=${page}`);
        const data = await response.json();
        
        currentPage = data.currentPage;
        totalPages = data.totalPages;
        
        if (data.news.length === 0) {
            newsGrid.innerHTML = '<p class="no-news">Новостей пока нет</p>';
            if (paginationDiv) paginationDiv.innerHTML = '';
            return;
        }
        
        newsGrid.innerHTML = data.news.map(item => `
            <div class="news-card" data-news-id="${item.id}">
                <div class="news-card__image ${!item.image ? 'placeholder-img' : ''}" style="${item.image ? `background-image: url(${item.image}); background-size: cover; background-position: center;` : ''}"></div>
                <h3 class="news-card__title">${escapeHtml(item.title)}</h3>
                <p class="news-card__date">${formatDate(item.date)}</p>
                <p class="news-card__excerpt">${escapeHtml(item.excerpt)}</p>
                <button class="news-card__read-more btn-link" data-id="${item.id}">Читать далее →</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.news-card__read-more').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                openNewsModal(id);
            });
        });
        
        if (paginationDiv) {
            paginationDiv.innerHTML = renderPagination(currentPage, totalPages);
            document.querySelectorAll('.pagination a[data-page]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const newPage = parseInt(link.dataset.page);
                    if (!isNaN(newPage) && newPage !== currentPage) {
                        loadNewsPage(newPage);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
    }
}

function renderPagination(current, total) {
    let html = '';
    if (current > 1) {
        html += `<a href="#" data-page="${current - 1}">◀ Назад</a>`;
    } else {
        html += `<span class="disabled">◀ Назад</span>`;
    }
    
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);
    if (end - start < 4) {
        if (start === 1) end = Math.min(total, start + 4);
        if (end === total) start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) {
        if (i === current) {
            html += `<span class="active">${i}</span>`;
        } else {
            html += `<a href="#" data-page="${i}">${i}</a>`;
        }
    }
    
    if (current < total) {
        html += `<a href="#" data-page="${current + 1}">Вперед ▶</a>`;
    } else {
        html += `<span class="disabled">Вперед ▶</span>`;
    }
    return html;
}

// ========== МОДАЛЬНОЕ ОКНО ДЛЯ НОВОСТИ ==========
const newsModal = document.getElementById('newsModal');
const closeNewsModalBtn = document.getElementById('closeNewsModalBtn');
const newsModalContent = document.getElementById('newsModalContent');

async function openNewsModal(id) {
    if (!newsModal || !newsModalContent) return;
    
    try {
        const response = await fetch(`/api/news/${id}`);
        const news = await response.json();
        
        newsModalContent.innerHTML = `
            <h3>${escapeHtml(news.title)}</h3>
            <div class="news-modal-date">${formatDate(news.date)}</div>
            ${news.image ? `<img src="${news.image}" alt="${escapeHtml(news.title)}" style="width: 100%; border-radius: 16px; margin: 16px 0;">` : ''}
            <p style="line-height: 1.6;">${escapeHtml(news.content).replace(/\n/g, '<br>')}</p>
        `;
        newsModal.style.display = 'flex';
    } catch (error) {
        console.error('Ошибка загрузки новости:', error);
        showNotification('Не удалось загрузить новость', 'error');
    }
}

if (closeNewsModalBtn && newsModal) {
    closeNewsModalBtn.addEventListener('click', () => {
        newsModal.style.display = 'none';
    });
}

// ========== МОДАЛЬНОЕ ОКНО ДЛЯ БАННЕРА (detailModal) ==========
const detailModal = document.getElementById('detailModal');
const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');

if (closeDetailModalBtn && detailModal) {
    closeDetailModalBtn.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
}

// ========== ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ПО КЛИКУ ВНЕ ОКНА ==========
window.addEventListener('click', (e) => {
    const modal = document.getElementById('proposalFormModal');
    if (e.target === modal) {
        modal.style.display = 'none';
    }
    
    const infoModalEl = document.getElementById('infoModal');
    if (e.target === infoModalEl) {
        infoModalEl.style.display = 'none';
    }
    
    const newsModalEl = document.getElementById('newsModal');
    if (e.target === newsModalEl) {
        newsModalEl.style.display = 'none';
    }
    
    const detailModalEl = document.getElementById('detailModal');
    if (e.target === detailModalEl) {
        detailModalEl.style.display = 'none';
    }
});

// ========== ИНФОРМАЦИОННЫЙ БАННЕР (из БД) ==========
async function loadBanner() {
    const bannerContainer = document.querySelector('.info-banner');
    if (!bannerContainer) return;
    
    try {
        const response = await fetch('/api/banner');
        const config = await response.json();
        
        if (!config) {
            bannerContainer.style.display = 'none';
            return;
        }
        
        const titleEl = document.getElementById('bannerTitle');
        const textEl = document.getElementById('bannerText');
        const actionBtn = document.getElementById('bannerActionBtn');
        const timerBlock = document.getElementById('bannerTimer');
        const timerDigitsSpan = document.getElementById('timerDigits');
        
        if (titleEl) titleEl.textContent = config.title;
        if (textEl) textEl.textContent = config.text;
        
        if (actionBtn) {
            if (config.button_text) {
                actionBtn.style.display = 'flex';
                actionBtn.textContent = config.button_text;  // "Чат голосования"
                actionBtn.onclick = () => {
                    showNotification(`Функция "${config.button_text}" будет доступна после запуска чатов`, 'info');
                };
            } else {
                actionBtn.style.display = 'none';
            }
        }
        
        if (config.show_timer && config.end_date && timerBlock) {
            timerBlock.style.display = 'block';
            const endDate = new Date(config.end_date);
            
            function updateTimer() {
                const now = new Date();
                const diff = endDate - now;
                if (diff <= 0) {
                    if (timerDigitsSpan) timerDigitsSpan.textContent = 'Голосование завершено!';
                    return;
                }
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                if (timerDigitsSpan) timerDigitsSpan.textContent = `${days}д ${hours.toString().padStart(2,'0')}ч ${minutes.toString().padStart(2,'0')}м`;
            }
            updateTimer();
            setInterval(updateTimer, 60000);
        } else if (timerBlock) {
            timerBlock.style.display = 'none';
        }
        
        const readMoreLink = document.getElementById('bannerReadMore');
        if (readMoreLink) {
            readMoreLink.onclick = (e) => {
                e.preventDefault();
                openBannerModal(config);
            };
        }
    } catch (error) {
        console.error('Ошибка загрузки баннера:', error);
    }
}

function openBannerModal(config) {
    const detailModal = document.getElementById('detailModal');
    const detailModalContent = document.getElementById('detailModalContent');
    if (!detailModal || !detailModalContent) return;
    
    const savedVote = localStorage.getItem(`banner_vote_${config.id}`);
    
    let optionsHTML = '';
    if (config.type === 'vote' && config.options) {
        config.options.forEach((opt, index) => {
            const isChecked = (savedVote && parseInt(savedVote) === opt.id);
            optionsHTML += `
                <div class="vote-option">
                    <input type="radio" name="voteOption" id="voteOpt${index}" value="${opt.id}" data-option-text="${escapeHtml(opt.option_text)}" ${isChecked ? 'checked' : ''}>
                    <label for="voteOpt${index}">${escapeHtml(opt.option_text)}</label>
                </div>
            `;
        });
    }
    
    let modalHTML = '';
    
    if (config.type === 'vote') {
        modalHTML = `
            <h3>${escapeHtml(config.title)}</h3>
            <p>${escapeHtml(config.modal_details)}</p>
            <div class="modal__timer">
                <span class="timer-label">До окончания голосования:</span>
                <span class="timer-digits" id="modalTimerDigits">${document.getElementById('timerDigits')?.textContent || ''}</span>
            </div>
            <div class="vote-options">
                ${optionsHTML}
            </div>
            <div id="voteSuccessMessage" class="form-success" style="display: none;"></div>
            <button class="modal__action-btn" id="modalActionBtn">${savedVote ? 'Изменить голос' : 'Проголосовать'}</button>
        `;
    } else {
        modalHTML = `
            <h3>${escapeHtml(config.title)}</h3>
            <p>${escapeHtml(config.modal_details)}</p>
            ${config.button_text ? `<button class="modal__action-btn" id="modalActionBtn">${config.button_text}</button>` : ''}
        `;
    }
    
    detailModalContent.innerHTML = modalHTML;
    detailModal.style.display = 'flex';
    
    const modalActionBtn = document.getElementById('modalActionBtn');
    if (modalActionBtn) {
        modalActionBtn.onclick = async () => {
            if (config.type === 'vote') {
                const selected = document.querySelector('input[name="voteOption"]:checked');
                const successDiv = document.getElementById('voteSuccessMessage');
                
                if (selected) {
                    const optionId = selected.value;
                    const optionText = selected.dataset.optionText;
                    try {
                        const response = await fetch('/api/banner/vote', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ optionId: parseInt(optionId) })
                        });
                        const result = await response.json();
                        if (result.success) {
                            localStorage.setItem(`banner_vote_${config.id}`, optionId);
                            
                            if (successDiv) {
                                successDiv.textContent = `✓ Спасибо, ваш голос за "${optionText}" сохранён!`;
                                successDiv.style.display = 'block';
                            }
                            
                            modalActionBtn.textContent = 'Изменить голос';
                            
                            setTimeout(() => {
                                detailModal.style.display = 'none';
                                showNotification(`✓ Спасибо за ваш голос за "${optionText}"!`, 'success');
                            }, 2000);
                        } else {
                            showNotification(result.error || 'Ошибка при голосовании', 'error');
                        }
                    } catch (error) {
                        showNotification('Ошибка соединения', 'error');
                    }
                } else {
                    showNotification('Пожалуйста, выберите один из вариантов', 'error');
                }
            } else if (config.button_text) {
                showNotification(`Функция "${config.button_text}" будет доступна после запуска чатов`, 'info');
                detailModal.style.display = 'none';
            }
        };
    }
}

// ========== КАРУСЕЛЬ ФОТОГРАФИЙ НА СТРАНИЦЕ "О НАС" ==========
function initCarousel() {
    const track = document.getElementById('carouselTrack');
    const nextBtn = document.getElementById('carouselNextBtn');
    
    if (!track || !nextBtn) return;
    
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    
    function getVisibleSlidesCount() {
        if (window.innerWidth <= 768) return 2;
        if (window.innerWidth <= 1024) return 3;
        return 4;
    }
    
    let currentIndex = 0;
    let visibleCount = getVisibleSlidesCount();
    const totalSlides = slides.length;
    
    function getSlideWidth() {
        const slide = slides[0];
        const style = window.getComputedStyle(slide);
        const marginRight = parseFloat(style.marginRight) || 20;
        return slide.offsetWidth + marginRight;
    }
    
    function updateCarousel() {
        const slideWidth = getSlideWidth();
        const translateX = -currentIndex * slideWidth;
        track.style.transform = `translateX(${translateX}px)`;
    }
    
    function nextSlide() {
        const maxIndex = totalSlides - visibleCount;
        if (currentIndex < maxIndex) {
            currentIndex++;
            updateCarousel();
        } else if (currentIndex === maxIndex && maxIndex > 0) {
            currentIndex = 0;
            updateCarousel();
        }
    }
    
    window.addEventListener('resize', () => {
        const newVisibleCount = getVisibleSlidesCount();
        if (newVisibleCount !== visibleCount) {
            visibleCount = newVisibleCount;
            currentIndex = 0;
            updateCarousel();
        } else {
            updateCarousel();
        }
    });
    
    nextBtn.addEventListener('click', nextSlide);
    
    setTimeout(() => {
        visibleCount = getVisibleSlidesCount();
        updateCarousel();
    }, 100);
}

if (window.location.pathname === '/about') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        initCarousel();
    }
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

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    loadYandexMap();
    loadMainNews();
    loadBanner();
    
    if (window.location.pathname === '/news') {
        loadNewsPage(1);
    }
});

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОФИЛЯ ==========
window.openProposalFormModal = openProposalFormModal;
window.currentLat = currentLat;
window.currentLng = currentLng;