// Модальное окно для кнопки i
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

// Заглушка для поиска
const searchBtn = document.querySelector('.search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        alert('Поиск по сайту пока в разработке');
    });
}

// Заглушка для кнопки "Другие новости"
const moreNewsBtn = document.querySelector('.news-section__more .btn-link');
if (moreNewsBtn) {
    moreNewsBtn.addEventListener('click', () => {
        alert('Страница со всеми новостями появится позже');
    });
}