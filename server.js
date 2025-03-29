const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');
const { Telegraf } = require('telegraf');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const io = socketIO(server);

// ===== TELEGRAM BOT CONFIGURATION =====
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7653088503:AAGub7UiDHItedkfaH4SoAx2Rb60EbejIQs';
const bot = new Telegraf(BOT_TOKEN);

// Store admins and cloned servers
const admins = ['kingbadboi', 'kingkhalid246']; // Initial admins
const clonedServers = new Map(); // To store cloned server information

// Start command
bot.command('start', (ctx) => {
    ctx.reply('Welcome to the Website Cloning Bot! Use /help to see available commands.');
});

// Help command
bot.command('help', (ctx) => {
    const username = ctx.message.from.username;
    let helpText = `
Available commands:
/start - Start the bot
/help - Show this help message
/owner - Show owner information
`;

    // Add admin commands if user is an admin
    if (admins.includes(username)) {
        helpText += `
Admin commands:
/createserver - Clone the website and get a URL
/delete - Delete a cloned website
/listservers - List all cloned websites
/addadmin [username] - Add a new admin
/deleteadmin [username] - Remove an admin
`;
    }

    ctx.reply(helpText);
});

// Owner command
bot.command('owner', (ctx) => {
    ctx.reply('This bot is owned and managed by kingbadboi and kingkhalid246.');
});

// Create server command - Only for admins
bot.command('createserver', async (ctx) => {
    const username = ctx.message.from.username;
    
    if (!admins.includes(username)) {
        return ctx.reply('You do not have permission to use this command.');
    }
    
    // Generate a unique identifier for this clone
    const cloneId = Date.now().toString();
    const clonePort = 3001 + clonedServers.size; // Assign a unique port
    
    try {
        // Clone the website - this is a simplified example
        // In a real implementation, you might use Docker or other virtualization
        const cloneDir = path.join(os.tmpdir(), `clone_${cloneId}`);
        
        // Create clone directory and copy files
        fs.mkdirSync(cloneDir, { recursive: true });
        
        // Spawn a new server process for the clone
        const cloneProcess = spawn('node', ['server.js'], {
            env: { ...process.env, PORT: clonePort },
            cwd: cloneDir,
            detached: true
        });
        
        // Store clone information
        clonedServers.set(cloneId, {
            id: cloneId,
            port: clonePort,
            directory: cloneDir,
            createdBy: username,
            createdAt: new Date(),
            process: cloneProcess
        });
        
        const cloneUrl = `http://localhost:${clonePort}`;
        ctx.reply(`Server cloned successfully! Access it at: ${cloneUrl}\nClone ID: ${cloneId}`);
    } catch (error) {
        ctx.reply(`Failed to create server clone: ${error.message}`);
    }
});

// Delete clone command - Only for admins
bot.command('delete', async (ctx) => {
    const username = ctx.message.from.username;
    
    if (!admins.includes(username)) {
        return ctx.reply('You do not have permission to use this command.');
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Please provide a clone ID to delete. Usage: /delete [clone_id]');
    }
    
    const cloneId = args[1];
    if (!clonedServers.has(cloneId)) {
        return ctx.reply('Clone ID not found.');
    }
    
    try {
        const clone = clonedServers.get(cloneId);
        
        // Kill the process
        if (clone.process) {
            process.kill(-clone.process.pid); // Kill the process group
        }
        
        // Delete the directory
        fs.rmSync(clone.directory, { recursive: true, force: true });
        
        // Remove from the map
        clonedServers.delete(cloneId);
        
        ctx.reply(`Server clone ${cloneId} has been deleted successfully.`);
    } catch (error) {
        ctx.reply(`Failed to delete server clone: ${error.message}`);
    }
});

// List servers command - Only for admins
bot.command('listservers', (ctx) => {
    const username = ctx.message.from.username;
    
    if (!admins.includes(username)) {
        return ctx.reply('You do not have permission to use this command.');
    }
    
    if (clonedServers.size === 0) {
        return ctx.reply('No cloned servers found.');
    }
    
    let serverList = 'Cloned Servers:\n\n';
    
    clonedServers.forEach((clone, id) => {
        serverList += `ID: ${id}\n`;
        serverList += `URL: http://localhost:${clone.port}\n`;
        serverList += `Created by: ${clone.createdBy}\n`;
        serverList += `Created at: ${clone.createdAt.toISOString()}\n\n`;
    });
    
    ctx.reply(serverList);
});

// Add admin command - Only for admins
bot.command('addadmin', (ctx) => {
    const username = ctx.message.from.username;
    
    if (!admins.includes(username)) {
        return ctx.reply('You do not have permission to use this command.');
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Please provide a username to add as admin. Usage: /addadmin [username]');
    }
    
    const newAdmin = args[1].replace('@', ''); // Remove @ if included
    
    if (admins.includes(newAdmin)) {
        return ctx.reply(`${newAdmin} is already an admin.`);
    }
    
    admins.push(newAdmin);
    ctx.reply(`${newAdmin} has been added as an admin.`);
});

// Delete admin command - Only for admins
bot.command('deleteadmin', (ctx) => {
    const username = ctx.message.from.username;
    
    if (!admins.includes(username)) {
        return ctx.reply('You do not have permission to use this command.');
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Please provide a username to remove as admin. Usage: /deleteadmin [username]');
    }
    
    const adminToRemove = args[1].replace('@', ''); // Remove @ if included
    
    if (!admins.includes(adminToRemove)) {
        return ctx.reply(`${adminToRemove} is not an admin.`);
    }
    
    // Don't allow removing the main admins
    if (adminToRemove === 'kingbadboi' || adminToRemove === 'kingkhalid246') {
        return ctx.reply(`Cannot remove primary admin ${adminToRemove}.`);
    }
    
    const index = admins.indexOf(adminToRemove);
    admins.splice(index, 1);
    ctx.reply(`${adminToRemove} has been removed as an admin.`);
});

// List admins command - Only for admins
bot.command('listadmins', (ctx) => {
    const username = ctx.message.from.username;
    
    if (!admins.includes(username)) {
        return ctx.reply('You do not have permission to use this command.');
    }
    
    let adminList = 'Current Admins:\n';
    admins.forEach(admin => {
        adminList += `- ${admin}\n`;
    });
    
    ctx.reply(adminList);
});

// Start the bot
bot.launch().then(() => {
    console.log('Telegram bot started!');
}).catch(err => {
    console.error('Failed to start Telegram bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ===== END TELEGRAM BOT CONFIGURATION =====

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
        fs.readdir(filePath, (err, files) => {
          if (err) {
            socket.emit('log', `Failed to get file list ${err}`);
          }
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
        fs.writeFile(filename, content, (err) => {
            if (err) {
                socket.emit('log', `Failed to upload file: ${err}`);
            } else {
                socket.emit('log', `File ${filename} uploaded successfully`);
                socket.emit('listFiles'); // Refresh file list after upload
            }
        });
    });

    socket.on('deleteFile', (filename) => {
        //Delete from disk
        fs.unlink(filename, (err) => {
            if (err) {
                socket.emit('log', `Failed to delete file: ${err}`);
            } else {
                socket.emit('log', `File ${filename} deleted successfully`);
                socket.emit('listFiles'); //Refresh File List
            }
        });
    });

    socket.on('viewFile', (filename) => {
        //Read Content and send to client.
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) {
                socket.emit('log', `Failed to view file: ${err}`);
            } else {
                socket.emit('fileContent', data);
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
