import React, { useState, useEffect } from 'react';
import { Mail, Send, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, User, Calendar, Zap, Terminal, Sparkles, Globe, Settings } from 'lucide-react';
import { EmailMessage, validateEmail } from '../services/emailService';
import { sendRealEmail, EmailJSConfig } from '../services/realEmailService';

interface EmailConsoleProps {
  emailJSConfig: EmailJSConfig;
  emailJSReady: boolean;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const EmailConsole: React.FC<EmailConsoleProps> = ({ emailJSConfig, emailJSReady, addToast }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [outbox, setOutbox] = useState<EmailMessage[]>([]);
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [emailMode, setEmailMode] = useState<'mock' | 'real'>('mock');

  // Load initial outbox data
  useEffect(() => {
    const loadOutbox = () => {
      const stored = localStorage.getItem('api_sim_email_outbox');
      if (stored) {
        setOutbox(JSON.parse(stored));
      }
    };

    loadOutbox();
  }, []);

  // Set up event listener for real-time email status updates
  useEffect(() => {
    const handleStatusUpdate = (event: CustomEvent) => {
      const stored = localStorage.getItem('api_sim_email_outbox');
      if (stored) {
        setOutbox(JSON.parse(stored));
      }
    };

    window.addEventListener('emailStatusUpdate', handleStatusUpdate as EventListener);
    return () => window.removeEventListener('emailStatusUpdate', handleStatusUpdate as EventListener);
  }, []);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      addToast('Please fill in all fields', 'error');
      return;
    }

    if (!validateEmail(to)) {
      addToast('Please enter a valid email address', 'error');
      return;
    }

    if (emailMode === 'real' && !emailJSReady) {
      addToast('EmailJS is not configured. Please configure it in Settings first.', 'error');
      return;
    }

    setSending(true);
    try {
      if (emailMode === 'real') {
        // Send real email via EmailJS
        const result = await sendRealEmail(
          { to, subject, body, fromName: 'Backend Studio' },
          emailJSConfig
        );

        if (result.success) {
          // Clear form
          setTo('');
          setSubject('');
          setBody('');
          
          addToast(`Real email sent successfully! Message ID: ${result.messageId}`, 'success');
        } else {
          addToast(`Failed to send real email: ${result.error}`, 'error');
        }
      } else {
        // Send mock email (existing logic)
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, body })
        });

        if (response.ok) {
          // Clear form
          setTo('');
          setSubject('');
          setBody('');
          
          // Reload outbox
          const stored = localStorage.getItem('api_sim_email_outbox');
          if (stored) {
            setOutbox(JSON.parse(stored));
          }
          
          addToast('Mock email sent successfully!', 'success');
        } else {
          const error = await response.json();
          addToast(`Failed to send email: ${error.error}`, 'error');
        }
      }
    } catch (error) {
      addToast(`Network error: ${error}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleTrace = (messageId: string) => {
    setExpandedTraces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: EmailMessage['status']) => {
    switch (status) {
      case 'queued': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'sending': return <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: EmailMessage['status']) => {
    switch (status) {
      case 'queued': return 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100';
      case 'sending': return 'bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-700 border-yellow-200 shadow-yellow-100 animate-pulse';
      case 'delivered': return 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200 shadow-green-100';
      case 'failed': return 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200 shadow-red-100';
    }
  };

  const getEmailAvatar = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Email Console</h2>
            <p className="text-slate-600 text-sm">Send and track emails with SMTP simulation</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Email Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setEmailMode('mock')}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                emailMode === 'mock' 
                ? 'bg-white text-slate-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Mock
            </button>
            <button
              onClick={() => setEmailMode('real')}
              disabled={!emailJSReady}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                emailMode === 'real' 
                ? 'bg-white text-slate-700 shadow-sm' 
                : emailJSReady 
                  ? 'text-slate-500 hover:text-slate-700'
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Real
            </button>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            {emailMode === 'mock' ? (
              <>
                <Terminal className="w-4 h-4" />
                <span>SMTP Simulation</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                <span className={emailJSReady ? "text-green-600" : "text-red-600"}>
                  {emailJSReady ? "EmailJS Ready" : "EmailJS Not Configured"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Send Email Form */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-3xl opacity-30 -translate-y-16 translate-x-16"></div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              Compose Email
            </h3>
            
            {/* Mode indicator */}
            <div className="flex items-center gap-2">
              {emailMode === 'real' && !emailJSReady && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configure EmailJS in Settings</span>
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                emailMode === 'mock' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-green-100 text-green-700'
              }`}>
                {emailMode === 'mock' ? (
                  <>
                    <Terminal className="w-3.5 h-3.5" />
                    Mock Mode
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    Real Mode
                  </>
                )}
              </div>
            </div>
          </div>
        
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-slate-700 gap-2">
                  <User className="w-4 h-4" />
                  To
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-slate-700 gap-2">
                  <Mail className="w-4 h-4" />
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-slate-700 gap-2">
                <Terminal className="w-4 h-4" />
                Message
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your email content here..."
                rows={6}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all bg-white shadow-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSend}
                disabled={sending || !to || !subject || !body}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 disabled:transform-none min-w-[180px]"
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Outbox */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <div className="p-2 bg-slate-200 rounded-lg">
                <Mail className="w-5 h-5 text-slate-600" />
              </div>
              Outbox
            </h3>
            <div className="flex items-center gap-2 text-slate-600">
              <div className="bg-slate-200 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {outbox.length}
              </div>
              <span className="text-sm">messages</span>
            </div>
          </div>
        </div>
        
        {outbox.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-lg font-medium mb-2">No emails sent yet</p>
            <p className="text-slate-400 text-sm">Send your first email using the form above</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {outbox.map(message => (
              <div key={message.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {getEmailAvatar(message.to)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-slate-800 truncate">{message.subject}</h4>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm ${getStatusColor(message.status)} flex items-center gap-1.5`}>
                        {getStatusIcon(message.status)}
                        <span className="capitalize">{message.status}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{message.to}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {message.body}
                    </div>

                    {/* Protocol Trace */}
                    <button
                      onClick={() => toggleTrace(message.id)}
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-all"
                    >
                      {expandedTraces.has(message.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Terminal className="w-4 h-4" />
                      SMTP Protocol Trace ({message.trace.length} steps)
                    </button>

                    {expandedTraces.has(message.id) && (
                      <div className="mt-3 bg-slate-900 rounded-xl p-4 text-xs font-mono text-green-400 max-h-64 overflow-y-auto border border-slate-700 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2 text-green-300 mb-3 border-b border-slate-700 pb-2">
                          <Terminal className="w-4 h-4" />
                          <span className="font-bold">SMTP Session Log</span>
                        </div>
                        {message.trace.map((line, idx) => (
                          <div key={idx} className="py-1 hover:bg-slate-800 px-2 rounded transition-colors">
                            <span className="text-slate-500 mr-3">#{idx + 1}</span>
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};