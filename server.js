const express = require('express');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Отладка ошибок
process.on('uncaughtException', (err) => {
    console.error('❌ НЕПЕРЕХВАЧЕННАЯ ОШИБКА:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ НЕОБРАБОТАННОЕ ОТКЛОНЕНИЕ ПРОМИСА:', reason);
});

const app = express();
const PORT = 3000;

// Подключаем базу данных
const db = new sqlite3.Database('./database.sqlite');

// Делаем db доступным для маршрутов
app.locals.db = db;
console.log('📁 База данных подключена, app.locals.db установлен');

// ========== СОЗДАНИЕ ТАБЛИЦ ==========
db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        firstname TEXT,
        lastname TEXT,
        phone TEXT,
        card_number TEXT,
        card_expiry TEXT,
        card_cvv TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Таблица заявок (предложений)
    db.run(`CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        address TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        photo TEXT,
        status TEXT DEFAULT 'published',
        likes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    // Таблица комментариев
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        is_moderated INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    // Таблица новостей
    db.run(`CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_main INTEGER DEFAULT 0
    )`);
    
    // Таблица для баннера
    db.run(`CREATE TABLE IF NOT EXISTS banner_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        button_text TEXT,
        show_timer INTEGER DEFAULT 0,
        end_date DATETIME,
        modal_details TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    )`);
    
    // Таблица для вариантов голосования
    db.run(`CREATE TABLE IF NOT EXISTS vote_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        banner_id INTEGER NOT NULL,
        option_text TEXT NOT NULL,
        votes_count INTEGER DEFAULT 0,
        FOREIGN KEY (banner_id) REFERENCES banner_config(id)
    )`);
    
    // Таблица для лайков (чтобы один пользователь не мог лайкнуть дважды)
    db.run(`CREATE TABLE IF NOT EXISTS proposal_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(proposal_id, user_id)
    )`);
    
    // ========== ДЕМО-ДАННЫЕ ==========
    
    // Добавляем тестового пользователя (если нет)
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = bcrypt.hashSync('123456', 10);
            db.run(`INSERT INTO users (email, password, firstname, lastname, phone) VALUES (?, ?, ?, ?, ?)`,
                ['test@test.ru', hashedPassword, 'Тестовый', 'Пользователь', '+7 (999) 123-45-67']);
            console.log('👤 Добавлен тестовый пользователь: test@test.ru / 123456');
        }
    });
    
    // Добавляем тестовые новости (если нет)
    db.get(`SELECT COUNT(*) as count FROM news`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const demoNews = [
                { title: 'В Купчино установили новые скамейки', excerpt: 'Благодаря вашим голосованиям в парке появилось 15 скамеек...', content: 'Полный текст новости: В парке Купчино завершилась установка 15 новых скамеек.', image: '/images/news1.jpg', date: '2026-05-12 10:00:00', is_main: 1 },
                { title: 'Стартовал сбор на освещение двора', excerpt: 'Жители дома №10 по ул. Восстания собрали уже 30% суммы...', content: 'Полный текст новости: Инициативная группа жителей дома №10 собрала 30% от суммы.', image: '/images/news2.jpg', date: '2026-05-10 14:30:00', is_main: 1 },
                { title: 'Как предлагать идеи? Новый гайд', excerpt: 'Рассказываем, как ваша идея может стать реальностью...', content: 'Полный текст новости: Мы подготовили подробный гайд.', image: '/images/news3.jpg', date: '2026-05-05 09:15:00', is_main: 1 },
                { title: 'Итоги голосования за апрель', excerpt: 'Победила идея ремонта тротуара на Лиговском...', content: 'Полный текст новости: Победителем стала идея ремонта тротуара.', image: '/images/news4.jpg', date: '2026-05-01 16:45:00', is_main: 1 }
            ];
            const stmt = db.prepare(`INSERT INTO news (title, excerpt, content, image, date, is_main) VALUES (?, ?, ?, ?, ?, ?)`);
            demoNews.forEach(news => {
                stmt.run(news.title, news.excerpt, news.content, news.image, news.date, news.is_main);
            });
            stmt.finalize();
            console.log('📰 Добавлены тестовые новости');
        }
    });
    
    // Добавляем тестовые заявки для пользователя (если нет)
    db.get(`SELECT COUNT(*) as count FROM proposals`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            db.get(`SELECT id FROM users LIMIT 1`, (err, userRow) => {
                if (err || !userRow) return;
                const userId = userRow.id;
                
                const testProposals = [
                    { title: 'Яма во дворе дома 10', description: 'Огромная яма у подъезда, дети падают, машины ломают подвеску', address: 'ул. Восстания, 10', status: 'published', likes: 15, lat: 59.9311, lng: 30.3609 },
                    { title: 'Сломана скамейка в парке', description: 'Скамейка возле фонтана сломана, пожилым людям негде отдохнуть', address: 'парк Ленина', status: 'published', likes: 3, lat: 59.9325, lng: 30.3550 },
                    { title: 'Нет освещения у подъезда', description: 'Вечером очень темно, страшно заходить в подъезд', address: 'ул. Садовая, 25', status: 'published', likes: 42, lat: 59.9260, lng: 30.3180 },
                    { title: 'Разбитая детская площадка', description: 'Качели сломаны, горка ржавая, нужен ремонт', address: 'бульвар Молодёжи, 5', status: 'realized', likes: 28, lat: 59.9400, lng: 30.3300 },
                    { title: 'Установка урн для мусора', description: 'Весь мусор летает по газону, нужны дополнительные урны', address: 'набережная реки Фонтанки', status: 'realized', likes: 19, lat: 59.9200, lng: 30.3400 },
                    { title: 'Ремонт тротуара', description: 'Плитка разбита, люди спотыкаются', address: 'Невский проспект, 50', status: 'published', likes: 56, lat: 59.9355, lng: 30.3450 }
                ];
                
                const stmt = db.prepare(`INSERT INTO proposals (user_id, title, description, address, lat, lng, status, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                testProposals.forEach(prop => {
                    stmt.run(userId, prop.title, prop.description, prop.address, prop.lat, prop.lng, prop.status, prop.likes);
                });
                stmt.finalize();
                console.log('📋 Добавлены тестовые заявки для профиля (4 активные, 2 реализованные)');
            });
        }
    });
    
    // Добавляем тестовый баннер (если нет)
    db.get(`SELECT COUNT(*) as count FROM banner_config`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            db.run(`INSERT INTO banner_config (type, title, text, button_text, show_timer, end_date, modal_details, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ['vote', 'Голосование за идеи весны 2026', 'Выберите лучшую идею для благоустройства города. Победитель будет реализован в этом квартале.', 'Чат голосования', 1, '2026-12-31 23:59:59', 'В этом квартале мы выбрали 5 лучших идей по итогам рейтинга.', 1],
                function(err) {
                    if (!err) {
                        const bannerId = this.lastID;
                        const options = [
                            'Установить новые скамейки в парке Ленина',
                            'Отремонтировать тротуары на улице Восстания',
                            'Добавить освещение во дворе дома 15',
                            'Поставить урны для мусора у метро',
                            'Обустроить велодорожку вдоль набережной'
                        ];
                        const optStmt = db.prepare(`INSERT INTO vote_options (banner_id, option_text) VALUES (?, ?)`);
                        options.forEach(opt => {
                            optStmt.run(bannerId, opt);
                        });
                        optStmt.finalize();
                        console.log('🎯 Добавлен тестовый баннер');
                    }
                }
            );
        }
    });
    
    console.log('✅ База данных готова');
});

// ========== MIDDLEWARE ==========
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'tvoysled-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ========== ПОДКЛЮЧЕНИЕ МАРШРУТОВ ==========
const pagesRoutes = require('./routes/pages');
const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const proposalsRoutes = require('./routes/proposals');

app.use('/', pagesRoutes);
app.use('/api', authRoutes);
app.use('/api', newsRoutes);
app.use('/api', proposalsRoutes);

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`📁 Статика из папки public`);
    console.log(`👤 Тестовый пользователь: test@test.ru / 123456`);
});