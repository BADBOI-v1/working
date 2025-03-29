const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

// Telegram bot configuration
const token = process.env.TELEGRAM_BOT_TOKEN || '7653088503:AAGub7UiDHItedkfaH4SoAx2Rb60EbejIQs'; // Replace with your bot token or use environment variable
const bot = new TelegramBot(token, { polling: true });

// Admin users
const admins = ['kingbadboi', 'kingkhalid246'];
let clonedServers = []; // Store cloned server information

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

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

// Telegram Bot Commands Implementation
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to the Website Management Bot! Type /help to see available commands.');
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
Available commands:
/start - Start the bot
/help - Show this help message
/owner - Show owner information
/createserver - Clone the website (admin only)
/delete - Delete a cloned website (admin only)
/listservers - List all cloned websites
/addadmin [username] - Add an admin (admin only)
/deleteadmin [username] - Delete an admin (admin only)
/listadmin - List all admins
`;
    bot.sendMessage(chatId, helpMessage);
});

bot.onText(/\/owner/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'This bot is owned and managed by kingbadboi and kingkhalid246.');
});

// Function to check if user is an admin
function isAdmin(username) {
    return admins.includes(username);
}

bot.onText(/\/createserver/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    
    if (!isAdmin(username)) {
        bot.sendMessage(chatId, 'You are not authorized to use this command.');
        return;
    }
    
    // Create a unique identifier for the cloned server
    const serverId = Date.now().toString();
    const serverPort = 3001 + clonedServers.length; // Assign a port
    
    // Simulate creating a cloned server
    const serverUrl = `https://clone-${serverId}.example.com:${serverPort}`;
    
    clonedServers.push({
        id: serverId,
        url: serverUrl,
        createdBy: username,
        createdAt: new Date().toISOString()
    });
    
    bot.sendMessage(chatId, `Server cloned successfully! Your clone URL is: ${serverUrl}`);
});

bot.onText(/\/delete (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const serverId = match[1];
    
    if (!isAdmin(username)) {
        bot.sendMessage(chatId, 'You are not authorized to use this command.');
        return;
    }
    
    const serverIndex = clonedServers.findIndex(server => server.id === serverId);
    
    if (serverIndex === -1) {
        bot.sendMessage(chatId, 'Server not found. Use /listservers to see available servers.');
        return;
    }
    
    clonedServers.splice(serverIndex, 1);
    bot.sendMessage(chatId, `Server ${serverId} has been deleted successfully.`);
});

bot.onText(/\/listservers/, (msg) => {
    const chatId = msg.chat.id;
    
    if (clonedServers.length === 0) {
        bot.sendMessage(chatId, 'No cloned servers available.');
        return;
    }
    
    let serversList = 'Cloned Servers:\n';
    clonedServers.forEach((server, index) => {
        serversList += `${index + 1}. ID: ${server.id}\n   URL: ${server.url}\n   Created by: ${server.createdBy}\n   Created at: ${server.createdAt}\n\n`;
    });
    
    bot.sendMessage(chatId, serversList);
});

bot.onText(/\/addadmin (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const newAdminUsername = match[1];
    
    if (!isAdmin(username)) {
        bot.sendMessage(chatId, 'You are not authorized to use this command.');
        return;
    }
    
    if (admins.includes(newAdminUsername)) {
        bot.sendMessage(chatId, `${newAdminUsername} is already an admin.`);
        return;
    }
    
    admins.push(newAdminUsername);
    bot.sendMessage(chatId, `${newAdminUsername} has been added as an admin.`);
});

bot.onText(/\/deleteadmin (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const adminToDelete = match[1];
    
    if (!isAdmin(username)) {
        bot.sendMessage(chatId, 'You are not authorized to use this command.');
        return;
    }
    
    if (adminToDelete === 'kingbadboi' || adminToDelete === 'kingkhalid246') {
        bot.sendMessage(chatId, 'Cannot delete primary admins.');
        return;
    }
    
    const adminIndex = admins.indexOf(adminToDelete);
    
    if (adminIndex === -1) {
        bot.sendMessage(chatId, `${adminToDelete} is not an admin.`);
        return;
    }
    
    admins.splice(adminIndex, 1);
    bot.sendMessage(chatId, `${adminToDelete} has been removed from admins.`);
});

bot.onText(/\/listadmin/, (msg) => {
    const chatId = msg.chat.id;
    
    let adminsList = 'Admin Users:\n';
    admins.forEach((admin, index) => {
        adminsList += `${index + 1}. ${admin}\n`;
    });
    
    bot.sendMessage(chatId, adminsList);
});

// Handle any errors
bot.on('polling_error', (error) => {
  console.error('Telegram Bot polling error:', error);
});

// Socket.io Implementation (Existing Code)
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
