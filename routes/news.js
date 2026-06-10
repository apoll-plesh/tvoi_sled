const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.locals.db;

// Получить главные новости (4 штуки)
router.get('/news/main', (req, res) => {
    const db = getDb(req);
    db.all(`SELECT id, title, excerpt, image, date FROM news WHERE is_main = 1 ORDER BY date DESC LIMIT 4`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все новости с пагинацией
router.get('/news', (req, res) => {
    const db = getDb(req);
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;
    
    db.all(`SELECT id, title, excerpt, image, date FROM news ORDER BY date DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        db.get(`SELECT COUNT(*) as total FROM news`, (err, countRow) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                news: rows,
                currentPage: page,
                totalPages: Math.ceil(countRow.total / limit),
                totalNews: countRow.total
            });
        });
    });
});

// Получить одну новость по id
router.get('/news/:id', (req, res) => {
    const db = getDb(req);
    const id = req.params.id;
    db.get(`SELECT id, title, content, image, date FROM news WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Новость не найдена' });
            return;
        }
        res.json(row);
    });
});

module.exports = router;