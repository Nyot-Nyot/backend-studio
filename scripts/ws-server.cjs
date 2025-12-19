// WebSocket Development Server for Socket Programming Demonstration
// Usage: node scripts/ws-server.js
// Then connect from SocketConsole component

const WebSocket = require('ws');
const http = require('http');

const PORT = 3200;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store connected clients and their info
const clients = new Map();
let messageId = 1;

// Broadcast message to all connected clients
function broadcast(message, excludeClient = null) {
  const messageWithId = {
    ...message,
    id: messageId++,
    timestamp: Date.now()
  };
  
  wss.clients.forEach(client => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(messageWithId));
    }
  });
  
  console.log(`📡 Broadcast: ${message.type} to ${wss.clients.size} clients`);
}

// Handle new WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = `user_${Math.random().toString(36).substr(2, 9)}`;
  const clientInfo = {
    id: clientId,
    ip: req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    connectedAt: Date.now(),
    name: `User ${clientId.slice(-4)}`
  };
  
  clients.set(ws, clientInfo);
  console.log(`🔌 Client connected: ${clientInfo.name} (${clientInfo.ip})`);
  console.log(`👥 Total connections: ${wss.clients.size}`);

  // Send welcome message to new client
  ws.send(JSON.stringify({
    type: 'welcome',
    message: `Welcome ${clientInfo.name}! You are connected to Backend Studio WebSocket server.`,
    clientInfo,
    totalClients: wss.clients.size,
    timestamp: Date.now()
  }));

  // Broadcast user join to other clients
  broadcast({
    type: 'user_join',
    user: clientInfo,
    message: `${clientInfo.name} joined the chat`,
    totalClients: wss.clients.size
  }, ws);

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Message from ${clientInfo.name}: ${message.type}`);

      switch (message.type) {
        case 'chat_message':
          broadcast({
            type: 'chat_message',
            user: clientInfo,
            message: message.content,
            timestamp: Date.now()
          });
          break;
          
        case 'typing_start':
          broadcast({
            type: 'typing_start',
            user: clientInfo
          }, ws);
          break;
          
        case 'typing_stop':
          broadcast({
            type: 'typing_stop',
            user: clientInfo
          }, ws);
          break;
          
        case 'email_status_update':
          // Relay email status updates to demonstrate real-time integration
          broadcast({
            type: 'email_notification',
            user: clientInfo,
            emailData: message.data,
            message: `${clientInfo.name} sent an email: ${message.data.status}`
          });
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            latency: Date.now() - message.timestamp
          }));
          break;
          
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (e) {
      console.error('❌ Failed to parse message:', e);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });

  // Handle connection close
  ws.on('close', (code, reason) => {
    console.log(`🔚 Client disconnected: ${clientInfo.name} (${code} - ${reason})`);
    clients.delete(ws);
    
    // Broadcast user leave to remaining clients
    broadcast({
      type: 'user_leave',
      user: clientInfo,
      message: `${clientInfo.name} left the chat`,
      totalClients: wss.clients.size
    });
    
    console.log(`👥 Remaining connections: ${wss.clients.size}`);
  });

  // Handle connection errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${clientInfo.name}:`, error);
    clients.delete(ws);
  });
});

// Send periodic server stats
setInterval(() => {
  if (wss.clients.size > 0) {
    broadcast({
      type: 'server_stats',
      stats: {
        connectedClients: wss.clients.size,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  }
}, 30000); // Every 30 seconds

// Start server
server.listen(PORT, () => {
  console.log('🚀 WebSocket Server Started');
  console.log(`📡 Listening on ws://localhost:${PORT}`);
  console.log('🎯 Ready for Socket Programming demonstration');
  console.log('');
  console.log('Features available:');
  console.log('  • Real-time chat messaging');
  console.log('  • User join/leave notifications');
  console.log('  • Typing indicators');
  console.log('  • Email status broadcasting');
  console.log('  • Live connection stats');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  wss.clients.forEach(client => {
    client.send(JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down. Please reconnect later.',
      timestamp: Date.now()
    }));
    client.close(1001, 'Server shutdown');
  });
  server.close(() => {
    console.log('✅ WebSocket server stopped');
    process.exit(0);
  });
});