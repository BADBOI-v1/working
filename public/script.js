// DOM elements for authentication
const authContainer = document.getElementById('auth-container');
const mainContent = document.getElementById('main-content');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const userDisplay = document.getElementById('user-display');
const logoutButton = document.getElementById('logout-button');

// DOM elements for main UI
const commandInput = document.getElementById('command-input');
const sendButton = document.getElementById('send-button');
const logDisplay = document.getElementById('log-display');
const cpuBar = document.getElementById('cpu-bar');
const cpuUsage = document.getElementById('cpu-usage');
const ramBar = document.getElementById('ram-bar');
const ramUsage = document.getElementById('ram-usage');
const diskBar = document.getElementById('disk-bar');
const diskUsage = document.getElementById('disk-usage');
const uptimeDisplay = document.getElementById('uptime');
const serverStatus = document.getElementById('server-status');
const fileList = document.getElementById('file-list');
const fileContent = document.getElementById('file-content');
const createFolderButton = document.getElementById('create-folder-button');
const createFileButton = document.getElementById('create-file-button');
const fileUpload = document.getElementById('file-upload');
const fileName = document.getElementById('file-name');
const uploadButton = document.getElementById('upload-button');
const deleteButton = document.getElementById('delete-button');
const viewButton = document.getElementById('view-button');
const copyButton = document.getElementById('copy-button');
const stopButton = document.getElementById('stop-button');
const filesButton = document.getElementById('files-button');
const myPathButton = document.getElementById('my-path-button');

// Initialize socket connection but don't connect immediately
const socket = io({
    autoConnect: false
});

// Event handlers for switching between login and register forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Function to show error message
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => {
        element.classList.add('hidden');
    }, 3000);
}

// Function to add log messages
function addLogMessage(type, message) {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-2';
    
    let typeClass = 'text-green-400';
    if (type === 'ERROR') typeClass = 'text-red-500';
    if (type === 'WARNING') typeClass = 'text-yellow-500';
    
    logEntry.innerHTML = `[<span class="${typeClass}">${type}</span>] <span class="text-gray-400">${timestamp}</span> ${message}`;
    logDisplay.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logDisplay.scrollTop = logDisplay.scrollHeight;
}

// Register new user
registerButton.addEventListener('click', async () => {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // Simple validation
    if (!username || !password) {
        return showError(registerError, 'Username and password are required');
    }
    
    if (password !== confirmPassword) {
        return showError(registerError, 'Passwords do not match');
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        // Show success and switch to login
        alert('Registration successful! Please login.');
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        
        // Clear the form
        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-confirm-password').value = '';
        
    } catch (error) {
        showError(registerError, error.message);
    }
});

// Login user
loginButton.addEventListener('click', async () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    // Simple validation
    if (!username || !password) {
        return showError(loginError, 'Username and password are required');
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Store user info
        sessionStorage.setItem('user', JSON.stringify(data.user));
        
        // Update UI
        userDisplay.textContent = `Welcome, ${data.user.username}`;
        
        // Hide auth container and show main content
        authContainer.classList.add('hidden');
        mainContent.classList.remove('hidden');
        
        // Connect socket now that we're authenticated
        socket.connect();
        
        // Initialize the UI
        initializeUI();
        
        // Log successful login
        addLogMessage('INFO', `User ${data.user.username} logged in successfully`);
        
    } catch (error) {
        showError(loginError, error.message);
    }
});

// Logout user
logoutButton.addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        
        // Clear user data
        sessionStorage.removeItem('user');
        
        // Disconnect socket
        socket.disconnect();
        
        // Show auth container and hide main content
        mainContent.classList.add('hidden');
        authContainer.classList.remove('hidden');
        
        // Clear sensitive form fields
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        
        addLogMessage('INFO', 'User logged out');
        
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Check if user is already logged in on page load
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            // Store user info
            sessionStorage.setItem('user', JSON.stringify(data.user));
            
            // Update UI
            userDisplay.textContent = `Welcome, ${data.user.username}`;
            
            // Hide auth container and show main content
            authContainer.classList.add('hidden');
            mainContent.classList.remove('hidden');
            
            // Connect socket
            socket.connect();
            
            // Initialize the UI
            initializeUI();
            
            addLogMessage('INFO', `User ${data.user.username} session restored`);
        }
    } catch (error) {
        console.error('Auth status check error:', error);
    }
}

// Initialize UI elements and socket listeners
function initializeUI() {
    // Request file list
    socket.emit('listFiles');
    
    // Request system stats
    updateSystemStats();
    
    // Start periodic updates
    setInterval(updateSystemStats, 5000); // Update every 5 seconds
}

// Update system statistics
function updateSystemStats() {
    socket.emit('getSystemStats');
}

// Socket event listeners
socket.on('connect', () => {
    serverStatus.innerHTML = '<span class="h-3 w-3 rounded-full bg-green-500 mr-2"></span> System Active';
    addLogMessage('INFO', 'Connected to server');
});

socket.on('disconnect', () => {
    serverStatus.innerHTML = '<span class="h-3 w-3 rounded-full bg-red-500 mr-2 pulse-alert"></span> System Disconnected';
    addLogMessage('WARNING', 'Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    addLogMessage('ERROR', `Connection error: ${error.message}`);
});

// Handle system stats updates
socket.on('systemStats', (stats) => {
    // Update CPU
    cpuBar.style.width = `${stats.cpu}%`;
    cpuUsage.textContent = `${stats.cpu}%`;
    
    // Update RAM
    ramBar.style.width = `${stats.ramPercentage}%`;
    ramUsage.textContent = `${stats.ramUsed}GB`;
    
    // Update Disk
    diskBar.style.width = `${stats.diskPercentage}%`;
    diskUsage.textContent = `${stats.diskUsed}GB`;
    
    // Update Uptime
    uptimeDisplay.textContent = stats.uptime;
});

// Handle file listing
socket.on('fileList', (files) => {
    // Clear current options
    while (fileList.options.length > 1) {
        fileList.remove(1);
    }
    
    // Add new options
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file.path;
        option.textContent = file.name + (file.isDirectory ? '/' : '');
        
        // Add icon prefix
        if (file.isDirectory) {
            option.textContent = '📁 ' + option.textContent;
        } else {
            option.textContent = '📄 ' + option.textContent;
        }
        
        fileList.appendChild(option);
    });
    
    addLogMessage('INFO', 'File list updated');
});

// Handle file content
socket.on('fileContent', (content) => {
    fileContent.value = content;
    addLogMessage('INFO', 'File content loaded');
});

// Handle errors
socket.on('error', (error) => {
    addLogMessage('ERROR', error.message);
});

// Handle server logs
socket.on('log', (log) => {
    addLogMessage(log.type, log.message);
});

// Send command
sendButton.addEventListener('click', () => {
    const command = commandInput.value.trim();
    
    if (command) {
        socket.emit('executeCommand', { command });
        addLogMessage('INFO', `Executing command: ${command}`);
        commandInput.value = '';
    }
});

// Enter key to send command
commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});

// File upload related events
fileUpload.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileName.textContent = e.target.files[0].name;
    } else {
        fileName.textContent = 'No file chosen';
    }
});

uploadButton.addEventListener('click', () => {
    const file = fileUpload.files[0];
    
    if (!file) {
        addLogMessage('ERROR', 'No file selected for upload');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        socket.emit('uploadFile', { 
            name: file.name,
            content: event.target.result
        });
    };
    
    reader.onerror = (error) => {
        addLogMessage('ERROR', `File read error: ${error}`);
    };
    
    reader.readAsArrayBuffer(file);
    addLogMessage('INFO', `Uploading file: ${file.name}`);
});

// Create folder
createFolderButton.addEventListener('click', () => {
    const folderName = prompt('Enter folder name:');
    
    if (folderName) {
        socket.emit('createFolder', { name: folderName });
        addLogMessage('INFO', `Creating folder: ${folderName}`);
    }
});

// Create file
createFileButton.addEventListener('click', () => {
    const fileName = prompt('Enter file name:');
    
    if (fileName) {
        const content = '';
        socket.emit('createFile', { 
            name: fileName,
            content: content
        });
        addLogMessage('INFO', `Creating file: ${fileName}`);
    }
});

// View file content
viewButton.addEventListener('click', () => {
    const selectedPath = fileList.value;
    
    if (selectedPath) {
        socket.emit('getFileContent', { path: selectedPath });
        addLogMessage('INFO', `Viewing content of: ${selectedPath}`);
    } else {
        addLogMessage('ERROR', 'No file selected to view');
    }
});

// Delete file or folder
deleteButton.addEventListener('click', () => {
    const selectedPath = fileList.value;
    
    if (selectedPath) {
        if (confirm(`Are you sure you want to delete: ${selectedPath}?`)) {
            socket.emit('deletePath', { path: selectedPath });
            addLogMessage('INFO', `Deleting: ${selectedPath}`);
        }
    } else {
        addLogMessage('ERROR', 'No file or folder selected to delete');
    }
});

// Copy file content to clipboard
copyButton.addEventListener('click', () => {
    fileContent.select();
    document.execCommand('copy');
    
    addLogMessage('INFO', 'Content copied to clipboard');
});

// Stop server button
stopButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to stop the server?')) {
        socket.emit('stopServer');
        addLogMessage('WARNING', 'Server stop requested');
    }
});

// Files button (refresh file list)
filesButton.addEventListener('click', () => {
    socket.emit('listFiles');
    addLogMessage('INFO', 'Refreshing file list');
});

// My Path button
myPathButton.addEventListener('click', () => {
    socket.emit('getMyPath');
});

socket.on('myPath', (data) => {
    addLogMessage('INFO', `Current path: ${data.path}`);
});

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', checkAuthStatus);