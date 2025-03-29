const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const socketIO = require('socket.io');

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
