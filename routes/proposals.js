const express = require('express');
const router = express.Router();

// Заглушки для заявок и комментариев
router.get('/proposals', (req, res) => {
    res.json([]);
});

router.post('/proposals', (req, res) => {
    res.json({ success: false, message: 'Добавление заявок временно недоступно' });
});

router.post('/proposals/:id/comments', (req, res) => {
    res.json({ success: false, message: 'Комментарии временно недоступны' });
});

// Баннер (пока оставим здесь, потом можно вынести)
router.get('/banner', (req, res) => {
    const db = req.app.locals.db;
    db.get(`SELECT * FROM banner_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1`, (err, banner) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!banner) {
            res.json(null);
            return;
        }
        if (banner.type === 'vote') {
            db.all(`SELECT id, option_text FROM vote_options WHERE banner_id = ?`, [banner.id], (err, options) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ ...banner, options });
            });
        } else {
            res.json(banner);
        }
    });
});

router.post('/banner/vote', (req, res) => {
    const db = req.app.locals.db;
    const { optionId } = req.body;
    if (!optionId) {
        res.status(400).json({ error: 'Не выбран вариант' });
        return;
    }
    db.run(`UPDATE vote_options SET votes_count = votes_count + 1 WHERE id = ?`, [optionId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, message: 'Голос учтён' });
    });
});

module.exports = router;