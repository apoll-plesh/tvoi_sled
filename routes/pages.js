const express = require('express');
const path = require('path');
const router = express.Router();

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Middleware для гостей (если уже авторизован — на главную)
function requireGuest(req, res, next) {
    if (req.session.userId) {
        res.redirect('/');
    } else {
        next();
    }
}

// Гостевые страницы
router.get('/login', requireGuest, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'login.html'));
});

router.get('/register', requireGuest, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'register.html'));
});

// Защищённые страницы
router.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

router.get('/news', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'news.html'));
});

router.get('/about', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'about.html'));
});

router.get('/profile', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'profile.html'));
});

// Новая страница чата
router.get('/chat/:proposalId', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'chat.html'));
});

module.exports = router;