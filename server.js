const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static('public'));
app.use(express.json());

// File upload configuration
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Current running process
let currentProcess = null;
let currentPath = process.cwd();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    // Command execution
    socket.on('command', (data) => {
        executeCommand(data.command, socket);
    });

    // Interactive input handling
    socket.on('input', (data) => {
        if (currentProcess) {
            currentProcess.stdin.write(data.text);
        }
    });

    // Stop command
    socket.on('stop', () => {
        if (currentProcess) {
            currentProcess.kill();
            currentProcess = null;
            socket.emit('output', { response: 'Command stopped.' });
        }
    });

    // File management
    socket.on('list_files', async (data) => {
        try {
            const filesPath = data.path || currentPath;
            const files = await fs.readdir(filesPath, { withFileTypes: true });
            const fileList = files.map(file => ({
                name: file.name,
                type: file.isDirectory() ? 'directory' : 'file',
                size: file.isFile() ? fs.statSync(path.join(filesPath, file.name)).size : 0
            }));
            socket.emit('file_list', { files: fileList });
        } catch (error) {
            socket.emit('file_list', { files: [], error: error.message });
        }
    });

    socket.on('view_file', async (data) => {
        try {
            const filePath = path.join(data.path || currentPath, data.filename);
            const content = await fs.readFile(filePath, 'utf8');
            socket.emit('file_content', { content });
        } catch (error) {
            socket.emit('file_content', { content: `Error: ${error.message}` });
        }
    });

    socket.on('delete_file', async (data) => {
        try {
            const filePath = path.join(data.path || currentPath, data.filename);
            await fs.unlink(filePath);
            socket.emit('file_deleted', { success: true });
        } catch (error) {
            socket.emit('file_deleted', { success: false, error: error.message });
        }
    });

    socket.on('get_current_path', () => {
        socket.emit('current_path', { path: currentPath });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Execute shell command
function executeCommand(command, socket) {
    // Prevent command injection
    if (command.includes(';') || command.includes('&&') || command.includes('||')) {
        socket.emit('output', { response: 'Invalid command format' });
        return;
    }

    try {
        // Split command to handle different shells/platforms
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
        const shellFlag = process.platform === 'win32' ? '/c' : '-c';

        currentProcess = spawn(shell, [shellFlag, command], {
            cwd: currentPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        currentProcess.stdout.on('data', (data) => {
            socket.emit('output', { response: data.toString() });
        });

        currentProcess.stderr.on('data', (data) => {
            socket.emit('output', { response: `Error: ${data.toString()}` });
        });

        currentProcess.on('close', (code) => {
            socket.emit('output', { response: `Command exited with code ${code}` });
            currentProcess = null;
        });
    } catch (error) {
        socket.emit('output', { response: `Execution error: ${error.message}` });
    }
}

// Server stats endpoint
app.get('/stats', (req, res) => {
    const cpuUsage = os.cpus().map(cpu => cpu.times);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = Math.floor(os.uptime() / 3600); // hours

    res.json({
        cpu: `${((cpuUsage[0].user + cpuUsage[0].sys) / 100).toFixed(2)}%`,
        ram: `${((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2)}`,
        disk: `${((totalMem - freeMem) / totalMem * 100).toFixed(2)}`,
        uptime: `${uptime}h`
    });
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const tempPath = req.file.path;
    const targetPath = path.join(currentPath, req.file.originalname);

    fs.rename(tempPath, targetPath)
        .then(() => {
            res.json({ success: true, message: 'File uploaded successfully' });
        })
        .catch((error) => {
            res.status(500).json({ success: false, message: error.message });
        });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
