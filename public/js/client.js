// public/js/client.js
let socket = null;
let currentUser = null;
let selectedUser = null;

// DOM elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const usersList = document.getElementById('users-list');
const messageContainer = document.getElementById('message-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const currentChatUser = document.getElementById('current-chat-user');

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
            alert('Account created successfully. Please login.');
            showLogin();
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
            currentUser = username;
            initializeSocket();
            loadUsers();
            authContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
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
    
    socket.on('private message', (data) => {
        // If message is for current chat, display it
        if ((data.from === selectedUser && data.to === currentUser) || 
            (data.to === selectedUser && data.from === currentUser)) {
            addMessageToChat(data.from, data.message, data.from === currentUser);
        }
    });
}

// Load all users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        usersList.innerHTML = '';
        
        users.forEach(user => {
            if (user.username !== currentUser) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.textContent = user.username;
                userElement.addEventListener('click', () => selectUser(user.username));
                usersList.appendChild(userElement);
            }
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Search users
function searchUsers() {
    const searchTerm = document.getElementById('search-user').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const username = item.textContent.toLowerCase();
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
        if (item.textContent === username) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    currentChatUser.textContent = username;
    messageInput.disabled = false;
    sendButton.disabled = false;
    
    // Load chat history
    await loadChatHistory();
    
    // Focus on message input
    messageInput.focus();
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
            addMessageToChat(msg.from, msg.message, msg.from === currentUser);
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
function addMessageToChat(sender, message, isSent) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = message;
    
    messageElement.appendChild(contentElement);
    messageContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Logout
function logout() {
    currentUser = null;
    selectedUser = null;
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    chatContainer.style.display = 'none';
    authContainer.style.display = 'flex';
    showLogin();
}

// Add event listener for Enter key in message input
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});