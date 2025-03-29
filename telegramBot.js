// telegramBot.js
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Telegram bot configuration
const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN'; // Replace with your bot token or use environment variable
const bot = new TelegramBot(token, { 
    polling: {
        interval: 300,
        params: {
            timeout: 10
        },
        autoStart: true,
    },
    filepath: false // Disable file downloading
});

// Store data in JSON files
const DATA_DIR = path.join(__dirname, 'data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const SERVERS_FILE = path.join(DATA_DIR, 'clonedServers.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load or initialize admins
let admins = ['kingbadboi', 'kingkhalid246']; // Default admins
try {
    if (fs.existsSync(ADMINS_FILE)) {
        const data = fs.readFileSync(ADMINS_FILE, 'utf8');
        const loadedAdmins = JSON.parse(data);
        // Always ensure default admins are included
        if (Array.isArray(loadedAdmins)) {
            loadedAdmins.forEach(admin => {
                if (!admins.includes(admin)) {
                    admins.push(admin);
                }
            });
        }
    }
    // Save initial admins file if it doesn't exist
    else {
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins), 'utf8');
    }
} catch (error) {
    console.error('Error loading admins:', error);
}

// Load or initialize cloned servers
let clonedServers = []; // Store cloned server information
try {
    if (fs.existsSync(SERVERS_FILE)) {
        const data = fs.readFileSync(SERVERS_FILE, 'utf8');
        const loadedServers = JSON.parse(data);
        if (Array.isArray(loadedServers)) {
            clonedServers = loadedServers;
        }
    } else {
        fs.writeFileSync(SERVERS_FILE, JSON.stringify([]), 'utf8');
    }
} catch (error) {
    console.error('Error loading cloned servers:', error);
}

// Helper function to save data
function saveData() {
    try {
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins), 'utf8');
        fs.writeFileSync(SERVERS_FILE, JSON.stringify(clonedServers), 'utf8');
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Function to check if user is an admin
function isAdmin(username) {
    return admins.includes(username);
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
/delete [serverId] - Delete a cloned website (admin only)
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
    
    saveData(); // Save the updated server list
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
    saveData(); // Save the updated server list
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
    saveData(); // Save the updated admin list
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
    saveData(); // Save the updated admin list
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

// Handle any errors and implement graceful error recovery
bot.on('polling_error', (error) => {
    console.error('Telegram Bot polling error:', error);
    
    // Wait for a moment before trying to restart polling
    setTimeout(() => {
        if (!bot.isPolling()) {
            console.log('Attempting to restart Telegram bot polling...');
            bot.startPolling();
        }
    }, 5000);
});

// Implement a healthcheck function to ensure the bot is running properly
function checkBotHealth() {
    if (!bot.isPolling()) {
        console.log('Bot polling stopped, attempting to restart...');
        bot.startPolling();
    }
}

// Check bot health every minute
setInterval(checkBotHealth, 60000);

console.log('Telegram bot started successfully!');

module.exports = bot;
