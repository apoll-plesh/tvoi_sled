const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Получаем доступ к базе данных из app.locals
const getDb = (req) => req.app.locals.db;

// Регистрация
router.post('/register', async (req, res) => {
    const db = getDb(req);
    const { email, password, fullname, phone, card_number, card_expiry, card_cvv, agree } = req.body;
    
    // Валидация
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email и пароль обязательны' });
    }
    
    if (!agree) {
        return res.status(400).json({ success: false, message: 'Необходимо согласие на обработку данных' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль должен быть не менее 6 символов' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Введите корректный email' });
    }
    
    if (fullname && fullname.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Введите корректное имя' });
    }
    
    if (phone && !/^[\+\d\s\-\(\)]{10,20}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Введите корректный номер телефона' });
    }
    
    // Валидация карты (если заполнена)
    if (card_number || card_expiry || card_cvv) {
        if (!card_number || !card_expiry || !card_cvv) {
            return res.status(400).json({ success: false, message: 'Заполните все поля карты' });
        }
        if (!/^\d{16}$/.test(card_number.replace(/\s/g, ''))) {
            return res.status(400).json({ success: false, message: 'Номер карты должен содержать 16 цифр' });
        }
        if (!/^\d{2}\/\d{2}$/.test(card_expiry)) {
            return res.status(400).json({ success: false, message: 'Формат срока: ММ/ГГ' });
        }
        if (!/^\d{3}$/.test(card_cvv)) {
            return res.status(400).json({ success: false, message: 'CVV должен содержать 3 цифры' });
        }
    }
    
    try {
        // Проверяем существующего пользователя
        db.get(`SELECT id FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
            }
            if (user) {
                return res.status(400).json({ success: false, message: 'Пользователь с таким email уже существует' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            db.run(`INSERT INTO users (email, password, fullname, phone, card_number, card_expiry, card_cvv) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [email, hashedPassword, fullname || '', phone || '', card_number || '', card_expiry || '', card_cvv || ''],
                function(err) {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Ошибка при создании пользователя' });
                    }
                    req.session.userId = this.lastID;
                    req.session.userEmail = email;
                    res.json({ success: true, message: 'Регистрация успешна' });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Вход
router.post('/login', (req, res) => {
    const db = getDb(req);
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email и пароль обязательны' });
    }
    
    db.get(`SELECT id, email, password, fullname FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
        }
        if (!user) {
            return res.status(401).json({ success: false, message: 'Неверный email или пароль' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Неверный email или пароль' });
        }
        
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.fullname;
        
        res.json({ success: true, message: 'Вход выполнен', redirect: '/' });
    });
});

// Выход
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Ошибка при выходе' });
        }
        res.json({ success: true, redirect: '/login' });
    });
});

// Получить данные текущего пользователя
router.get('/user', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    db.get(`SELECT id, email, fullname, phone, card_number, card_expiry, created_at FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        // Скрываем полный номер карты, показываем только последние 4 цифры
        if (user && user.card_number && user.card_number.length >= 4) {
            user.card_last4 = '**** ' + user.card_number.slice(-4);
            delete user.card_number;
        }
        res.json(user);
    });
});

// Восстановление пароля (заглушка)
router.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Введите email' });
    }
    // Заглушка — всегда успех
    res.json({ success: true, message: 'Мы отправили инструкции на ваш email (учебный режим)' });
});

// ========== ДОПОЛНИТЕЛЬНЫЕ API ДЛЯ ПРОФИЛЯ ==========

// Получить заявки пользователя (активные и реализованные)
router.get('/user/proposals', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    // Активные заявки (статус moderation, published, rejected — не реализованные)
    db.all(`SELECT id, title, description, address, likes, status, created_at 
            FROM proposals 
            WHERE user_id = ? AND status != 'realized'
            ORDER BY created_at DESC`, 
            [req.session.userId], 
            (err, activeProposals) => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        
        // Реализованные заявки
        db.all(`SELECT id, title, description, address, likes, status, created_at, 
                (SELECT date FROM news WHERE proposals.id IS NULL) as realized_date
                FROM proposals 
                WHERE user_id = ? AND status = 'realized'
                ORDER BY created_at DESC`, 
                [req.session.userId], 
                (err, realizedProposals) => {
            if (err) {
                return res.status(500).json({ success: false });
            }
            
            res.json({
                active: activeProposals || [],
                realized: realizedProposals || []
            });
        });
    });
});

// Обновить данные пользователя
router.put('/user', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const { fullname, email, phone, card_number, card_expiry, card_cvv } = req.body;
    
    // Валидация email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Введите корректный email' });
    }
    
    // Валидация карты (если заполнена)
    if (card_number && (card_number.length < 16 || !/^\d+$/.test(card_number.replace(/\s/g, '')))) {
        return res.status(400).json({ success: false, message: 'Некорректный номер карты' });
    }
    
    db.run(`UPDATE users SET 
            fullname = COALESCE(?, fullname),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            card_number = COALESCE(?, card_number),
            card_expiry = COALESCE(?, card_expiry),
            card_cvv = COALESCE(?, card_cvv)
            WHERE id = ?`,
        [fullname, email, phone, card_number, card_expiry, card_cvv, req.session.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Ошибка обновления' });
            }
            if (email) req.session.userEmail = email;
            if (fullname) req.session.userName = fullname;
            res.json({ success: true, message: 'Данные обновлены' });
        }
    );
});

// Получить статистику пользователя
router.get('/user/stats', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false });
    }
    
    // Счёт предложенных идей
    db.get(`SELECT COUNT(*) as count FROM proposals WHERE user_id = ?`, [req.session.userId], (err, proposalsResult) => {
        if (err) return res.status(500).json({ success: false });
        
        // Счёт реализованных идей
        db.get(`SELECT COUNT(*) as count FROM proposals WHERE user_id = ? AND status = 'realized'`, [req.session.userId], (err, realizedResult) => {
            if (err) return res.status(500).json({ success: false });
            
            // Сумма пожертвований (пока заглушка, потом из таблицы donations)
            const donationSum = 0; // TODO: добавить таблицу donations
            
            res.json({
                proposalsCount: proposalsResult.count,
                realizedCount: realizedResult.count,
                donationSum: donationSum
            });
        });
    });
});

module.exports = router;