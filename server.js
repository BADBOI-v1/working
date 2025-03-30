const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');
const AdmZip = require('adm-zip');

const app = express();
const port = process.env.PORT || 3000;

// Create persistent storage directories
const STORAGE_DIR = path.join(__dirname, 'persistent_storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const EXTRACTED_DIR = path.join(STORAGE_DIR, 'extracted');
const DEPLOYED_DIR = path.join(STORAGE_DIR, 'deployed');

// Ensure storage directories exist
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(EXTRACTED_DIR)) fs.mkdirSync(EXTRACTED_DIR, { recursive: true });
if (!fs.existsSync(DEPLOYED_DIR)) fs.mkdirSync(DEPLOYED_DIR, { recursive: true });

// Store running process information to manage them across restarts
const PROCESS_INFO_FILE = path.join(STORAGE_DIR, 'running_processes.json');

// Initialize the running processes tracker
let runningProcesses = [];
if (fs.existsSync(PROCESS_INFO_FILE)) {
    try {
        runningProcesses = JSON.parse(fs.readFileSync(PROCESS_INFO_FILE, 'utf8'));
        console.log('Loaded previous process information:', runningProcesses);
    } catch (err) {
        console.error('Error loading process information:', err);
    }
}

// Save process information to file
function saveProcessInfo() {
    fs.writeFileSync(PROCESS_INFO_FILE, JSON.stringify(runningProcesses, null, 2));
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/persistent', express.static(STORAGE_DIR)); // Expose persistent storage via HTTP

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Attempt to restart any previously running processes
    restartSavedProcesses();
});

// Function to restart saved processes
function restartSavedProcesses() {
    runningProcesses.forEach(processInfo => {
        if (processInfo.active && fs.existsSync(processInfo.path)) {
            console.log(`Attempting to restart: ${processInfo.name} at ${processInfo.path}`);
            try {
                process.chdir(processInfo.path);
                const child = spawn('npm', ['start'], { 
                    detached: true,
                    stdio: 'ignore' 
                });
                child.unref();
                processInfo.pid = child.pid;
                process.chdir(__dirname); // Return to original directory
            } catch (err) {
                console.error(`Failed to restart ${processInfo.name}:`, err);
            }
        }
    });
    saveProcessInfo();
}

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

// Function to copy directory content recursively
function copyDirRecursive(src, dest) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    // Read source directory content
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            // Recursively copy subdirectories
            copyDirRecursive(srcPath, destPath);
        } else {
            // Copy files
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Function to deploy a Node.js application
function deployNodeApp(projectPath, appName, socket) {
    socket.emit('deploymentStatus', `Starting deployment from: ${projectPath}`);
    
    // Create a persistent copy of the project
    const timestamp = Date.now();
    const persistentPath = path.join(DEPLOYED_DIR, `${appName}_${timestamp}`);
    
    try {
        // Copy the project to the persistent directory
        copyDirRecursive(projectPath, persistentPath);
        socket.emit('deploymentStatus', `Created persistent copy at: ${persistentPath}`);
        
        // Change to the persistent project directory
        process.chdir(persistentPath);
        
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
                    const child = spawn('npm', ['start'], { 
                        detached: true,
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    
                    // Store process information for future restarts
                    const processInfo = {
                        name: appName,
                        pid: child.pid,
                        path: persistentPath,
                        packageJson: packageJson,
                        timestamp: timestamp,
                        active: true
                    };
                    
                    runningProcesses.push(processInfo);
                    saveProcessInfo();
                    
                    child.stdout.on('data', (data) => {
                        socket.emit('deploymentStatus', `App output: ${data.toString()}`);
                    });
                    
                    child.stderr.on('data', (data) => {
                        socket.emit('deploymentStatus', `App error: ${data.toString()}`);
                    });
                    
                    child.on('close', (code) => {
                        socket.emit('deploymentStatus', `Application exited with code ${code}`);
                        // Update process status
                        const index = runningProcesses.findIndex(p => p.pid === child.pid);
                        if (index !== -1) {
                            runningProcesses[index].active = false;
                            saveProcessInfo();
                        }
                    });
                    
                    // Detach the child process so it can run independently
                    child.unref();
                    
                    socket.emit('deploymentStatus', 'Application deployed successfully!');
                    socket.emit('deploymentStatus', `Access your app through its exposed port (check app logs for details)`);
                } else {
                    socket.emit('deploymentStatus', 'No start script found in package.json');
                }
            } catch (err) {
                socket.emit('deploymentStatus', `Error reading package.json: ${err.message}`);
            }
            
            // Change back to original directory
            process.chdir(__dirname);
        });
    } catch (err) {
        socket.emit('deploymentStatus', `Error creating persistent copy: ${err.message}`);
        process.chdir(__dirname); // Make sure we return to original directory
    }
}

io.on('connection', (socket) => {
    console.log('Client connected');

    // Send initial resource usage
    socket.emit('resourceUsage', getResourceUsage());

    // Send initial running processes list
    socket.emit('runningProcesses', runningProcesses.filter(p => p.active));

    socket.on('command', (command) => {
      const child = spawn(command, { shell: true });

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

    socket.on('listFiles', (directory = null) => {
        //Get the list of files.
        const filePath = directory || process.cwd();
        fs.readdir(filePath, { withFileTypes: true }, (err, dirents) => {
          if (err) {
            socket.emit('log', `Failed to get file list ${err}`);
            return;
          }
          
          // Create array with file info including type (file or directory)
          const files = dirents.map(dirent => {
            return {
              name: dirent.name,
              isDirectory: dirent.isDirectory(),
              path: path.join(filePath, dirent.name)
            };
          });
          
          socket.emit('fileList', { files, currentPath: filePath });
        });
    });

    socket.on('getMyPath', () => {
      const filePath = process.cwd();
      socket.emit('log', `Current Path: ${filePath}`);
    });

    socket.on('stopServer', () => {
        process.exit(0);
    });

    socket.on('uploadFile', (data) => {
        let { filename, content } = data;
        let fileDestination = path.join(UPLOADS_DIR, filename);
        
        // Check if it's a zip file
        if (filename.toLowerCase().endsWith('.zip')) {
            // Save the zip file first
            fs.writeFile(fileDestination, Buffer.from(content.split(',')[1], 'base64'), (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload zip file: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully to ${fileDestination}`);
                    
                    // Create a unique extraction directory to prevent conflicts
                    const timestamp = Date.now();
                    const appName = path.basename(filename, '.zip');
                    const extractionDir = path.join(EXTRACTED_DIR, `${appName}_${timestamp}`);
                    fs.mkdirSync(extractionDir, { recursive: true });
                    
                    // Extract the zip file
                    try {
                        const zip = new AdmZip(fileDestination);
                        zip.extractAllTo(extractionDir, true);
                        socket.emit('log', `Extracted zip file ${filename} to ${extractionDir} successfully`);
                        
                        // Look for package.json in the extracted directory
                        const packageJsonDir = findPackageJson(extractionDir);
                        
                        if (packageJsonDir) {
                            socket.emit('log', `Found Node.js project at: ${packageJsonDir}`);
                            
                            // Auto deploy the application with a meaningful name
                            deployNodeApp(packageJsonDir, appName, socket);
                        } else {
                            socket.emit('log', 'No Node.js project found in the uploaded zip file');
                        }
                    } catch (err) {
                        socket.emit('log', `Failed to extract zip file: ${err}`);
                    }
                    
                    socket.emit('listFiles', UPLOADS_DIR); // Refresh file list after upload and extraction
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
            
            fs.writeFile(fileDestination, fileContent, (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload file: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully to ${fileDestination}`);
                    socket.emit('listFiles', UPLOADS_DIR); // Refresh file list after upload
                }
            });
        }
    });

    socket.on('deleteFile', (filename) => {
        //Delete from disk
        fs.stat(filename, (err, stats) => {
            if (err) {
                socket.emit('log', `Failed to get file stats: ${err}`);
                return;
            }
            
            if (stats.isDirectory()) {
                // Remove directory and its contents
                fs.rm(filename, { recursive: true }, (err) => {
                    if (err) {
                        socket.emit('log', `Failed to delete directory: ${err}`);
                    } else {
                        socket.emit('log', `Directory ${filename} deleted successfully`);
                        socket.emit('listFiles'); // Refresh file list
                    }
                });
            } else {
                // Remove file
                fs.unlink(filename, (err) => {
                    if (err) {
                        socket.emit('log', `Failed to delete file: ${err}`);
                    } else {
                        socket.emit('log', `File ${filename} deleted successfully`);
                        socket.emit('listFiles'); // Refresh file list
                    }
                });
            }
        });
    });

    socket.on('viewFile', (filename) => {
        //Read Content and send to client.
        fs.stat(filename, (err, stats) => {
            if (err) {
                socket.emit('log', `Failed to get file stats: ${err}`);
                return;
            }
            
            if (stats.isDirectory()) {
                socket.emit('log', `Cannot view content of directory ${filename}`);
            } else {
                fs.readFile(filename, 'utf8', (err, data) => {
                    if (err) {
                        socket.emit('log', `Failed to view file: ${err}`);
                    } else {
                        socket.emit('fileContent', data);
                    }
                });
            }
        });
    });

    // New event handler for creating a new folder
    socket.on('createFolder', (data) => {
        const { folderName, path: targetPath } = data;
        const fullPath = path.join(targetPath || process.cwd(), folderName);
        
        fs.mkdir(fullPath, { recursive: true }, (err) => {
            if (err) {
                socket.emit('log', `Failed to create folder: ${err}`);
            } else {
                socket.emit('log', `Folder ${fullPath} created successfully`);
                socket.emit('listFiles', targetPath || process.cwd()); // Refresh file list
            }
        });
    });

    // New event handler for creating a new file
    socket.on('createFile', (data) => {
        const { filename, content, path: targetPath } = data;
        const fullPath = path.join(targetPath || process.cwd(), filename);
        
        fs.writeFile(fullPath, content || '', (err) => {
            if (err) {
                socket.emit('log', `Failed to create file: ${err}`);
            } else {
                socket.emit('log', `File ${fullPath} created successfully`);
                socket.emit('listFiles', targetPath || process.cwd()); // Refresh file list
            }
        });
    });

    // New event handler for stopping a running process
    socket.on('stopProcess', (pid) => {
        try {
            process.kill(pid);
            const index = runningProcesses.findIndex(p => p.pid === pid);
            if (index !== -1) {
                runningProcesses[index].active = false;
                saveProcessInfo();
                socket.emit('log', `Process ${pid} stopped successfully`);
                socket.emit('runningProcesses', runningProcesses.filter(p => p.active));
            } else {
                socket.emit('log', `Process ${pid} not found in tracking list`);
            }
        } catch (err) {
            socket.emit('log', `Failed to stop process ${pid}: ${err.message}`);
        }
    });

    // New event handler for restarting a deployed application
    socket.on('restartApp', (appPath) => {
        try {
            if (fs.existsSync(appPath)) {
                process.chdir(appPath);
                socket.emit('log', `Restarting application at ${appPath}`);
                
                const child = spawn('npm', ['start'], { 
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                
                child.stdout.on('data', (data) => {
                    socket.emit('log', `App output: ${data.toString()}`);
                });
                
                child.stderr.on('data', (data) => {
                    socket.emit('log', `App error: ${data.toString()}`);
                });
                
                // Add to running processes
                const appName = path.basename(appPath);
                const processInfo = {
                    name: appName,
                    pid: child.pid,
                    path: appPath,
                    timestamp: Date.now(),
                    active: true
                };
                
                runningProcesses.push(processInfo);
                saveProcessInfo();
                
                child.unref();
                process.chdir(__dirname); // Return to original directory
                
                socket.emit('log', `Application restarted with PID ${child.pid}`);
                socket.emit('runningProcesses', runningProcesses.filter(p => p.active));
            } else {
                socket.emit('log', `Application path ${appPath} does not exist`);
            }
        } catch (err) {
            socket.emit('log', `Failed to restart application: ${err.message}`);
            process.chdir(__dirname); // Make sure we return to original directory
        }
    });

    // New endpoint to navigate to a directory
    socket.on('navigateToDir', (dirPath) => {
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
            socket.emit('listFiles', dirPath);
        } else {
            socket.emit('log', `Directory ${dirPath} does not exist`);
        }
    });

    // Send resource usage every 5 seconds
    setInterval(() => {
        socket.emit('resourceUsage', getResourceUsage());
    }, 5000);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Handle application shutdown gracefully
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    saveProcessInfo();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    saveProcessInfo();
    process.exit(0);
});
