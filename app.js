
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { createUserTable } = require('./models/userModel');
const { createMessageTable } = require('./models/messageModel');
const socketIo = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

dotenv.config();

const app = express();

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Allow only trusted URLs
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
};

app.use(express.json());
app.use(cors(corsOptions));

// Initialize DB tables
const initializeDB = async () => {
  try {
    // Wait for user table creation to complete
    await createUserTable();
    console.log('Users table created successfully.');

    
    await createMessageTable();
    console.log('Messages table created successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
};

let onlineUsers = {};

const startServer = async () => {
  
  await initializeDB();

  // Routes
  const authRoutes = require('./routes/authRoutes');
  const messageRoutes = require('./routes/messageRoutes');
  const userRoutes = require('./routes/userRoutes');

  app.use('/auth', authRoutes);
  app.use('/messages', messageRoutes);
  app.use('/users', userRoutes);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();


io.on('connection', (socket) => {

  socket.on('userConnected', (token) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        socket.emit('error', 'Invalid token');
        return;
      }
      const userId = decoded.id;
      onlineUsers[userId] = socket.id;
      io.emit('onlineUsers', Object.keys(onlineUsers).map(key => parseInt(key, 10)));
      console.log("A person logged in with id: " + userId);
    });
  });

  socket.on('disconnect', () => {
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('onlineUsers', Object.keys(onlineUsers).map(key => parseInt(key, 10)));
    console.log('A user disconnected:', socket.id);
  });

  socket.on('sendMessage', async ({ token, to, message }) => {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        socket.emit('error', 'Invalid token');
        return;
      }
      const from = decoded.id;
      try {
        const result = await pool.query(
          'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING id, sender_id, receiver_id, message, created_at',
          [from, to, message]
        );
        const newMessage = result.rows[0];
        const receiver_socket_id = onlineUsers[to];
        io.to(socket.id).emit('message', newMessage);
        if (receiver_socket_id) {
          io.to(receiver_socket_id).emit('message', newMessage);
        }
      } catch (error) {
        socket.emit('error', 'Message sending failed');
        console.log(error);
      }
    });
  });
  // Handle typing event
  socket.on('typing', ({ from, to }) => {
    if (to) {
      const receiverSocketId = onlineUsers[to];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', from);
      }
    } else {
      // Notify that typing has stopped
      io.emit('userTyping', null);
    }
  });
  
// Emit 'messageSeen' when a message is read
socket.on('messageSeen', ({ from, to }) => {
  const senderSocketId = onlineUsers[from];
  if (senderSocketId) {
    io.to(senderSocketId).emit('messageSeen', to);
  }
});

  
});
