const pool = require('../config/db');


const getMessages = async (req, res) => {
  const { id } = req.params;
  const sender_id = req.user.id;

  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC',
      [sender_id, id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getMessages };
