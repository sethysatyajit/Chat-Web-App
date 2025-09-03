// public/js/client.js
let socket = null;
let currentUser = null;
let selectedUser = null;
let onlineUsers = [];

// DOM elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const usersList = document.getElementById('users-list');
const onlineUsersList = document.getElementById('online-users');
const messageContainer = document.getElementById('message-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const currentChatUser = document.getElementById('current-chat-user');
const userStatus = document.getElementById('user-status');
const currentUsername = document.getElementById('current-username');
const menuToggle = document.getElementById('menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebar = document.querySelector('.sidebar');

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        initializeApp();
    }
});

// Initialize the app
function initializeApp() {
    initializeSocket();
    loadUsers();
    updateUI();
    
    authContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
}

// Update UI elements
function updateUI() {
    currentUsername.textContent = currentUser;
}

// Show signup form
function showSignup() {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
}

// Show login form
function showLogin() {
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
}

// Sign up new user
async function signup() {
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Auto login after signup
            currentUser = data.username;
            localStorage.setItem('currentUser', currentUser);
            initializeApp();
        } else {
            alert(data.error || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed. Please try again.');
    }
}

// Login user
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.username;
            localStorage.setItem('currentUser', currentUser);
            initializeApp();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

// Initialize socket connection
function initializeSocket() {
    socket = io();
    
    socket.emit('user online', currentUser);
    
    socket.on('online users', (users) => {
        onlineUsers = users;
        updateOnlineUsersList();
        updateUserStatus();
    });
    
    socket.on('private message', (data) => {
        // If message is for current chat, display it
        if ((data.from === selectedUser && data.to === currentUser) || 
            (data.to === selectedUser && data.from === currentUser)) {
            addMessageToChat(data.from, data.message, data.timestamp, data.from === currentUser);
        }
    });
}

// Load all users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        usersList.innerHTML = '';
        onlineUsersList.innerHTML = '';
        
        users.forEach(user => {
            if (user.username !== currentUser) {
                createUserElement(user.username, usersList);
                
                // Add to online users if they're online
                if (onlineUsers.includes(user.username)) {
                    createUserElement(user.username, onlineUsersList, true);
                }
            }
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Create user element
function createUserElement(username, container, isOnline = false) {
    const userElement = document.createElement('div');
    userElement.className = 'user-item';
    userElement.dataset.username = username;
    
    userElement.innerHTML = `
        <div class="avatar small">
            <i class="fas fa-user"></i>
        </div>
        <div class="user-details">
            <div class="user-name">${username}</div>
        </div>
        <span class="status ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</span>
    `;
    
    userElement.addEventListener('click', () => selectUser(username));
    container.appendChild(userElement);
}

// Update online users list
function updateOnlineUsersList() {
    onlineUsersList.innerHTML = '';
    
    onlineUsers.forEach(username => {
        if (username !== currentUser) {
            createUserElement(username, onlineUsersList, true);
        }
    });
}

// Update user status in chat header
function updateUserStatus() {
    if (selectedUser) {
        const isOnline = onlineUsers.includes(selectedUser);
        userStatus.textContent = isOnline ? 'Online' : 'Offline';
        userStatus.className = `status ${isOnline ? 'online' : 'offline'}`;
    }
}

// Search users
function searchUsers() {
    const searchTerm = document.getElementById('search-user').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const username = item.dataset.username.toLowerCase();
        if (username.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Select a user to chat with
async function selectUser(username) {
    selectedUser = username;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(item => {
        if (item.dataset.username === username) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    currentChatUser.textContent = username;
    updateUserStatus();
    messageInput.disabled = false;
    sendButton.disabled = false;
    
    // Load chat history
    await loadChatHistory();
    
    // Focus on message input
    messageInput.focus();
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
}

// Load chat history
async function loadChatHistory() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        messageContainer.innerHTML = '';
        
        const filteredMessages = messages.filter(msg => 
            (msg.from === currentUser && msg.to === selectedUser) || 
            (msg.from === selectedUser && msg.to === currentUser)
        );
        
        // Sort messages by timestamp
        filteredMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        filteredMessages.forEach(msg => {
            addMessageToChat(msg.from, msg.message, msg.timestamp, msg.from === currentUser);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message || !selectedUser) return;
    
    // Send via socket
    socket.emit('private message', {
        from: currentUser,
        to: selectedUser,
        message: message
    });
    
    // Clear input
    messageInput.value = '';
}

// Add message to chat UI
function addMessageToChat(sender, message, timestamp, isSent) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <div class="message-content">
            ${message}
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messageContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Logout
function logout() {
    currentUser = null;
    selectedUser = null;
    localStorage.removeItem('currentUser');
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    chatContainer.style.display = 'none';
    authContainer.style.display = 'flex';
    showLogin();
}

// Toggle sidebar on mobile
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
});

// Close sidebar when clicking overlay
sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
});

// Add event listener for Enter key in message input
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});