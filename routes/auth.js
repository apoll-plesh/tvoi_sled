const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Функция для логирования ошибок
function logError(err, req, res, message) {
    console.error('=== ОШИБКА В AUTH.JS ===');
    console.error('Метод:', req.method);
    console.error('URL:', req.url);
    console.error('Тело запроса:', req.body);
    console.error('Сообщение:', message);
    console.error('Детали ошибки:', err);
    console.error('Стек:', err?.stack);
}

const getDb = (req) => req.app.locals.db;

// ========== РЕГИСТРАЦИЯ ==========
router.post('/register', async (req, res) => {
    console.log('=== РЕГИСТРАЦИЯ ===');
    console.log('Получены данные:', req.body);
    
    const db = getDb(req);
    if (!db) {
        console.error('❌ База данных не доступна!');
        return res.status(500).json({ success: false, message: 'Ошибка подключения к базе данных' });
    }
    
    const { email, password, firstname, lastname, phone, card_number, card_expiry, card_cvv, agree } = req.body;
    
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
    
    if (firstname && firstname.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Введите корректное имя' });
    }
    
    if (lastname && lastname.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Введите корректную фамилию' });
    }
    
    if (phone && !/^[\+\d\s\-\(\)]{10,20}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Введите корректный номер телефона' });
    }
    
    try {
        db.get(`SELECT id FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) {
                logError(err, req, res, 'Ошибка при проверке пользователя');
                return res.status(500).json({ success: false, message: 'Ошибка базы данных: ' + err.message });
            }
            if (user) {
                return res.status(400).json({ success: false, message: 'Пользователь с таким email уже существует' });
            }
            
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                
                db.run(`INSERT INTO users (email, password, firstname, lastname, phone, card_number, card_expiry, card_cvv) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [email, hashedPassword, firstname || '', lastname || '', phone || '', card_number || '', card_expiry || '', card_cvv || ''],
                    function(err) {
                        if (err) {
                            logError(err, req, res, 'Ошибка при создании пользователя');
                            return res.status(500).json({ success: false, message: 'Ошибка при создании пользователя: ' + err.message });
                        }
                        
                        req.session.userId = this.lastID;
                        req.session.userEmail = email;
                        req.session.userFirstname = firstname || '';
                        req.session.userLastname = lastname || '';
                        
                        console.log('✅ Пользователь создан, ID:', this.lastID);
                        res.json({ success: true, message: 'Регистрация успешна' });
                    }
                );
            } catch (hashError) {
                logError(hashError, req, res, 'Ошибка хеширования пароля');
                res.status(500).json({ success: false, message: 'Ошибка сервера при обработке пароля' });
            }
        });
    } catch (error) {
        logError(error, req, res, 'Неизвестная ошибка');
        res.status(500).json({ success: false, message: 'Ошибка сервера: ' + error.message });
    }
});

// ========== ВХОД ==========
router.post('/login', (req, res) => {
    const db = getDb(req);
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email и пароль обязательны' });
    }
    
    db.get(`SELECT id, email, password, firstname, lastname FROM users WHERE email = ?`, [email], async (err, user) => {
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
        req.session.userFirstname = user.firstname || '';
        req.session.userLastname = user.lastname || '';
        
        res.json({ success: true, message: 'Вход выполнен', redirect: '/' });
    });
});

// ========== ВЫХОД ==========
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Ошибка при выходе' });
        }
        res.json({ success: true, redirect: '/login' });
    });
});

// ========== ПОЛУЧИТЬ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ==========
router.get('/user', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    db.get(`SELECT id, email, firstname, lastname, phone, card_number, card_expiry, created_at FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        if (user && user.card_number && user.card_number.length >= 4) {
            user.card_last4 = '**** ' + user.card_number.slice(-4);
            delete user.card_number;
        }
        res.json(user);
    });
});

// ========== ОБНОВЛЕНИЕ ПРОФИЛЯ ==========
router.put('/user', (req, res) => {
    console.log('=== ОБНОВЛЕНИЕ ПРОФИЛЯ ===');
    console.log('Получены данные:', req.body);
    
    const db = getDb(req);
    if (!db) {
        console.error('❌ База данных не доступна!');
        return res.status(500).json({ success: false, message: 'Ошибка подключения к базе данных' });
    }
    
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const { firstname, lastname, email, phone, card_number, card_expiry, card_cvv } = req.body;
    
    if (firstname !== undefined && firstname.trim() === '') {
        return res.status(400).json({ success: false, message: 'Имя не может быть пустым' });
    }
    if (lastname !== undefined && lastname.trim() === '') {
        return res.status(400).json({ success: false, message: 'Фамилия не может быть пустой' });
    }
    if (email !== undefined && email.trim() === '') {
        return res.status(400).json({ success: false, message: 'Email не может быть пустым' });
    }
    
    if (email !== undefined && email.trim() !== '') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Введите корректный email' });
        }
    }
    
    if (phone !== undefined && phone.trim() !== '') {
        if (!/^[\+\d\s\-\(\)]{10,20}$/.test(phone)) {
            return res.status(400).json({ success: false, message: 'Введите корректный номер телефона' });
        }
    }
    
    if (card_number !== undefined && card_number.trim() !== '') {
        const cleanCard = card_number.replace(/\s/g, '');
        if (cleanCard.length < 16 || !/^\d+$/.test(cleanCard)) {
            return res.status(400).json({ success: false, message: 'Некорректный номер карты (16 цифр)' });
        }
    }
    
    const updates = [];
    const values = [];
    
    if (firstname !== undefined) {
        updates.push('firstname = ?');
        values.push(firstname.trim());
    }
    if (lastname !== undefined) {
        updates.push('lastname = ?');
        values.push(lastname.trim());
    }
    if (email !== undefined) {
        updates.push('email = ?');
        values.push(email.trim());
    }
    if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone.trim() || null);
    }
    if (card_number !== undefined) {
        updates.push('card_number = ?');
        values.push(card_number.trim() || null);
    }
    if (card_expiry !== undefined) {
        updates.push('card_expiry = ?');
        values.push(card_expiry.trim() || null);
    }
    if (card_cvv !== undefined) {
        updates.push('card_cvv = ?');
        values.push(card_cvv.trim() || null);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'Нет данных для обновления' });
    }
    
    values.push(req.session.userId);
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    console.log('SQL запрос:', query);
    
    db.run(query, values, function(err) {
        if (err) {
            logError(err, req, res, 'Ошибка обновления пользователя');
            return res.status(500).json({ success: false, message: 'Ошибка обновления: ' + err.message });
        }
        
        console.log('✅ Обновлено строк:', this.changes);
        
        if (email) req.session.userEmail = email;
        if (firstname) req.session.userFirstname = firstname;
        if (lastname) req.session.userLastname = lastname;
        
        res.json({ success: true, message: 'Данные обновлены' });
    });
});

// ========== СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ ==========
router.get('/user/stats', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false });
    }
    
    db.get(`SELECT COUNT(*) as count FROM proposals WHERE user_id = ?`, [req.session.userId], (err, proposalsResult) => {
        if (err) return res.status(500).json({ success: false });
        
        db.get(`SELECT COUNT(*) as count FROM proposals WHERE user_id = ? AND status = 'realized'`, [req.session.userId], (err, realizedResult) => {
            if (err) return res.status(500).json({ success: false });
            
            res.json({
                proposalsCount: proposalsResult.count,
                realizedCount: realizedResult.count,
                donationSum: 0
            });
        });
    });
});

// ========== ЗАЯВКИ ПОЛЬЗОВАТЕЛЯ ==========
router.get('/user/proposals', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    db.all(`SELECT id, title, description, address, lat, lng, likes, status, created_at 
            FROM proposals 
            WHERE user_id = ? AND status != 'realized'
            ORDER BY created_at DESC`, 
            [req.session.userId], 
            (err, activeProposals) => {
        if (err) {
            return res.status(500).json({ success: false });
        }
        
        db.all(`SELECT id, title, description, address, lat, lng, likes, status, created_at 
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

// ========== ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ЗАГЛУШКА) ==========
router.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Введите email' });
    }
    res.json({ success: true, message: 'Мы отправили инструкции на ваш email (учебный режим)' });
});

// ========== ТЕСТОВЫЙ МАРШРУТ ==========
router.get('/test', (req, res) => {
    const db = getDb(req);
    res.json({ 
        success: true, 
        dbExists: !!db,
        sessionId: req.session?.userId || 'нет',
        message: 'API работает'
    });
});

module.exports = router;