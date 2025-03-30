const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');
const AdmZip = require('adm-zip');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const io = socketIO(server);

// File to store uploaded file information
const recordsFile = 'fileRecords.json';

// Load previous file records if they exist
let uploadedFiles = [];
try {
    if (fs.existsSync(recordsFile)) {
        const data = fs.readFileSync(recordsFile, 'utf8');
        uploadedFiles = JSON.parse(data);
        if (!Array.isArray(uploadedFiles)) {
            throw new Error('Invalid file format');
        }
    }
} catch (error) {
    console.error(`Failed to load file records: ${error.message}`);
    uploadedFiles = []; // Reset to empty array if corrupted or invalid
}

// Function to save file records persistently
function saveFileRecords() {
    fs.writeFileSync(recordsFile, JSON.stringify(uploadedFiles, null, 2));
}

// Function to get resource usage
function getResourceUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const ramUsageGB = (totalMemory - freeMemory) / (1024 ** 3);
    
    return {
        cpu: `${os.loadavg()[0].toFixed(2)}%`,
        ram: `${ramUsageGB.toFixed(2)}GB`,
        uptime: formatUptime(process.uptime())
    };
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Function to deploy a Node.js application
function deployNodeApp(projectPath, socket) {
    socket.emit('deploymentStatus', `Starting deployment from: ${projectPath}`);
    
    process.chdir(projectPath);
    
    socket.emit('deploymentStatus', 'Installing dependencies...');
    exec('npm install', (error, stdout, stderr) => {
        if (error) {
            socket.emit('deploymentStatus', `Deployment error: ${error.message}`);
            return;
        }
        
        if (stderr) socket.emit('deploymentStatus', `npm warning: ${stderr}`);
        socket.emit('deploymentStatus', `Dependencies installed: ${stdout}`);
        
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            if (packageJson.scripts && packageJson.scripts.start) {
                socket.emit('deploymentStatus', 'Starting application...');
                const child = spawn('npm', ['start'], { detached: true });

                child.stdout.on('data', data => socket.emit('deploymentStatus', `App output: ${data}`));
                child.stderr.on('data', data => socket.emit('deploymentStatus', `App error: ${data}`));
                child.on('close', code => socket.emit('deploymentStatus', `Application exited with code ${code}`));
                socket.emit('deploymentStatus', 'Application deployed successfully!');
            } else {
                socket.emit('deploymentStatus', 'No start script found in package.json');
            }
        } catch (err) {
            socket.emit('deploymentStatus', `Error reading package.json: ${err.message}`);
        }
    });
}

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.emit('resourceUsage', getResourceUsage());

    socket.on('command', (command) => {
        const child = spawn(command, { shell: true });
        child.stdout.on('data', data => socket.emit('log', data.toString()));
        child.stderr.on('data', data => socket.emit('log', `ERROR: ${data.toString()}`));
        child.on('close', code => socket.emit('log', `Command exited with code ${code}`));
    });

    socket.on('listFiles', () => {
        socket.emit('fileList', uploadedFiles);
    });

    socket.on('uploadFile', (data) => {
        const { filename, content } = data;
        
        if (filename.toLowerCase().endsWith('.zip')) {
            fs.writeFile(filename, Buffer.from(content.split(',')[1], 'base64'), (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload zip: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully`);
                    
                    const extractionDir = `extracted_${Date.now()}`;
                    fs.mkdirSync(extractionDir, { recursive: true });

                    try {
                        const zip = new AdmZip(filename);
                        zip.extractAllTo(extractionDir, true);
                        socket.emit('log', `Extracted ${filename} to ${extractionDir}`);

                        uploadedFiles.push({ name: filename, extractedDir: extractionDir });
                        saveFileRecords();

                        deployNodeApp(extractionDir, socket);
                    } catch (err) {
                        socket.emit('log', `Failed to extract: ${err}`);
                    }

                    socket.emit('listFiles');
                }
            });
        } else {
            let fileContent = content.startsWith('data:') ? Buffer.from(content.split(',')[1], 'base64') : content;
            fs.writeFile(filename, fileContent, (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload: ${err}`);
                } else {
                    uploadedFiles.push({ name: filename });
                    saveFileRecords();
                    socket.emit('log', `File ${filename} uploaded successfully`);
                    socket.emit('listFiles');
                }
            });
        }
    });

    socket.on('deleteFile', (filename) => {
        fs.stat(filename, (err, stats) => {
            if (err) {
                socket.emit('log', `Error finding file: ${err}`);
                return;
            }
            
            if (stats.isDirectory()) {
                fs.rm(filename, { recursive: true }, (err) => {
                    if (err) {
                        socket.emit('log', `Failed to delete: ${err}`);
                    } else {
                        uploadedFiles = uploadedFiles.filter(file => file.name !== filename);
                        saveFileRecords();
                        socket.emit('log', `Directory ${filename} deleted`);
                        socket.emit('listFiles');
                    }
                });
            } else {
                fs.unlink(filename, (err) => {
                    if (err) {
                        socket.emit('log', `Failed to delete: ${err}`);
                    } else {
                        uploadedFiles = uploadedFiles.filter(file => file.name !== filename);
                        saveFileRecords();
                        socket.emit('log', `File ${filename} deleted`);
                        socket.emit('listFiles');
                    }
                });
            }
        });
    });

    socket.on('viewFile', (filename) => {
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) {
                socket.emit('log', `Failed to view: ${err}`);
            } else {
                socket.emit('fileContent', data);
            }
        });
    });

    setInterval(() => {
        socket.emit('resourceUsage', getResourceUsage());
    }, 5000);

    socket.on('disconnect', () => console.log('Client disconnected'));
});
