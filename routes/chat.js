const express = require('express');
const router = express.Router();

const getDb = (req) => req.app.locals.db;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Получить название чата (название заявки или "Голосование")
function getChatTitle(db, proposalId, callback) {
    if (proposalId === 0) {
        callback(null, 'Голосование за идеи весны 2026');
        return;
    }
    db.get(`SELECT title FROM proposals WHERE id = ?`, [proposalId], (err, row) => {
        if (err) callback(err, null);
        else callback(null, row ? row.title : 'Чат заявки');
    });
}

// Получить количество участников чата
function getParticipantsCount(db, proposalId, callback) {
    db.get(`SELECT COUNT(*) as count FROM chat_participants WHERE proposal_id = ? AND left_at IS NULL`, [proposalId], (err, row) => {
        if (err) callback(err, 0);
        else callback(null, row ? row.count : 0);
    });
}

// ========== API МАРШРУТЫ ==========

// Получить список чатов пользователя
router.get('/chats', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const userId = req.session.userId;
    
    db.all(`
        SELECT DISTINCT cp.proposal_id, cp.joined_at, cp.left_at,
               (SELECT COUNT(*) FROM comments WHERE proposal_id = cp.proposal_id AND created_at > cp.joined_at AND is_read = 0 AND user_id != ?) as unread_count
        FROM chat_participants cp
        WHERE cp.user_id = ? AND cp.left_at IS NULL
        ORDER BY (
            SELECT MAX(created_at) FROM comments WHERE proposal_id = cp.proposal_id
        ) DESC NULLS LAST
    `, [userId, userId], async (err, chats) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        
        const result = [];
        for (const chat of chats) {
            const title = await new Promise((resolve) => {
                getChatTitle(db, chat.proposal_id, (err, title) => resolve(title || 'Чат'));
            });
            const participantsCount = await new Promise((resolve) => {
                getParticipantsCount(db, chat.proposal_id, (err, count) => resolve(count || 0));
            });
            
            result.push({
                proposal_id: chat.proposal_id,
                title: title,
                participants_count: participantsCount,
                unread_count: chat.unread_count || 0,
                joined_at: chat.joined_at
            });
        }
        
        res.json({ success: true, chats: result });
    });
});

// Получить сообщения чата
router.get('/chats/:proposalId/messages', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const proposalId = parseInt(req.params.proposalId);
    const userId = req.session.userId;
    
    db.run(`INSERT OR IGNORE INTO chat_participants (user_id, proposal_id, joined_at) VALUES (?, ?, CURRENT_TIMESTAMP)`, 
        [userId, proposalId], 
        (err) => {
            if (err) {
                console.error('Ошибка добавления участника:', err);
            }
            
            db.all(`
                SELECT c.id, c.text, c.created_at, c.user_id, c.is_read,
                       u.firstname, u.lastname
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.proposal_id = ?
                ORDER BY c.created_at ASC
            `, [proposalId], (err, messages) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                
                db.run(`UPDATE comments SET is_read = 1 WHERE proposal_id = ? AND user_id != ? AND is_read = 0`, [proposalId, userId]);
                
                getChatTitle(db, proposalId, (err, title) => {
                    getParticipantsCount(db, proposalId, (err, count) => {
                        res.json({
                            success: true,
                            proposal_id: proposalId,
                            title: title || 'Чат',
                            participants_count: count,
                            messages: messages.map(m => ({
                                id: m.id,
                                text: m.text,
                                created_at: m.created_at,
                                user_id: m.user_id,
                                user_name: m.firstname ? `${m.firstname} ${m.lastname || ''}`.trim() : 'Пользователь',
                                is_mine: m.user_id === userId
                            }))
                        });
                    });
                });
            });
        }
    );
});

// Отправить сообщение в чат
router.post('/chats/:proposalId/messages', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const proposalId = parseInt(req.params.proposalId);
    const userId = req.session.userId;
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Введите сообщение' });
    }
    
    if (text.length > 1000) {
        return res.status(400).json({ success: false, message: 'Сообщение не длиннее 1000 символов' });
    }
    
    db.get(`SELECT * FROM chat_participants WHERE user_id = ? AND proposal_id = ?`, [userId, proposalId], (err, participant) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        
        if (!participant) {
            db.run(`INSERT INTO chat_participants (user_id, proposal_id) VALUES (?, ?)`, [userId, proposalId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                saveMessage();
            });
        } else if (participant.left_at !== null) {
            db.run(`UPDATE chat_participants SET left_at = NULL, joined_at = CURRENT_TIMESTAMP WHERE user_id = ? AND proposal_id = ?`, [userId, proposalId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                saveMessage();
            });
        } else {
            saveMessage();
        }
        
        function saveMessage() {
            db.run(`INSERT INTO comments (proposal_id, user_id, text, is_read) VALUES (?, ?, ?, 0)`, 
                [proposalId, userId, text.trim()], 
                function(err) {
                    if (err) {
                        return res.status(500).json({ success: false, error: err.message });
                    }
                    
                    db.get(`SELECT firstname, lastname FROM users WHERE id = ?`, [userId], (err, user) => {
                        res.json({
                            success: true,
                            message: {
                                id: this.lastID,
                                text: text.trim(),
                                created_at: new Date().toISOString(),
                                user_id: userId,
                                user_name: user ? `${user.firstname} ${user.lastname || ''}`.trim() : 'Пользователь',
                                is_mine: true
                            }
                        });
                    });
                }
            );
        }
    });
});

// Выйти из чата (удалить из списка чатов)
router.post('/chats/:proposalId/leave', (req, res) => {
    const db = getDb(req);
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
    }
    
    const proposalId = parseInt(req.params.proposalId);
    const userId = req.session.userId;
    
    db.run(`UPDATE chat_participants SET left_at = CURRENT_TIMESTAMP WHERE user_id = ? AND proposal_id = ?`, [userId, proposalId], (err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: 'Вы вышли из чата' });
    });
});

module.exports = router;