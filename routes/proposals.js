const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.locals.db;

// ========== ЗАЯВКИ ДЛЯ КАРТЫ ==========

// Получить все опубликованные заявки (для карты)
router.get('/proposals/published', (req, res) => {
    const db = getDb(req);
    db.all(`SELECT id, title, description, address, lat, lng, likes, created_at, user_id 
            FROM proposals 
            WHERE status = 'published'
            ORDER BY created_at DESC`, 
            (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить одну заявку по ID
router.get('/proposals/:id', (req, res) => {
    const db = getDb(req);
    const id = req.params.id;
    
    db.get(`SELECT id, title, description, address, lat, lng, likes, status, created_at, user_id 
            FROM proposals WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Заявка не найдена' });
            return;
        }
        res.json(row);
    });
});

// Получить заявки по адресу (для формы)
router.get('/proposals/by-address', (req, res) => {
    const db = getDb(req);
    const address = req.query.address;
    
    if (!address) {
        return res.json([]);
    }
    
    db.all(`SELECT p.id, p.title, p.description, p.likes, p.created_at, 
                   u.firstname, u.lastname
            FROM proposals p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.address LIKE ? AND p.status = 'published'
            ORDER BY p.created_at DESC
            LIMIT 20`,
        [`%${address}%`],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const proposals = rows.map(row => ({
                ...row,
                author_name: row.firstname ? `${row.firstname} ${row.lastname || ''}`.trim() : 'Пользователь'
            }));
            
            res.json(proposals);
        }
    );
});

// ========== СОЗДАНИЕ ЗАЯВКИ ==========

router.post('/proposals', (req, res) => {
    const db = getDb(req);
    
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const { title, description, address, lat, lng } = req.body;
    
    if (!title || !description || !address || !lat || !lng) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }
    
    if (title.length < 5) {
        return res.status(400).json({ success: false, message: 'Название должно быть не менее 5 символов' });
    }
    
    if (description.length < 10) {
        return res.status(400).json({ success: false, message: 'Описание должно быть не менее 10 символов' });
    }
    
    db.run(`INSERT INTO proposals (user_id, title, description, address, lat, lng, status, likes) 
            VALUES (?, ?, ?, ?, ?, ?, 'published', 0)`,
        [req.session.userId, title, description, address, lat, lng],
        function(err) {
            if (err) {
                console.error('Ошибка при создании заявки:', err);
                return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
            }
            
            res.json({ 
                success: true, 
                message: 'Заявка создана', 
                proposalId: this.lastID,
                proposal: {
                    id: this.lastID,
                    title,
                    description,
                    address,
                    lat,
                    lng,
                    likes: 0
                }
            });
        }
    );
});

// ========== ЛАЙКИ ==========

router.post('/proposals/like', (req, res) => {
    const db = getDb(req);
    
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const { proposalId } = req.body;
    
    db.get(`SELECT id FROM proposal_likes WHERE proposal_id = ? AND user_id = ?`,
        [proposalId, req.session.userId],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
            }
            
            if (existing) {
                return res.status(400).json({ success: false, message: 'Вы уже лайкнули эту заявку' });
            }
            
            db.run(`INSERT INTO proposal_likes (proposal_id, user_id) VALUES (?, ?)`,
                [proposalId, req.session.userId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Ошибка при сохранении лайка' });
                    }
                    
                    db.run(`UPDATE proposals SET likes = likes + 1 WHERE id = ?`, [proposalId], (err) => {
                        if (err) {
                            return res.status(500).json({ success: false, message: 'Ошибка обновления счётчика' });
                        }
                        
                        db.get(`SELECT likes FROM proposals WHERE id = ?`, [proposalId], (err, row) => {
                            if (err) {
                                return res.status(500).json({ success: false });
                            }
                            res.json({ success: true, likes: row.likes });
                        });
                    });
                }
            );
        }
    );
});

// ========== БАННЕР ==========

router.get('/banner', (req, res) => {
    const db = getDb(req);
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
    const db = getDb(req);
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