const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');
const AdmZip = require('adm-zip');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');


const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const io = socketIO(server);
// Add these to the top of your server.js file with your other requires

// Add a simple in-memory user database (in a production app, use a real database)
const users = {};

// Add these before app.use(express.static(...))
app.use(bodyParser.json());
app.use(session({
    secret: 'Idowu@09876',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// User registration endpoint
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Check if username already exists
    if (users[username]) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Store the user
        users[username] = {
            username,
            password: hashedPassword,
            createdAt: new Date()
        };
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Check if user exists
    const user = users[username];
    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    try {
        // Compare password with hash
        const match = await bcrypt.compare(password, user.password);
        
        if (match) {
            // Set session data
            req.session.user = {
                username: user.username,
                loggedIn: true
            };
            
            res.json({ 
                message: 'Login successful',
                user: {
                    username: user.username
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
    if (req.session.user && req.session.user.loggedIn) {
        res.json({ 
            authenticated: true, 
            user: {
                username: req.session.user.username
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Add this to your io.on('connection') block to check user authentication
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user && session.user.loggedIn) {
        next();
    } else {
        next(new Error('Authentication required'));
    }
});

// Make sure express-socket.io-session is configured properly
const sessionMiddleware = session({
    secret: 'Idowu@09876',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});

app.use(sessionMiddleware);
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});
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

    // Send initial resource usage
    socket.emit('resourceUsage', getResourceUsage());

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

    socket.on('listFiles', () => {
        //Get the list of files.
        const filePath = process.cwd();
        fs.readdir(filePath, { withFileTypes: true }, (err, dirents) => {
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
        //Write content to disk.
        const { filename, content } = data;
        
        // Check if it's a zip file
        if (filename.toLowerCase().endsWith('.zip')) {
            // Save the zip file first
            fs.writeFile(filename, Buffer.from(content.split(',')[1], 'base64'), (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload zip file: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully`);
                    
                    // Create a unique extraction directory to prevent conflicts
                    const extractionDir = `extracted_${Date.now()}`;
                    fs.mkdirSync(extractionDir, { recursive: true });
                    
                    // Extract the zip file
                    try {
                        const zip = new AdmZip(filename);
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
            
            fs.writeFile(filename, fileContent, (err) => {
                if (err) {
                    socket.emit('log', `Failed to upload file: ${err}`);
                } else {
                    socket.emit('log', `File ${filename} uploaded successfully`);
                    socket.emit('listFiles'); // Refresh file list after upload
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
    socket.on('createFolder', (folderName) => {
        fs.mkdir(folderName, (err) => {
            if (err) {
                socket.emit('log', `Failed to create folder: ${err}`);
            } else {
                socket.emit('log', `Folder ${folderName} created successfully`);
                socket.emit('listFiles'); // Refresh file list
            }
        });
    });

    // New event handler for creating a new file
    socket.on('createFile', (data) => {
        const { filename, content } = data;
        fs.writeFile(filename, content || '', (err) => {
            if (err) {
                socket.emit('log', `Failed to create file: ${err}`);
            } else {
                socket.emit('log', `File ${filename} created successfully`);
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