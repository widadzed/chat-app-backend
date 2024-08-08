const pool = require('../config/db');

const getUsers = async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id != $1',
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getUsers };