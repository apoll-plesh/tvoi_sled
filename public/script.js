// ========== ЯНДЕКС КАРТА ==========

let currentMap;
let markers = [];
let miniMap = null;
let miniMapPlacemark = null;
let currentLat = null;
let currentLng = null;

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
    
    // Поиск на главной карте
    const mapSearchBtn = document.getElementById('mapSearchBtn');
    const mapSearchInput = document.getElementById('mapSearchInput');
    
    if (mapSearchBtn && mapSearchInput) {
        mapSearchBtn.onclick = () => {
            const query = mapSearchInput.value.trim();
            if (!query) return;
            
            ymaps.geocode(query).then((res) => {
                const firstGeoObject = res.geoObjects.get(0);
                if (firstGeoObject) {
                    const coords = firstGeoObject.geometry.getCoordinates();
                    currentMap.setCenter(coords, 16);
                    mapSearchInput.value = firstGeoObject.getAddressLine();
                } else {
                    alert('Адрес не найден');
                }
            }).catch(() => {
                alert('Ошибка поиска');
            });
        };
    }
    
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
    
    loadOtherProposals(address);
}

// Инициализация мини-карты
function initMiniMap(coords, currentAddress) {
    const miniMapContainer = document.getElementById('miniMap');
    if (!miniMapContainer) return;
    
    miniMapContainer.innerHTML = '';
    
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
        
        newBtn.onclick = () => {
            const query = miniMapSearch.value.trim();
            if (!query) return;
            
            ymaps.geocode(query).then((res) => {
                const firstGeoObject = res.geoObjects.get(0);
                if (firstGeoObject) {
                    const newCoords = firstGeoObject.geometry.getCoordinates();
                    miniMap.setCenter(newCoords, 17);
                    miniMapPlacemark.geometry.setCoordinates(newCoords);
                    currentLat = newCoords[0];
                    currentLng = newCoords[1];
                    const newAddress = firstGeoObject.getAddressLine();
                    document.getElementById('proposalAddress').value = newAddress;
                    loadOtherProposals(newAddress);
                } else {
                    alert('Адрес не найден');
                }
            }).catch(() => {
                alert('Ошибка поиска');
            });
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
            loadOtherProposals(address);
        }).catch(() => {
            document.getElementById('proposalAddress').value = 'Адрес не определён';
            loadOtherProposals('Адрес не определён');
        });
    });
}

// Загрузка чужих заявок по адресу
async function loadOtherProposals(address) {
    const otherList = document.getElementById('otherProposalsList');
    if (!otherList) return;
    
    try {
        const response = await fetch(`/api/proposals/by-address?address=${encodeURIComponent(address)}`);
        const proposals = await response.json();
        
        if (proposals.length === 0) {
            otherList.innerHTML = '<p class="empty-row">Пока нет идей по этому адресу. Будьте первым!</p>';
            return;
        }
        
        otherList.innerHTML = proposals.map(proposal => `
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
                alert('Чат будет доступен в следующей версии');
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        otherList.innerHTML = '<p class="empty-row">Ошибка загрузки</p>';
    }
}

// Обработчик лайка
async function handleLikeClick(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const proposalId = btn.dataset.id;
    const likesSpan = btn.querySelector('.likes-count');
    
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
        } else {
            alert(data.message || 'Ошибка');
        }
    } catch (error) {
        console.error('Ошибка при лайке:', error);
        alert('Ошибка соединения');
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
                
                alert('Заявка успешно создана! Она появится на карте и в вашем профиле.');
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

// Закрытие модального окна формы
const closeProposalFormBtn = document.getElementById('closeProposalFormBtn');
if (closeProposalFormBtn) {
    closeProposalFormBtn.addEventListener('click', () => {
        const modal = document.getElementById('proposalFormModal');
        if (modal) modal.style.display = 'none';
    });
}

// ========== МОДАЛЬНОЕ ОКНО ДЛЯ КНОПКИ i (правила) ==========
const modal = document.getElementById('infoModal');
const openBtn = document.getElementById('infoModalBtn');
const closeBtn = document.getElementById('closeModalBtn');

if (openBtn && modal && closeBtn) {
    openBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ========== ЗАГЛУШКИ ДЛЯ КНОПОК ==========
const searchBtn = document.querySelector('.search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        alert('Поиск по сайту пока в разработке');
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
        alert('Не удалось загрузить новость');
    }
}

if (closeNewsModalBtn && newsModal) {
    closeNewsModalBtn.addEventListener('click', () => {
        newsModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === newsModal) {
            newsModal.style.display = 'none';
        }
    });
}

// ========== МОДАЛЬНОЕ ОКНО ДЛЯ БАННЕРА (detailModal) ==========
const detailModal = document.getElementById('detailModal');
const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');

if (closeDetailModalBtn && detailModal) {
    closeDetailModalBtn.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.style.display = 'none';
        }
    });
}

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
                actionBtn.textContent = config.button_text;
                actionBtn.onclick = () => {
                    alert(`Функция "${config.button_text}" будет доступна после запуска чатов`);
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
            <button class="modal__action-btn" id="modalActionBtn">${savedVote ? 'Изменить голос' : (config.button_text || 'Проголосовать')}</button>
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
                            alert(`Вы проголосовали за: "${optionText}". Спасибо!`);
                            detailModal.style.display = 'none';
                        } else {
                            alert(result.error || 'Ошибка при голосовании');
                        }
                    } catch (error) {
                        alert('Ошибка соединения');
                    }
                } else {
                    alert('Пожалуйста, выберите один из вариантов');
                }
            } else if (config.button_text) {
                alert(`Функция "${config.button_text}" будет доступна после запуска чатов`);
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