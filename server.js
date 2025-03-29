const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');
const AdmZip = require('adm-zip');

const app = express();
const port = process.env.PORT || 3000;

// Create a permanent storage directory
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
// Also serve files from storage directory
app.use('/storage', express.static(path.join(__dirname, 'storage')));

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const io = socketIO(server);

// Function to get resource usage
function getResourceUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const ramUsageBytes = totalMemory - freeMemory;
    const ramUsageGB = ramUsageBytes / (1024 ** 3);
    const formattedRamUsage = ramUsageGB.toFixed(2);

    return {
        cpu: `${os.loadavg()[0].toFixed(2)}%`,
        ram: `${formattedRamUsage}GB`,
        disk: 'N/A', // Requires more complex implementation
        uptime: formatUptime(process.uptime())
    };
}

// Function to format uptime
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Function to find package.json in extracted zip contents
function findPackageJson(directory) {
    let packageJsonPath = null;
    
    function searchDir(dir, depth = 0) {
        if (depth > 5) return; // Limit search depth to prevent infinite recursion
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                searchDir(fullPath, depth + 1);
            } else if (entry.name === 'package.json') {
                packageJsonPath = path.dirname(fullPath);
                return;
            }
        }
    }
    
    searchDir(directory);
    return packageJsonPath;
}

// Function to deploy a Node.js application
function deployNodeApp(projectPath, socket) {
    socket.emit('deploymentStatus', `Starting deployment from: ${projectPath}`);
    
    // Change to the project directory
    process.chdir(projectPath);
    
    // Install dependencies
    socket.emit('deploymentStatus', 'Installing dependencies...');
    exec('npm install', (error, stdout, stderr) => {
        if (error) {
            socket.emit('deploymentStatus', `Deployment error: ${error.message}`);
            return;
        }
        
        if (stderr) {
            socket.emit('deploymentStatus', `npm warning: ${stderr}`);
        }
        
        socket.emit('deploymentStatus', `Dependencies installed: ${stdout}`);
        
        // Check if there's a start script in package.json
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            
            if (packageJson.scripts && packageJson.scripts.start) {
                socket.emit('deploymentStatus', 'Starting application...');
                
                // Start the application using npm start
                const child = spawn('npm', ['start'], { detached: true });
                
                child.stdout.on('data', (data) => {
                    socket.emit('deploymentStatus', `App output: ${data.toString()}`);
                });
                
                child.stderr.on('data', (data) => {
                    socket.emit('deploymentStatus', `App error: ${data.toString()}`);
                });
                
                child.on('close', (code) => {
                    socket.emit('deploymentStatus', `Application exited with code ${code}`);
                });
                
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
    
    // Keep track of current working directory
    let currentDir = storageDir;

    // Send initial resource usage
    socket.emit('resourceUsage', getResourceUsage());

    socket.on('command', (command) => {
      const child = spawn(command, { shell: true, cwd: currentDir });

      child.stdout.on('data', (data) => {
        socket.emit('log', data.toString());
      });

      child.stderr.on('data', (data) => {
        socket.emit('log', `ERROR: ${data.toString()}`);
      });

      child.on('close', (code) => {
        socket.emit('log', `Command exited with code ${code}`);
      });
    });

    socket.on('listFiles', () => {
        // Get the list of files from current directory
        fs.readdir(currentDir, { withFileTypes: true }, (err, dirents) => {
          if (err) {
            socket.emit('log', `Failed to get file list ${err}`);
            return;
          }
          
          // Create array with file info including type (file or directory)
          const files = dirents.map(dirent => {
            return {
              name: dirent.name,
              isDirectory: dirent.isDirectory()
            };
          });
          
          socket.emit('fileList', files);
          socket.emit('log', `Current directory: ${currentDir}`);
        });
    });

    socket.on('getMyPath', () => {
      socket.emit('log', `Current Path: ${currentDir}`);
    });

    socket.on('changeDirectory', (dirName) => {
        // Handle .. for going up a directory
        if (dirName === '..') {
            const parentDir = path.dirname(currentDir);
            // Don't allow navigating outside storage directory
            if (parentDir.startsWith(storageDir) || parentDir === path.dirname(storageDir)) {
                currentDir = parentDir;
                socket.emit('log', `Changed to directory: ${currentDir}`);
                socket.emit('listFiles');
            } else {
                socket.emit('log', `Cannot navigate outside storage directory`);
            }
            return;
        }
        
        // Check if directory exists and change to it
        const newDir = path.join(currentDir, dirName);
        fs.stat(newDir, (err, stats) => {
            if (err || !stats.isDirectory()) {
                socket.emit('log', `Not a valid directory: ${dirName}`);
                return;
            }
            
            currentDir = newDir;
            socket.emit('log', `Changed to directory: ${currentDir}`);
            socket.emit('listFiles');
        });
    });

    socket.on('stopServer', () => {
        process.exit(0);
    });

    socket.on('uploadFile', (data) => {
        const { filename, content } = data;
        const filePath = path.join(currentDir, filename);
        
        // Check if it's a zip file
        if (filename.toLowerCase().endsWith('.zip')) {
            // Save the zip file first
            fs.writeFile(filePath, Buffer.from(content.split(',')[1], 'base64'), (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload zip file: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully to ${filePath}`);
                    
                    // Create a unique extraction directory to prevent conflicts
                    const extractionDir = path.join(currentDir, `extracted_${Date.now()}`);
                    fs.mkdirSync(extractionDir, { recursive: true });
                    
                    // Extract the zip file
                    try {
                        const zip = new AdmZip(filePath);
                        zip.extractAllTo(extractionDir, true);
                        socket.emit('log', `Extracted zip file ${filename} to ${extractionDir} successfully`);
                        
                        // Look for package.json in the extracted directory
                        const packageJsonDir = findPackageJson(extractionDir);
                        
                        if (packageJsonDir) {
                            socket.emit('log', `Found Node.js project at: ${packageJsonDir}`);
                            
                            // Auto deploy the application
                            deployNodeApp(packageJsonDir, socket);
                        } else {
                            socket.emit('log', 'No Node.js project found in the uploaded zip file');
                        }
                    } catch (err) {
                        socket.emit('log', `Failed to extract zip file: ${err}`);
                    }
                    
                    socket.emit('listFiles'); // Refresh file list after upload and extraction
                }
            });
        } else {
            // Regular file upload
            let fileContent = content;
            // Check if this is a base64 data URL
            if (content.startsWith('data:')) {
                const base64Data = content.split(',')[1];
                fileContent = Buffer.from(base64Data, 'base64');
            }
            
            fs.writeFile(filePath, fileContent, (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload file: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully to ${filePath}`);
                    socket.emit('listFiles'); // Refresh file list after upload
                }
            });
        }
    });

    socket.on('deleteFile', (filename) => {
        const filePath = path.join(currentDir, filename);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                socket.emit('log', `Failed to get file stats: ${err}`);
                return;
            }
            
            if (stats.isDirectory()) {
                // Remove directory and its contents
                fs.rm(filePath, { recursive: true }, (err) => {
                    if (err) {
                        socket.emit('log', `Failed to delete directory: ${err}`);
                    } else {
                        socket.emit('log', `Directory ${filename} deleted successfully from ${filePath}`);
                        socket.emit('listFiles'); // Refresh file list
                    }
                });
            } else {
                // Remove file
                fs.unlink(filePath, (err) => {
                    if (err) {
                        socket.emit('log', `Failed to delete file: ${err}`);
                    } else {
                        socket.emit('log', `File ${filename} deleted successfully from ${filePath}`);
                        socket.emit('listFiles'); // Refresh file list
                    }
                });
            }
        });
    });

    socket.on('viewFile', (filename) => {
        const filePath = path.join(currentDir, filename);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                socket.emit('log', `Failed to get file stats: ${err}`);
                return;
            }
            
            if (stats.isDirectory()) {
                // Change directory if it's a directory
                currentDir = filePath;
                socket.emit('log', `Changed to directory: ${currentDir}`);
                socket.emit('listFiles');
            } else {
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        socket.emit('log', `Failed to view file: ${err}`);
                    } else {
                        socket.emit('fileContent', data);
                        socket.emit('log', `Viewing file: ${filePath}`);
                    }
                });
            }
        });
    });

    // New event handler for creating a new folder
    socket.on('createFolder', (folderName) => {
        const folderPath = path.join(currentDir, folderName);
        fs.mkdir(folderPath, { recursive: true }, (err) => {
            if (err) {
                socket.emit('log', `Failed to create folder: ${err}`);
            } else {
                socket.emit('log', `Folder ${folderName} created successfully at ${folderPath}`);
                socket.emit('listFiles'); // Refresh file list
            }
        });
    });

    // New event handler for creating a new file
    socket.on('createFile', (data) => {
        const { filename, content } = data;
        const filePath = path.join(currentDir, filename);
        fs.writeFile(filePath, content || '', (err) => {
            if (err) {
                socket.emit('log', `Failed to create file: ${err}`);
            } else {
                socket.emit('log', `File ${filename} created successfully at ${filePath}`);
                socket.emit('listFiles'); // Refresh file list
            }
        });
    });

    // Send resource usage every 5 seconds
    setInterval(() => {
        socket.emit('resourceUsage', getResourceUsage());
    }, 5000);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
