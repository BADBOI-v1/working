const socket = io();

const commandInput = document.getElementById('command-input');
const sendButton = document.getElementById('send-button');
const cpuUsage = document.getElementById('cpu-usage');
const ramUsage = document.getElementById('ram-usage');
const diskUsage = document.getElementById('disk-usage');
const uptime = document.getElementById('uptime');
const filesButton = document.getElementById('files-button');
const myPathButton = document.getElementById('my-path-button');
const stopButton = document.getElementById('stop-button');
const logDisplay = document.getElementById('log-display');

const fileUpload = document.getElementById('file-upload');
const uploadButton = document.getElementById('upload-button');
const fileListSelect = document.getElementById('file-list');
const deleteButton = document.getElementById('delete-button');
const viewButton = document.getElementById('view-button');
const fileContent = document.getElementById('file-content');

// Event listeners for command operations
sendButton.addEventListener('click', () => {
  const command = commandInput.value;
  socket.emit('command', command);
  commandInput.value = '';
  logDisplay.classList.remove('hidden'); // Show the log display when a command is sent
});

// Event listeners for button operations
filesButton.addEventListener('click', () => {
    socket.emit('listFiles');
    logDisplay.classList.remove('hidden'); // Show the log display when files are requested
});

myPathButton.addEventListener('click', () => {
    socket.emit('getMyPath');
    logDisplay.classList.remove('hidden'); // Show the log display when path is requested
});

// New button for directory navigation
document.getElementById('back-dir-button').addEventListener('click', () => {
    socket.emit('changeDirectory', '..');
    logDisplay.classList.remove('hidden');
});

stopButton.addEventListener('click', () => {
    socket.emit('stopServer');
    logDisplay.classList.remove('hidden'); // Show the log display when server is stopped
});

// File upload handling
uploadButton.addEventListener('click', () => {
    const file = fileUpload.files[0];
    if (file) {
        const reader = new FileReader();
        
        if (file.name.toLowerCase().endsWith('.zip')) {
            // Handle zip files with readAsDataURL to preserve binary data
            reader.onload = (e) => {
                socket.emit('uploadFile', { filename: file.name, content: e.target.result });
                logDisplay.classList.remove('hidden'); // Show log during upload
            };
            reader.readAsDataURL(file);
        } else {
            // Handle text files
            reader.onload = (e) => {
                socket.emit('uploadFile', { filename: file.name, content: e.target.result });
                logDisplay.classList.remove('hidden'); // Show log during upload
            };
            reader.readAsText(file);
        }
    } else {
        alert('Please select a file to upload.');
    }
});

// File operations
deleteButton.addEventListener('click', () => {
    const filename = fileListSelect.value;
    if (filename) {
        if (confirm(`Are you sure you want to delete "${filename}"?`)) {
            socket.emit('deleteFile', filename);
            logDisplay.classList.remove('hidden'); //Show Log
        }
    } else {
        alert('Please select a file to delete.');
    }
});

viewButton.addEventListener('click', () => {
    const filename = fileListSelect.value;
    if (filename) {
        socket.emit('viewFile', filename);
        logDisplay.classList.remove('hidden'); //Show Log
    } else {
        alert('Please select a file to view.');
    }
});

// Add double-click event for directory navigation or file viewing
fileListSelect.addEventListener('dblclick', () => {
    const filename = fileListSelect.value;
    if (filename) {
        socket.emit('viewFile', filename); // This will handle both files and directories
        logDisplay.classList.remove('hidden');
    }
});

// Add event listeners for new create folder/file buttons
document.getElementById('create-folder-button').addEventListener('click', () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
        socket.emit('createFolder', folderName);
    }
});

document.getElementById('create-file-button').addEventListener('click', () => {
    const filename = prompt('Enter file name:');
    if (filename) {
        const content = prompt('Enter file content (optional):');
        socket.emit('createFile', { filename, content });
    }
});

// Socket event handlers
socket.on('resourceUsage', (data) => {
  cpuUsage.textContent = data.cpu;
  ramUsage.textContent = data.ram;
  diskUsage.textContent = data.disk;
  uptime.textContent = data.uptime;
});

socket.on('log', (message) => {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logDisplay.appendChild(logEntry);
    logDisplay.scrollTop = logDisplay.scrollHeight; // Auto-scroll to bottom
});

socket.on('fileList', (files) => {
    // Clear current options
    fileListSelect.innerHTML = '';
    
    // Add each file to the select list with different icons for files and folders
    files.forEach(fileInfo => {
        const option = document.createElement('option');
        option.value = fileInfo.name;
        
        // Add icon indicator
        if (fileInfo.isDirectory) {
            option.textContent = `📁 ${fileInfo.name}`;
        } else if (fileInfo.name.toLowerCase().endsWith('.zip')) {
            option.textContent = `🗜️ ${fileInfo.name}`;
        } else {
            option.textContent = `📄 ${fileInfo.name}`;
        }
        
        fileListSelect.appendChild(option);
    });
});

socket.on('fileContent', (content) => {
    fileContent.value = content;
});

// Add new event handler for auto deployment status
socket.on('deploymentStatus', (message) => {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logEntry.style.color = '#4caf50'; // Green color for deployment messages
    logDisplay.appendChild(logEntry);
    logDisplay.scrollTop = logDisplay.scrollHeight;
});
