const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Data files
const USERS_FILE = path.join(dataDir, 'users.json');
const MESSAGES_FILE = path.join(dataDir, 'messages.json');

// Initialize data files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
}

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
  
  // Auto-login after signup
  res.json({ success: true, username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  
  const user = users.find(user => user.username === username && user.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({ success: true, username });
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
    io.emit('online users', Array.from(onlineUsers.keys()));
    console.log(`${username} is online`);
  });
  
  socket.on('private message', (data) => {
    const messages = readJSON(MESSAGES_FILE);
    const messageData = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
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
      io.emit('online users', Array.from(onlineUsers.keys()));
      console.log(`${socket.username} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});