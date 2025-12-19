import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Wifi, WifiOff, Users, Clock, Zap, Globe, AlertCircle } from 'lucide-react';

// WebSocket server configuration
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3200';

interface Message {
  id: number;
  type: string;
  user?: {
    id: string;
    name: string;
  };
  message: string;
  timestamp: number;
}

interface ClientInfo {
  id: string;
  ip: string;
  userAgent: string;
  connectedAt: number;
  name: string;
}

interface ServerStats {
  connectedClients: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

interface SocketConsoleProps {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SocketConsole: React.FC<SocketConsoleProps> = ({ addToast }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [totalClients, setTotalClients] = useState(0);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Clear typing timeout to prevent memory leaks
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Close WebSocket connection to prevent memory leaks
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [ws]);

  const connect = () => {
    if (connected || connecting) return;
    
    setConnecting(true);
    addToast('Connecting to WebSocket server...', 'info');
    
    try {
      const websocket = new WebSocket(WEBSOCKET_URL);
      
      websocket.onopen = () => {
        setWs(websocket);
        setConnected(true);
        setConnecting(false);
        addToast('Connected to WebSocket server!', 'success');
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'welcome':
              setClientInfo(data.clientInfo);
              setTotalClients(data.totalClients);
              addMessage(data);
              break;
              
            case 'chat_message':
              addMessage(data);
              break;
              
            case 'user_join':
            case 'user_leave':
              setTotalClients(data.totalClients);
              addMessage(data);
              break;
              
            case 'typing_start':
              setTypingUsers(prev => new Set([...prev, data.user.name]));
              break;
              
            case 'typing_stop':
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.user.name);
                return newSet;
              });
              break;
              
            case 'email_notification':
              addMessage(data);
              addToast(`Email update from ${data.user.name}: ${data.emailData.status}`, 'info');
              break;
              
            case 'server_stats':
              setServerStats(data.stats);
              break;
              
            case 'pong':
              if (import.meta.env?.DEV) {
                console.log('Pong received:', data);
              }
              
              const now = Date.now();
              const originalTime = data.originalTimestamp;
              
              if (typeof originalTime === 'number' && originalTime > 0) {
                const latency = now - originalTime;
                addToast(`Ping: ${latency}ms`, 'info');
              } else {
                console.error('Invalid pong data:', data);
                addToast('Ping failed: invalid response', 'error');
              }
              break;
              
            case 'server_shutdown':
              addToast('Server is shutting down', 'error');
              addMessage(data);
              break;
              
            default:
              addMessage(data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
      
      websocket.onclose = () => {
        setWs(null);
        setConnected(false);
        setConnecting(false);
        setTypingUsers(new Set());
        addToast('Disconnected from WebSocket server', 'error');
      };
      
      websocket.onerror = () => {
        setConnecting(false);
        addToast('WebSocket connection failed. Make sure server is running on port 3200', 'error');
      };
      
    } catch (e) {
      setConnecting(false);
      addToast('Failed to connect: ' + e, 'error');
    }
  };

  const disconnect = () => {
    if (ws) {
      ws.close(1000, 'User disconnect');
      setWs(null);
      setConnected(false);
    }
  };

  const addMessage = (data: any) => {
    const newMessage: Message = {
      id: data.id || Date.now(),
      type: data.type,
      user: data.user,
      message: data.message,
      timestamp: data.timestamp || Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = () => {
    if (!ws || !inputMessage.trim()) return;
    
    const message = {
      type: 'chat_message',
      content: inputMessage.trim(),
      timestamp: Date.now()
    };
    
    ws.send(JSON.stringify(message));
    setInputMessage('');
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    ws.send(JSON.stringify({ type: 'typing_stop' }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    
    if (!ws || !connected) return;
    
    // Send typing indicator
    ws.send(JSON.stringify({ type: 'typing_start' }));
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      ws.send(JSON.stringify({ type: 'typing_stop' }));
    }, 2000);
  };

  const sendPing = () => {
    if (!ws) return;
    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user_join': return '👋';
      case 'user_leave': return '👋';
      case 'email_notification': return '📧';
      case 'server_shutdown': return '🛑';
      case 'welcome': return '🎉';
      default: return '💬';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl shadow-lg">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Socket Console</h2>
            <p className="text-slate-600 text-sm">Real-time WebSocket communication demo</p>
          </div>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            <span>{totalClients} connected</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${
            connected 
            ? 'bg-green-100 text-green-700' 
            : connecting 
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>
              {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Messages */}
        <div className="lg:col-span-2 bg-white rounded-2xl border shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Live Chat
            </h3>
          </div>
          
          <div className="h-96 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3">
                <div className="text-lg">{getMessageIcon(msg.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    {msg.user && <span className="font-bold">{msg.user.name}</span>}
                    <span>{formatTime(msg.timestamp)}</span>
                    <span className="uppercase text-xs px-1.5 py-0.5 bg-slate-200 rounded">
                      {msg.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-slate-800">{msg.message}</div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicators */}
            {typingUsers.size > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span>{Array.from(typingUsers).join(', ')} typing...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message Input */}
          <div className="border-t p-4">
            {!connected ? (
              <button
                onClick={connect}
                disabled={connecting}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Connect to WebSocket
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connection Info */}
        <div className="space-y-4">
          {/* Client Info */}
          {clientInfo && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Your Info
              </h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {clientInfo.name}</div>
                <div><span className="font-medium">ID:</span> {clientInfo.id}</div>
                <div><span className="font-medium">Connected:</span> {formatTime(clientInfo.connectedAt)}</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="bg-white rounded-xl border p-4">
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Controls
            </h4>
            <div className="space-y-2">
              <button
                onClick={sendPing}
                disabled={!connected}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 rounded-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Ping Server
              </button>
              <button
                onClick={disconnect}
                disabled={!connected}
                className="w-full py-2 px-4 bg-red-100 hover:bg-red-200 disabled:bg-slate-50 text-red-700 rounded-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                <WifiOff className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>

          {/* Server Stats */}
          {serverStats && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Server Stats
              </h4>
              <div className="space-y-2 text-xs">
                <div>Connected: {serverStats.connectedClients}</div>
                <div>Uptime: {Math.round(serverStats.uptime)}s</div>
                <div>Memory: {Math.round(serverStats.memory.heapUsed / 1024 / 1024)}MB</div>
              </div>
            </div>
          )}

          {/* Setup Instructions */}
          {!connected && !connecting && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Setup Required
              </h4>
              <div className="text-sm text-amber-800 space-y-2">
                <p>To use WebSocket features:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Open terminal</li>
                  <li>Run: <code className="bg-amber-100 px-1 rounded">node scripts/ws-server.cjs</code></li>
                  <li>Click "Connect to WebSocket"</li>
                </ol>
                <p className="text-xs mt-2">
                  Connecting to: <code className="bg-amber-100 px-1 rounded">{WEBSOCKET_URL}</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};