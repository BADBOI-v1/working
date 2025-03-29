const socket = io();

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Main UI elements
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
  const serverStatus = document.getElementById('server-status');

  // File management elements
  const fileUpload = document.getElementById('file-upload');
  const uploadButton = document.getElementById('upload-button');
  const fileListSelect = document.getElementById('file-list');
  const deleteButton = document.getElementById('delete-button');
  const viewButton = document.getElementById('view-button');
  const fileContent = document.getElementById('file-content');
  const fileName = document.getElementById('file-name');
  const copyButton = document.getElementById('copy-button');

  // Command input events - prevent form submission
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent form submission
      const command = commandInput.value;
      if (command.trim()) {
        socket.emit('command', command);
        addLogEntry(`[CMD] ${command}`);
        commandInput.value = '';
      }
    });
  }

  // Allow Enter key to submit command but prevent form submission
  if (commandInput) {
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        if (sendButton) sendButton.click();
      }
    });
  }

  // Action button events - prevent default behavior
  if (filesButton) {
    filesButton.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('listFiles');
      addLogEntry('[INFO] Requesting file list...');
    });
  }

  if (myPathButton) {
    myPathButton.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('getMyPath');
      addLogEntry('[INFO] Requesting current path...');
    });
  }

  if (stopButton) {
    stopButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to stop the server?')) {
        socket.emit('stopServer');
        addLogEntry('[WARN] Server shutdown initiated');
        
        // Update server status indicator
        if (serverStatus) {
          serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500 mr-2"></span>Shutting down...';
        }
      }
    });
  }

  // File management events with preventDefault
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile && fileName) {
        fileName.textContent = selectedFile.name;
      } else if (fileName) {
        fileName.textContent = 'No file chosen';
      }
    });
  }

  if (uploadButton) {
    uploadButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileUpload || !fileUpload.files[0]) {
        showNotification('Please select a file to upload', 'red');
        return;
      }
      
      const file = fileUpload.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        socket.emit('uploadFile', { filename: file.name, content: e.target.result });
        addLogEntry(`[INFO] Uploading file: ${file.name}`);
        
        // Show upload notification
        showNotification(`Uploading ${file.name}...`, 'blue');
      };
      reader.readAsText(file);
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileListSelect || !fileListSelect.value) {
        showNotification('Please select a file to delete', 'red');
        return;
      }
      
      const filename = fileListSelect.value;
      if (confirm(`Are you sure you want to delete ${filename}?`)) {
        socket.emit('deleteFile', filename);
        addLogEntry(`[WARN] Deleting file: ${filename}`);
      }
    });
  }

  if (viewButton) {
    viewButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileListSelect || !fileListSelect.value) {
        showNotification('Please select a file to view', 'red');
        return;
      }
      
      const filename = fileListSelect.value;
      socket.emit('viewFile', filename);
      addLogEntry(`[INFO] Viewing file: ${filename}`);
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      const textarea = document.getElementById('file-content');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        showNotification('Copied to clipboard!', 'green');
      }
    });
  }

  // Socket events
  socket.on('resourceUsage', (data) => {
    // Update text values
    if (cpuUsage) cpuUsage.textContent = data.cpu;
    if (ramUsage) ramUsage.textContent = data.ram;
    if (diskUsage) diskUsage.textContent = data.disk;
    if (uptime) uptime.textContent = data.uptime;
    
    // Update progress bars
    const cpuBar = document.querySelector('.glass-effect:nth-child(1) .bg-red-500');
    const ramBar = document.querySelector('.glass-effect:nth-child(2) .bg-red-500');
    const diskBar = document.querySelector('.glass-effect:nth-child(3) .bg-red-500');
    
    if (cpuBar && ramBar && diskBar) {
      // Extract numeric values for progress bars
      const cpuValue = parseFloat(data.cpu);
      const ramValue = parseFloat(data.ram);
      const diskValue = parseFloat(data.disk);
      
      // Set progress bar widths
      cpuBar.style.width = `${cpuValue}%`;
      
      // Calculate RAM percentage (assuming 6GB total)
      const totalRam = 6;
      const ramPercentage = (ramValue / totalRam) * 100;
      ramBar.style.width = `${ramPercentage}%`;
      
      // Calculate disk percentage (assuming 500GB total)
      const totalDisk = 500;
      const diskPercentage = (diskValue / totalDisk) * 100;
      diskBar.style.width = `${diskPercentage}%`;
      
      // Add pulse animation to CPU if high
      if (cpuValue > 80) {
        cpuBar.classList.add('pulse-alert');
      } else {
        cpuBar.classList.remove('pulse-alert');
      }
    }
  });

  socket.on('log', (message) => {
    addLogEntry(message);
  });

  socket.on('fileList', (files) => {
    // Clear and update fileList select box
    if (!fileListSelect) return;
    
    fileListSelect.innerHTML = '<option value="">-- Select a file --</option>';
    
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file;
      fileListSelect.appendChild(option);
    });
    
    showNotification('File list updated', 'green');
  });

  socket.on('fileContent', (content) => {
    if (fileContent) fileContent.value = content;
  });

  socket.on('connect', () => {
    if (serverStatus) {
      serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-green-500 mr-2 pulse-alert"></span>System Active';
    }
    addLogEntry('[INFO] Connected to server');
  });

  socket.on('disconnect', () => {
    if (serverStatus) {
      serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500 mr-2"></span>Disconnected';
    }
    addLogEntry('[ERROR] Connection lost');
  });

  // Helper functions
  function addLogEntry(message) {
    if (!logDisplay) return;
    
    const now = new Date();
    const timeString = now.toISOString().replace('T', ' ').substring(0, 19);
    
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-1';
    
    // Add color coding based on message type
    if (message.includes('[ERROR]')) {
      logEntry.innerHTML = `<span class="text-red-500">${message}</span> <span class="text-gray-400">${timeString}</span>`;
    } else if (message.includes('[WARN]')) {
      logEntry.innerHTML = `<span class="text-yellow-400">${message}</span> <span class="text-gray-400">${timeString}</span>`;
    } else {
      logEntry.innerHTML = `${message} <span class="text-gray-400">${timeString}</span>`;
    }
    
    logDisplay.appendChild(logEntry);
    
    // Only scroll if user is already at bottom
    const isAtBottom = logDisplay.scrollHeight - logDisplay.clientHeight <= logDisplay.scrollTop + 50;
    if (isAtBottom) {
      logDisplay.scrollTop = logDisplay.scrollHeight;
    }
  }

  function showNotification(message, color = 'blue') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300`;
    
    // Set color based on type
    if (color === 'red') {
      notification.classList.add('bg-red-500', 'text-white');
    } else if (color === 'green') {
      notification.classList.add('bg-green-500', 'text-white');
    } else {
      notification.classList.add('bg-blue-500', 'text-white');
    }
    
    document.body.appendChild(notification);
    
    // Fade out and remove after delay
    setTimeout(() => {
      notification.classList.add('opacity-0');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initial connection setup
  addLogEntry('[INFO] Initializing connection...');

  // Clear demo interval if it exists (from the HTML demo)
  if (window.demoInterval) {
    clearInterval(window.demoInterval);
  }
});const socket = io();

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Main UI elements
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
  const serverStatus = document.getElementById('server-status');

  // File management elements
  const fileUpload = document.getElementById('file-upload');
  const uploadButton = document.getElementById('upload-button');
  const fileListSelect = document.getElementById('file-list');
  const deleteButton = document.getElementById('delete-button');
  const viewButton = document.getElementById('view-button');
  const fileContent = document.getElementById('file-content');
  const fileName = document.getElementById('file-name');
  const copyButton = document.getElementById('copy-button');

  // Command input events - prevent form submission
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent form submission
      const command = commandInput.value;
      if (command.trim()) {
        socket.emit('command', command);
        addLogEntry(`[CMD] ${command}`);
        commandInput.value = '';
      }
    });
  }

  // Allow Enter key to submit command but prevent form submission
  if (commandInput) {
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        if (sendButton) sendButton.click();
      }
    });
  }

  // Action button events - prevent default behavior
  if (filesButton) {
    filesButton.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('listFiles');
      addLogEntry('[INFO] Requesting file list...');
    });
  }

  if (myPathButton) {
    myPathButton.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('getMyPath');
      addLogEntry('[INFO] Requesting current path...');
    });
  }

  if (stopButton) {
    stopButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to stop the server?')) {
        socket.emit('stopServer');
        addLogEntry('[WARN] Server shutdown initiated');
        
        // Update server status indicator
        if (serverStatus) {
          serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500 mr-2"></span>Shutting down...';
        }
      }
    });
  }

  // File management events with preventDefault
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile && fileName) {
        fileName.textContent = selectedFile.name;
      } else if (fileName) {
        fileName.textContent = 'No file chosen';
      }
    });
  }

  if (uploadButton) {
    uploadButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileUpload || !fileUpload.files[0]) {
        showNotification('Please select a file to upload', 'red');
        return;
      }
      
      const file = fileUpload.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        socket.emit('uploadFile', { filename: file.name, content: e.target.result });
        addLogEntry(`[INFO] Uploading file: ${file.name}`);
        
        // Show upload notification
        showNotification(`Uploading ${file.name}...`, 'blue');
      };
      reader.readAsText(file);
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileListSelect || !fileListSelect.value) {
        showNotification('Please select a file to delete', 'red');
        return;
      }
      
      const filename = fileListSelect.value;
      if (confirm(`Are you sure you want to delete ${filename}?`)) {
        socket.emit('deleteFile', filename);
        addLogEntry(`[WARN] Deleting file: ${filename}`);
      }
    });
  }

  if (viewButton) {
    viewButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileListSelect || !fileListSelect.value) {
        showNotification('Please select a file to view', 'red');
        return;
      }
      
      const filename = fileListSelect.value;
      socket.emit('viewFile', filename);
      addLogEntry(`[INFO] Viewing file: ${filename}`);
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      const textarea = document.getElementById('file-content');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        showNotification('Copied to clipboard!', 'green');
      }
    });
  }

  // Socket events
  socket.on('resourceUsage', (data) => {
    // Update text values
    if (cpuUsage) cpuUsage.textContent = data.cpu;
    if (ramUsage) ramUsage.textContent = data.ram;
    if (diskUsage) diskUsage.textContent = data.disk;
    if (uptime) uptime.textContent = data.uptime;
    
    // Update progress bars
    const cpuBar = document.querySelector('.glass-effect:nth-child(1) .bg-red-500');
    const ramBar = document.querySelector('.glass-effect:nth-child(2) .bg-red-500');
    const diskBar = document.querySelector('.glass-effect:nth-child(3) .bg-red-500');
    
    if (cpuBar && ramBar && diskBar) {
      // Extract numeric values for progress bars
      const cpuValue = parseFloat(data.cpu);
      const ramValue = parseFloat(data.ram);
      const diskValue = parseFloat(data.disk);
      
      // Set progress bar widths
      cpuBar.style.width = `${cpuValue}%`;
      
      // Calculate RAM percentage (assuming 6GB total)
      const totalRam = 6;
      const ramPercentage = (ramValue / totalRam) * 100;
      ramBar.style.width = `${ramPercentage}%`;
      
      // Calculate disk percentage (assuming 500GB total)
      const totalDisk = 500;
      const diskPercentage = (diskValue / totalDisk) * 100;
      diskBar.style.width = `${diskPercentage}%`;
      
      // Add pulse animation to CPU if high
      if (cpuValue > 80) {
        cpuBar.classList.add('pulse-alert');
      } else {
        cpuBar.classList.remove('pulse-alert');
      }
    }
  });

  socket.on('log', (message) => {
    addLogEntry(message);
  });

  socket.on('fileList', (files) => {
    // Clear and update fileList select box
    if (!fileListSelect) return;
    
    fileListSelect.innerHTML = '<option value="">-- Select a file --</option>';
    
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file;
      fileListSelect.appendChild(option);
    });
    
    showNotification('File list updated', 'green');
  });

  socket.on('fileContent', (content) => {
    if (fileContent) fileContent.value = content;
  });

  socket.on('connect', () => {
    if (serverStatus) {
      serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-green-500 mr-2 pulse-alert"></span>System Active';
    }
    addLogEntry('[INFO] Connected to server');
  });

  socket.on('disconnect', () => {
    if (serverStatus) {
      serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500 mr-2"></span>Disconnected';
    }
    addLogEntry('[ERROR] Connection lost');
  });

  // Helper functions
  function addLogEntry(message) {
    if (!logDisplay) return;
    
    const now = new Date();
    const timeString = now.toISOString().replace('T', ' ').substring(0, 19);
    
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-1';
    
    // Add color coding based on message type
    if (message.includes('[ERROR]')) {
      logEntry.innerHTML = `<span class="text-red-500">${message}</span> <span class="text-gray-400">${timeString}</span>`;
    } else if (message.includes('[WARN]')) {
      logEntry.innerHTML = `<span class="text-yellow-400">${message}</span> <span class="text-gray-400">${timeString}</span>`;
    } else {
      logEntry.innerHTML = `${message} <span class="text-gray-400">${timeString}</span>`;
    }
    
    logDisplay.appendChild(logEntry);
    
    // Only scroll if user is already at bottom
    const isAtBottom = logDisplay.scrollHeight - logDisplay.clientHeight <= logDisplay.scrollTop + 50;
    if (isAtBottom) {
      logDisplay.scrollTop = logDisplay.scrollHeight;
    }
  }

  function showNotification(message, color = 'blue') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300`;
    
    // Set color based on type
    if (color === 'red') {
      notification.classList.add('bg-red-500', 'text-white');
    } else if (color === 'green') {
      notification.classList.add('bg-green-500', 'text-white');
    } else {
      notification.classList.add('bg-blue-500', 'text-white');
    }
    
    document.body.appendChild(notification);
    
    // Fade out and remove after delay
    setTimeout(() => {
      notification.classList.add('opacity-0');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initial connection setup
  addLogEntry('[INFO] Initializing connection...');

  // Clear demo interval if it exists (from the HTML demo)
  if (window.demoInterval) {
    clearInterval(window.demoInterval);
  }
});const socket = io();

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Main UI elements
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
  const serverStatus = document.getElementById('server-status');

  // File management elements
  const fileUpload = document.getElementById('file-upload');
  const uploadButton = document.getElementById('upload-button');
  const fileListSelect = document.getElementById('file-list');
  const deleteButton = document.getElementById('delete-button');
  const viewButton = document.getElementById('view-button');
  const fileContent = document.getElementById('file-content');
  const fileName = document.getElementById('file-name');
  const copyButton = document.getElementById('copy-button');

  // Command input events - prevent form submission
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent form submission
      const command = commandInput.value;
      if (command.trim()) {
        socket.emit('command', command);
        addLogEntry(`[CMD] ${command}`);
        commandInput.value = '';
      }
    });
  }

  // Allow Enter key to submit command but prevent form submission
  if (commandInput) {
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        if (sendButton) sendButton.click();
      }
    });
  }

  // Action button events - prevent default behavior
  if (filesButton) {
    filesButton.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('listFiles');
      addLogEntry('[INFO] Requesting file list...');
    });
  }

  if (myPathButton) {
    myPathButton.addEventListener('click', (e) => {
      e.preventDefault();
      socket.emit('getMyPath');
      addLogEntry('[INFO] Requesting current path...');
    });
  }

  if (stopButton) {
    stopButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to stop the server?')) {
        socket.emit('stopServer');
        addLogEntry('[WARN] Server shutdown initiated');
        
        // Update server status indicator
        if (serverStatus) {
          serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500 mr-2"></span>Shutting down...';
        }
      }
    });
  }

  // File management events with preventDefault
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile && fileName) {
        fileName.textContent = selectedFile.name;
      } else if (fileName) {
        fileName.textContent = 'No file chosen';
      }
    });
  }

  if (uploadButton) {
    uploadButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileUpload || !fileUpload.files[0]) {
        showNotification('Please select a file to upload', 'red');
        return;
      }
      
      const file = fileUpload.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        socket.emit('uploadFile', { filename: file.name, content: e.target.result });
        addLogEntry(`[INFO] Uploading file: ${file.name}`);
        
        // Show upload notification
        showNotification(`Uploading ${file.name}...`, 'blue');
      };
      reader.readAsText(file);
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileListSelect || !fileListSelect.value) {
        showNotification('Please select a file to delete', 'red');
        return;
      }
      
      const filename = fileListSelect.value;
      if (confirm(`Are you sure you want to delete ${filename}?`)) {
        socket.emit('deleteFile', filename);
        addLogEntry(`[WARN] Deleting file: ${filename}`);
      }
    });
  }

  if (viewButton) {
    viewButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!fileListSelect || !fileListSelect.value) {
        showNotification('Please select a file to view', 'red');
        return;
      }
      
      const filename = fileListSelect.value;
      socket.emit('viewFile', filename);
      addLogEntry(`[INFO] Viewing file: ${filename}`);
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      const textarea = document.getElementById('file-content');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        showNotification('Copied to clipboard!', 'green');
      }
    });
  }

  // Socket events
  socket.on('resourceUsage', (data) => {
    // Update text values
    if (cpuUsage) cpuUsage.textContent = data.cpu;
    if (ramUsage) ramUsage.textContent = data.ram;
    if (diskUsage) diskUsage.textContent = data.disk;
    if (uptime) uptime.textContent = data.uptime;
    
    // Update progress bars
    const cpuBar = document.querySelector('.glass-effect:nth-child(1) .bg-red-500');
    const ramBar = document.querySelector('.glass-effect:nth-child(2) .bg-red-500');
    const diskBar = document.querySelector('.glass-effect:nth-child(3) .bg-red-500');
    
    if (cpuBar && ramBar && diskBar) {
      // Extract numeric values for progress bars
      const cpuValue = parseFloat(data.cpu);
      const ramValue = parseFloat(data.ram);
      const diskValue = parseFloat(data.disk);
      
      // Set progress bar widths
      cpuBar.style.width = `${cpuValue}%`;
      
      // Calculate RAM percentage (assuming 6GB total)
      const totalRam = 6;
      const ramPercentage = (ramValue / totalRam) * 100;
      ramBar.style.width = `${ramPercentage}%`;
      
      // Calculate disk percentage (assuming 500GB total)
      const totalDisk = 500;
      const diskPercentage = (diskValue / totalDisk) * 100;
      diskBar.style.width = `${diskPercentage}%`;
      
      // Add pulse animation to CPU if high
      if (cpuValue > 80) {
        cpuBar.classList.add('pulse-alert');
      } else {
        cpuBar.classList.remove('pulse-alert');
      }
    }
  });

  socket.on('log', (message) => {
    addLogEntry(message);
  });

  socket.on('fileList', (files) => {
    // Clear and update fileList select box
    if (!fileListSelect) return;
    
    fileListSelect.innerHTML = '<option value="">-- Select a file --</option>';
    
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file;
      fileListSelect.appendChild(option);
    });
    
    showNotification('File list updated', 'green');
  });

  socket.on('fileContent', (content) => {
    if (fileContent) fileContent.value = content;
  });

  socket.on('connect', () => {
    if (serverStatus) {
      serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-green-500 mr-2 pulse-alert"></span>System Active';
    }
    addLogEntry('[INFO] Connected to server');
  });

  socket.on('disconnect', () => {
    if (serverStatus) {
      serverStatus.innerHTML = '<span class="h-2 w-2 rounded-full bg-red-500 mr-2"></span>Disconnected';
    }
    addLogEntry('[ERROR] Connection lost');
  });

  // Helper functions
  function addLogEntry(message) {
    if (!logDisplay) return;
    
    const now = new Date();
    const timeString = now.toISOString().replace('T', ' ').substring(0, 19);
    
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-1';
    
    // Add color coding based on message type
    if (message.includes('[ERROR]')) {
      logEntry.innerHTML = `<span class="text-red-500">${message}</span> <span class="text-gray-400">${timeString}</span>`;
    } else if (message.includes('[WARN]')) {
      logEntry.innerHTML = `<span class="text-yellow-400">${message}</span> <span class="text-gray-400">${timeString}</span>`;
    } else {
      logEntry.innerHTML = `${message} <span class="text-gray-400">${timeString}</span>`;
    }
    
    logDisplay.appendChild(logEntry);
    
    // Only scroll if user is already at bottom
    const isAtBottom = logDisplay.scrollHeight - logDisplay.clientHeight <= logDisplay.scrollTop + 50;
    if (isAtBottom) {
      logDisplay.scrollTop = logDisplay.scrollHeight;
    }
  }

  function showNotification(message, color = 'blue') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300`;
    
    // Set color based on type
    if (color === 'red') {
      notification.classList.add('bg-red-500', 'text-white');
    } else if (color === 'green') {
      notification.classList.add('bg-green-500', 'text-white');
    } else {
      notification.classList.add('bg-blue-500', 'text-white');
    }
    
    document.body.appendChild(notification);
    
    // Fade out and remove after delay
    setTimeout(() => {
      notification.classList.add('opacity-0');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initial connection setup
  addLogEntry('[INFO] Initializing connection...');

  // Clear demo interval if it exists (from the HTML demo)
  if (window.demoInterval) {
    clearInterval(window.demoInterval);
  }
});
