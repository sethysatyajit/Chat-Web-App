const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data files
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

// Helper functions to read/write JSON files
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// API Routes
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  
  if (users.find(user => user.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  users.push({ username, password });
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  
  const user = users.find(user => user.username === username && user.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({ success: true });
});

app.get('/api/users', (req, res) => {
  const users = readJSON(USERS_FILE);
  res.json(users.map(user => ({ username: user.username })));
});

app.get('/api/messages', (req, res) => {
  const messages = readJSON(MESSAGES_FILE);
  res.json(messages);
});

// Store online users
const onlineUsers = new Map();

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('user online', (username) => {
    socket.username = username;
    onlineUsers.set(username, socket.id);
    console.log(`${username} is online`);
  });
  
  socket.on('private message', (data) => {
    const messages = readJSON(MESSAGES_FILE);
    const messageData = {
      from: data.from,
      to: data.to,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    messages.push(messageData);
    writeJSON(MESSAGES_FILE, messages);
    
    // Send to recipient if online
    const recipientSocketId = onlineUsers.get(data.to);
    if (recipientSocketId) {
      socket.to(recipientSocketId).emit('private message', messageData);
    }
    
    // Also send back to sender for UI update
    socket.emit('private message', messageData);
  });
  
  socket.on('disconnect', () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      console.log(`${socket.username} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});