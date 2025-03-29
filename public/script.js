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

sendButton.addEventListener('click', () => {
  const command = commandInput.value;
  socket.emit('command', command);
  commandInput.value = '';
  logDisplay.classList.remove('hidden'); // Show the log display when a command is sent
});

filesButton.addEventListener('click', () => {
    socket.emit('listFiles');
    logDisplay.classList.remove('hidden'); // Show the log display when files are requested
});

myPathButton.addEventListener('click', () => {
    socket.emit('getMyPath');
    logDisplay.classList.remove('hidden'); // Show the log display when path is requested
});

stopButton.addEventListener('click', () => {
    socket.emit('stopServer');
    logDisplay.classList.remove('hidden'); // Show the log display when server is stopped
});

uploadButton.addEventListener('click', () => {
    const file = fileUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            socket.emit('uploadFile', { filename: file.name, content: e.target.result });
            logDisplay.classList.remove('hidden'); // Show log during upload
        };
        reader.readAsText(file);
    } else {
        alert('Please select a file to upload.');
    }
});

deleteButton.addEventListener('click', () => {
    const filename = fileListSelect.value;
    if (filename) {
        socket.emit('deleteFile', filename);
        logDisplay.classList.remove('hidden'); //Show Log
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
    //Update fileList select box.
    fileListSelect.innerHTML = '';
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        fileListSelect.appendChild(option);
    });
});

socket.on('fileContent', (content) => {
    fileContent.value = content;
});
