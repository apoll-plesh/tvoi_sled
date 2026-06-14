const express = require('express');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

process.on('uncaughtException', (err) => {
    console.error('❌ НЕПЕРЕХВАЧЕННАЯ ОШИБКА:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ НЕОБРАБОТАННОЕ ОТКЛОНЕНИЕ ПРОМИСА:', reason);
});

const app = express();
const PORT = 3000;
const db = new sqlite3.Database('./database.sqlite');

app.locals.db = db;

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
    
    // Таблица заявок
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
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Таблица участников чатов 
    db.run(`CREATE TABLE IF NOT EXISTS chat_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        proposal_id INTEGER NOT NULL,
        left_at DATETIME,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (proposal_id) REFERENCES proposals(id),
        UNIQUE(user_id, proposal_id)
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
    
    // Таблица для лайков
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
    
    // Тестовый пользователь
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = bcrypt.hashSync('123456', 10);
            db.run(`INSERT INTO users (email, password, firstname, lastname, phone) VALUES (?, ?, ?, ?, ?)`,
                ['test@test.ru', hashedPassword, 'Тестовый', 'Пользователь', '+7 (999) 123-45-67']);
        }
    });
    
    // Тестовые новости 
    db.get(`SELECT COUNT(*) as count FROM news`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const demoNews = [
                { title: 'В Купчино установили новые скамейки', excerpt: 'Благодаря вашим голосованиям в парке появилось 15 скамеек...', content: 'Полный текст новости: В парке Купчино завершилась установка 15 новых скамеек.', image: '/images/news1.jpg', date: '2026-05-12 10:00:00', is_main: 1 },
                { title: 'Стартовал сбор на освещение двора', excerpt: 'Жители дома №10 по ул. Восстания собрали уже 30% суммы...', content: 'Полный текст новости: Инициативная группа жителей дома №10 собрала 30% от суммы.', image: '/images/news2.jpg', date: '2026-05-10 14:30:00', is_main: 1 },
                { title: 'Как предлагать идеи? Новый гайд', excerpt: 'Рассказываем, как ваша идея может стать реальностью...', content: 'Полный текст новости: Мы подготовили подробный гайд.', image: '/images/news3.jpg', date: '2026-05-05 09:15:00', is_main: 1 },
                { title: 'Итоги голосования за апрель', excerpt: 'Победила идея ремонта тротуара на Лиговском...', content: 'Полный текст новости: Победителем стала идея ремонта тротуара.', image: '/images/news4.jpg', date: '2026-05-01 16:45:00', is_main: 1 },
                { title: 'Новая велодорожка на набережной', excerpt: 'Проект одобрен городской администрацией...', content: 'Полный текст новости: Городская администрация одобрила проект строительства велодорожки.', image: '/images/news5.jpg', date: '2026-04-25 11:00:00', is_main: 0 },
                { title: 'Субботник в парке Ленина', excerpt: 'Приглашаем волонтёров 15 июня...', content: 'Полный текст новости: 15 июня в 10:00 состоится субботник в парке Ленина.', image: '/images/news6.jpg', date: '2026-04-20 13:20:00', is_main: 0 },
                { title: 'Новый сквер на Лиговском', excerpt: 'Завершено благоустройство сквера...', content: 'Полный текст новости: На Лиговском проспекте открылся новый сквер.', image: '/images/news7.jpg', date: '2026-04-15 09:00:00', is_main: 0 },
                { title: 'Голосование за летние проекты', excerpt: 'Принимайте участие в выборе проектов на лето...', content: 'Полный текст новости: Стартовало голосование за летние проекты.', image: '/images/news8.jpg', date: '2026-04-10 12:00:00', is_main: 0 },
                { title: 'Мастер-класс по урбанистике', excerpt: 'Приглашаем на лекцию о развитии города...', content: 'Полный текст новости: 20 апреля состоится мастер-класс по урбанистике.', image: '/images/news9.jpg', date: '2026-04-05 15:30:00', is_main: 0 },
                { title: 'Поможем парку вместе!', excerpt: 'Волонтёрская акция по уборке парка...', content: 'Полный текст новости: В эту субботу состоится акция по уборке парка.', image: '/images/news10.jpg', date: '2026-03-28 11:00:00', is_main: 0 },
                { title: 'Освещение во дворах', excerpt: 'Новые фонари установили в 10 дворах...', content: 'Полный текст новости: В рамках программы "Светлый город" установлены новые фонари.', image: '/images/news11.jpg', date: '2026-03-20 09:45:00', is_main: 0 },
                { title: 'Велоинфраструктура', excerpt: 'План развития велодорожек на 2026 год...', content: 'Полный текст новости: Опубликован план развития велосипедной инфраструктуры.', image: '/images/news12.jpg', date: '2026-03-15 14:00:00', is_main: 0 },
                { title: 'Ремонт тротуаров на Невском', excerpt: 'Начался долгожданный ремонт тротуаров на главной улице города...', content: 'Полный текст новости: Работы планируют завершить к августу.', image: '/images/news13.jpg', date: '2026-03-10 10:00:00', is_main: 0 },
                { title: 'Новая детская площадка в Автово', excerpt: 'Открылась современная площадка для детей всех возрастов...', content: 'Полный текст новости: Площадка оборудована безопасными качелями и горками.', image: '/images/news14.jpg', date: '2026-03-05 15:30:00', is_main: 0 },
                { title: 'Акция "Чистый город"', excerpt: 'Присоединяйтесь к общегородскому субботнику 22 мая...', content: 'Полный текст новости: Ждём всех желающих с 10:00 у метро Площадь Восстания.', image: '/images/news15.jpg', date: '2026-03-01 09:00:00', is_main: 0 },
                { title: 'Победа в грантовом конкурсе', excerpt: 'Проект "Твой след" получил поддержку городского бюджета...', content: 'Полный текст новости: 2 миллиона рублей на реализацию идей жителей.', image: '/images/news16.jpg', date: '2026-02-25 14:00:00', is_main: 0 },
                { title: 'Зимние дворы: итоги', excerpt: 'Подведены итоги конкурса на лучшее зимнее оформление дворов...', content: 'Полный текст новости: Победители получат призы от партнёров.', image: '/images/news17.jpg', date: '2026-02-20 11:00:00', is_main: 0 },
                { title: 'Новые урны в парке 300-летия', excerpt: 'Установлены 50 новых урн для раздельного сбора мусора...', content: 'Полный текст новости: Спасибо всем, кто голосовал за эту инициативу!', image: '/images/news18.jpg', date: '2026-02-15 16:30:00', is_main: 0 }
            ];
            const stmt = db.prepare(`INSERT INTO news (title, excerpt, content, image, date, is_main) VALUES (?, ?, ?, ?, ?, ?)`);
            demoNews.forEach(news => {
                stmt.run(news.title, news.excerpt, news.content, news.image, news.date, news.is_main);
            });
            stmt.finalize();
        }
    });
    
    // Тестовые заявки 
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
                    { title: 'Разбитая детская площадка', description: 'Качели сломаны, горка ржавая, нужен ремонт', address: 'бульвар Молодёжи, 5', status: 'published', likes: 28, lat: 59.9400, lng: 30.3300 },
                    { title: 'Установка урн для мусора', description: 'Весь мусор летает по газону, нужны дополнительные урны', address: 'набережная реки Фонтанки', status: 'published', likes: 19, lat: 59.9200, lng: 30.3400 },
                    { title: 'Ремонт тротуара', description: 'Плитка разбита, люди спотыкаются', address: 'Невский проспект, 50', status: 'published', likes: 56, lat: 59.9355, lng: 30.3450 }
                ];
                
                const stmt = db.prepare(`INSERT INTO proposals (user_id, title, description, address, lat, lng, status, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                testProposals.forEach(prop => {
                    stmt.run(userId, prop.title, prop.description, prop.address, prop.lat, prop.lng, prop.status, prop.likes);
                });
                stmt.finalize();
            });
        }
    });
    
    // Тестовый баннер
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
                    }
                }
            );
        }
    });
    
});

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
const chatRoutes = require('./routes/chat');

app.use('/', pagesRoutes);
app.use('/api', authRoutes);
app.use('/api', newsRoutes);
app.use('/api', proposalsRoutes);
app.use('/api', chatRoutes);

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
    console.log(`Тестовый пользователь: test@test.ru / 123456`);
});