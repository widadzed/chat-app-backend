const express = require('express');
const { getMessages } = require('../controllers/messageController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/:id', authenticateToken, getMessages);

module.exports = router;