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

// Модальное окно для баннера
function openBannerModal(config) {
    const detailModal = document.getElementById('detailModal');
    const detailModalContent = document.getElementById('detailModalContent');
    if (!detailModal || !detailModalContent) return;
    
    let modalHTML = '';
    
    if (config.type === 'vote') {
        let optionsHTML = '';
        if (config.options) {
            config.options.forEach((opt, index) => {
                optionsHTML += `
                    <div class="vote-option">
                        <input type="radio" name="voteOption" id="voteOpt${index}" value="${opt.id}" data-option-text="${escapeHtml(opt.option_text)}">
                        <label for="voteOpt${index}">${escapeHtml(opt.option_text)}</label>
                    </div>
                `;
            });
        }
        
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
            <button class="modal__action-btn" id="modalActionBtn">${config.button_text || 'Проголосовать'}</button>
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
    loadMainNews();
    loadBanner();
    
    if (window.location.pathname === '/news') {
        loadNewsPage(1);
    }
});

// ========== КАРУСЕЛЬ ФОТОГРАФИЙ НА СТРАНИЦЕ "О НАС" ==========
function initCarousel() {
    const track = document.getElementById('carouselTrack');
    const nextBtn = document.getElementById('carouselNextBtn');
    
    if (!track || !nextBtn) return;
    
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    
    // Определяем сколько слайдов показывать в зависимости от ширины экрана
    function getVisibleSlidesCount() {
        if (window.innerWidth <= 768) return 2;
        if (window.innerWidth <= 1024) return 3;
        return 4;
    }
    
    let currentIndex = 0;
    let visibleCount = getVisibleSlidesCount();
    const totalSlides = slides.length;
    
    // Вычисляем ширину одного слайда с учётом margin-right
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
            // Зацикливание: возвращаемся в начало
            currentIndex = 0;
            updateCarousel();
        }
    }
    
    // Обновляем при изменении размера окна
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
    
    // Начальная установка
    setTimeout(() => {
        visibleCount = getVisibleSlidesCount();
        updateCarousel();
    }, 100);
}

// Запускаем карусель, если мы на странице "О нас"
if (window.location.pathname === '/about') {
    // Ждём загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        initCarousel();
    }
}

