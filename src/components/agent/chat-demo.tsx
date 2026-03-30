'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Send,
  Bot,
  User,
  Shield,
  Loader2,
  Trash2,
  AlertTriangle,
  Brain,
  Sparkles,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  X,
  FileText,
  ImageIcon,
  History,
  Database,
  Search,
  ChevronDown,
  ChevronRight,
  Zap,
  GitBranch,
  Download,
  Eye,
  EyeOff,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Attachment {
  filename: string;
  mimeType: string;
  data: string;
  size: number;
}

interface ReActStep {
  type: 'thought' | 'action' | 'observation' | 'answer';
  content: string;
  tool?: string;
  toolInput?: string;
  duration?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  securityCheck?: { safe: boolean; risk: number };
  rating?: number;
  attachments?: Attachment[];
  isStreaming?: boolean;
  skillResults?: Array<{ skill: string; success: boolean; preview: string }>;
  reactSteps?: ReActStep[];
  tokens?: { prompt: number; completion: number };
  provider?: string;
  model?: string;
  stepCount?: number;
}

interface AgentStatus {
  status: string;
  config: {
    name: string;
    description: string;
    model: string;
    temperature: number;
    maxTokens: number;
    enableMemory: boolean;
    enableSkills: boolean;
    securityLevel: string;
  };
  memoryStats: { working: number; episodic: number; semantic: number; total: number };
  skills: Array<{ name: string; description: string; version: string }>;
  uptime: number;
  timestamp: string;
  llmProviders?: Array<{ name: string; model: string; priority: number }>;
}

interface SessionSummary {
  id: string;
  title: string;
  platform: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  accessCount: number;
  importance: number;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

const SUGGESTED_PROMPTS = [
  '🐸 Search for the latest breakthroughs in quantum computing',
  'What can you do? Show me your skills!',
  'Explain how neural networks learn, step by step.',
  'Help me brainstorm names for a tropical smoothie shop.',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ACCEPTED_TEXT = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf'];

export default function ChatDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session history
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  // Memory browser
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [showMemory, setShowMemory] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryFilter, setMemoryFilter] = useState('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    fetch('/api/agent/status')
      .then(r => r.json())
      .then(data => { if (data.status === 'healthy') setAgentStatus(data); })
      .catch(() => {});
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/sessions');
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch {}
  }, []);

  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/agent/sessions/${sid}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages.map((m: { id: string; role: string; content: string; timestamp: string; rating?: number }) => ({
          id: m.id,
          role: m.role as Message['role'],
          content: m.content,
          timestamp: m.timestamp,
          rating: m.rating,
        })));
        setSessionId(sid);
        setShowSessions(false);
        toast.success(`Loaded session with ${data.messages.length} messages`);
      }
    } catch {
      toast.error('Failed to load session');
    }
  }, []);

  const loadMemory = useCallback(async (search = '', type = '') => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      const res = await fetch(`/api/agent/memory?${params}`);
      const data = await res.json();
      if (data.entries) setMemoryEntries(data.entries);
    } catch {}
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds 10MB limit`);
        continue;
      }

      const isImage = ACCEPTED_IMAGES.includes(file.type);
      const isText = ACCEPTED_TEXT.includes(file.type);

      if (!isImage && !isText) {
        toast.error(`"${file.name}" is not a supported file type`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          filename: file.name,
          mimeType: file.type,
          data: base64,
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const rateMessage = async (messageId: string, rating: number) => {
    if (ratedIds.has(messageId)) return;
    setRatedIds(prev => new Set(prev).add(messageId));

    try {
      const res = await fetch('/api/agent/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, rating } : m));
        toast.success(rating >= 4 ? 'Thanks for the feedback!' : 'Feedback recorded.');
      } else {
        toast.error(data.error || 'Failed to rate');
        setRatedIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
      }
    } catch {
      toast.error('Failed to submit rating');
      setRatedIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() && attachments.length === 0) return;
    if (isLoading) return;

    const attachmentText = attachments.length > 0
      ? `\n\n[Attached: ${attachments.map(a => a.filename).join(', ')}]`
      : '';
    const fullContent = content.trim() + attachmentText;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: fullContent,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);
    setIsStreaming(false);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }]);

    try {
      const body: Record<string, unknown> = {
        message: content.trim(),
        sessionId,
        stream: true,
      };
      if (selectedProvider) body.provider = selectedProvider;
      if (attachments.length > 0) {
        body.attachment = attachments.map(a => ({
          filename: a.filename,
          mimeType: a.mimeType,
          data: a.data,
        }));
      }

      const response = await fetch('/api/agent/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      const reactSteps: ReActStep[] = [];
      let newSessionId = sessionId || '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);

            // Handle meta event
            if (parsed.type === 'meta') {
              if (parsed.sessionId && !newSessionId) {
                newSessionId = parsed.sessionId;
                setSessionId(parsed.sessionId);
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? {
                  ...m,
                  skillResults: parsed.skillResults || m.skillResults,
                  tokens: parsed.totalTokens || m.tokens,
                  provider: parsed.provider || m.provider,
                  model: parsed.model || m.model,
                  stepCount: parsed.stepCount || m.stepCount,
                } : m
              ));
              continue;
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            // Handle ReAct steps
            if (['thought', 'action', 'observation'].includes(parsed.type)) {
              const step: ReActStep = {
                type: parsed.type,
                content: parsed.content || '',
                tool: parsed.tool,
                toolInput: parsed.toolInput,
                duration: parsed.duration,
              };
              reactSteps.push(step);
              setIsStreaming(true);
              // Show reasoning panel by default for multi-step responses
              setShowReasoning(prev => ({ ...prev, [assistantId]: true }));
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, reactSteps: [...reactSteps], isStreaming: true } : m
              ));
              continue;
            }

            // Handle final answer content
            if (parsed.type === 'answer' || parsed.content) {
              const c = parsed.content || '';
              if (c) {
                accumulated += c;
                setIsStreaming(true);
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated, isStreaming: true } : m
                ));
              }
            }
          } catch (e) {
            if (data !== '[DONE]') { /* skip parse errors */ }
          }
        }
      }

      setIsStreaming(false);
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ));

      // Refresh status and sessions
      fetch('/api/agent/status')
        .then(r => r.json())
        .then(d => { if (d.status === 'healthy') setAgentStatus(d); })
        .catch(() => {});
      loadSessions();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Something went wrong';
      setMessages(prev => prev.filter(m => m.id !== assistantId));
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${errMsg}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClear = () => {
    setMessages([]);
    setSessionId(null);
    setRatedIds(new Set());
    setAttachments([]);
    toast.success('Chat cleared');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const getRiskColor = (risk: number) => {
    if (risk < 0.2) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (risk < 0.4) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const isImageFile = (mimeType: string) => ACCEPTED_IMAGES.includes(mimeType);

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const skillIcon = (skill: string) => {
    if (skill.includes('search')) return '🔍';
    if (skill.includes('image')) return '🎨';
    if (skill.includes('summar')) return '📝';
    if (skill.includes('translat')) return '🌐';
    return '⚡';
  };

  const exportConversation = () => {
    if (messages.length === 0) return;
    const md = messages.map(m => {
      const prefix = m.role === 'user' ? '**You**' : m.role === 'system' ? '⚠️ **System**' : '**Brain Frog**';
      let text = `${prefix}:\n${m.content}`;
      if (m.reactSteps && m.reactSteps.length > 0) {
        text = `${prefix}:\n\n<details><summary>🧠 Reasoning (${m.reactSteps.length} steps, ${(m.tokens?.prompt || 0) + (m.tokens?.completion || 0)} tokens)</summary>\n\n`;
        for (const s of m.reactSteps) {
          if (s.type === 'thought') text += `💭 *${s.content}*\n`;
          else if (s.type === 'action') text += `🔧 ${s.tool}(${s.toolInput || ''}) ${s.duration ? `(${s.duration}ms)` : ''}\n`;
          else if (s.type === 'observation') text += `👁️ ${s.content.substring(0, 300)}\n`;
        }
        text += '\n</details>\n\n' + m.content;
      }
      return text;
    }).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `brain-frog-chat-${new Date().toISOString().slice(0,10)}.md`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Conversation exported');
  };

  const branchConversation = async (messageId: string) => {
    if (!sessionId) { toast.error('No active session to branch'); return; }
    try {
      const res = await fetch('/api/agent/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messageId }),
      });
      const data = await res.json();
      if (data.success) {
        loadSession(data.newSessionId);
        toast.success(`Branched at message (${data.messageCount} messages copied)`);
      } else {
        toast.error(data.error || 'Failed to branch');
      }
    } catch {
      toast.error('Failed to branch conversation');
    }
  };

  return (
    <section id="demo" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Live Demo
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Try Brain Frog <span className="text-emerald-400">Right Now</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            No download required. Chat with Brain Frog directly in your browser and experience
            ReAct reasoning, visible tool execution, hierarchical memory, and streaming responses.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Chat Interface */}
          <Card className="flex flex-col h-[650px]">
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Brain Frog 🐸</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {agentStatus ? (
                        <span className="text-emerald-400">&#9679; Online</span>
                      ) : (
                        <span className="text-yellow-400">&#9679; Initializing...</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { loadSessions(); setShowSessions(!showSessions); }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Session history"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                  {messages.length > 0 && (
                    <>
                      <Button variant="ghost" size="sm" onClick={exportConversation} className="text-muted-foreground hover:text-foreground" title="Export conversation">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive" title="Clear chat">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Session History Dropdown */}
            {showSessions && (
              <div className="border-b flex-shrink-0 bg-muted/30 max-h-[200px] overflow-y-auto">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-muted-foreground">Recent Sessions</h4>
                    <button onClick={() => setShowSessions(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No previous sessions found.</p>
                  ) : (
                    <div className="space-y-1">
                      {sessions.map(s => (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                            sessionId === s.id
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{s.title}</span>
                            <span className="text-[10px] text-muted-foreground/60 ml-2 flex-shrink-0">{timeAgo(s.updatedAt)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {s.messageCount} messages &middot; {s.platform}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full px-4 py-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <Brain className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="font-semibold mb-2">Start a Conversation</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                      Try asking Brain Frog to search, translate, summarize, or just chat. Skills execute in real-time.
                    </p>
                    <div className="grid gap-2 w-full max-w-lg">
                      {SUGGESTED_PROMPTS.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(prompt)}
                          className="text-left text-sm px-4 py-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-200 text-muted-foreground hover:text-foreground"
                        >
                          &quot;{prompt}&quot;
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role !== 'user' && (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            msg.role === 'system' ? 'bg-red-500/10' : 'bg-emerald-500/10'
                          }`}>
                            {msg.role === 'system' ? (
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                            ) : (
                              <Bot className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                        )}
                        <div className={`max-w-[80%] group relative ${msg.role === 'user' ? 'order-first' : ''}`}>
                          {/* Skill results indicator */}
                          {msg.skillResults && msg.skillResults.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {msg.skillResults.map((sr, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={`text-[10px] gap-1 ${sr.success ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}
                                >
                                  <span>{skillIcon(sr.skill)}</span>
                                  <span className="font-mono">{sr.skill}</span>
                                  <span className={sr.success ? 'text-emerald-500' : 'text-red-500'}>
                                    {sr.success ? '✓' : '✗'}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Visible Reasoning Panel */}
                          {msg.reactSteps && msg.reactSteps.length > 0 && (
                            <div className="mb-2 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                              <button
                                onClick={() => setShowReasoning(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Lightbulb className="w-3 h-3 text-yellow-400" />
                                  <span className="font-medium">Reasoning ({msg.stepCount || msg.reactSteps.length} steps)</span>
                                  {msg.tokens && (
                                    <span className="text-[10px] text-muted-foreground/60">
                                      {((msg.tokens.prompt || 0) + (msg.tokens.completion || 0)).toLocaleString()} tokens
                                    </span>
                                  )}
                                  {msg.provider && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                                      {msg.provider}
                                    </Badge>
                                  )}
                                </span>
                                {showReasoning[msg.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                              {showReasoning[msg.id] && (
                                <div className="px-3 pb-2 space-y-1.5 border-t border-border/30">
                                  {msg.reactSteps.map((step, idx) => (
                                    <div key={idx} className="text-[11px] py-1">
                                      {step.type === 'thought' && (
                                        <div className="flex items-start gap-1.5">
                                          <span className="text-yellow-400 flex-shrink-0 mt-px">💭</span>
                                          <span className="text-muted-foreground italic">{step.content}</span>
                                        </div>
                                      )}
                                      {step.type === 'action' && (
                                        <div className="flex items-start gap-1.5">
                                          <span className="text-blue-400 flex-shrink-0 mt-px">🔧</span>
                                          <div>
                                            <span className="font-mono text-blue-400">{step.tool}</span>
                                            <span className="text-muted-foreground">({step.toolInput?.substring(0, 80)}{step.toolInput && step.toolInput.length > 80 ? '...' : ''})</span>
                                            {step.duration && (
                                              <span className="text-muted-foreground/50 ml-1">{step.duration}ms</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {step.type === 'observation' && (
                                        <div className="flex items-start gap-1.5">
                                          <span className="text-emerald-400 flex-shrink-0 mt-px">👁️</span>
                                          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded px-1.5 py-1 max-h-[120px] overflow-y-auto">
                                            {step.content.substring(0, 500)}{step.content.length > 500 ? '\n...' : ''}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Image attachments */}
                          {msg.attachments?.filter(a => isImageFile(a.mimeType)).map((att, idx) => (
                            <div key={idx} className="mb-2 rounded-lg overflow-hidden border border-border max-w-xs">
                              <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.filename} className="max-h-48 object-contain bg-muted" />
                            </div>
                          ))}
                          {/* File attachments */}
                          {msg.attachments?.filter(a => !isImageFile(a.mimeType)).map((att, idx) => (
                            <div key={idx} className="mb-1 flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1 max-w-xs">
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{att.filename}</span>
                              <span className="text-[10px] flex-shrink-0">{formatFileSize(att.size)}</span>
                            </div>
                          ))}

                          <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : msg.role === 'system'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-muted prose prose-sm dark:prose-invert max-w-none'
                          }`}>
                            {msg.role === 'assistant' ? (
                              msg.content ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content}
                                </ReactMarkdown>
                              ) : msg.isStreaming ? (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Thinking
                                </span>
                              ) : null
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                            {/* Streaming cursor */}
                            {msg.isStreaming && msg.content.length > 0 && (
                              <span className="inline-block w-0.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                          </div>

                          {/* User avatar */}
                          {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 ml-auto">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                          )}

                          {/* Branch button on user messages */}
                          {msg.role === 'user' && (
                            <div className="mt-1.5 px-1">
                              <button
                                onClick={() => branchConversation(msg.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-400"
                                title="Branch from this message"
                              >
                                <GitBranch className="w-3 h-3" /> Fork here
                              </button>
                            </div>
                          )}

                          {/* Message actions */}
                          <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap">
                            {msg.securityCheck && !msg.securityCheck.safe && (
                              <Badge variant="outline" className={`text-[10px] ${getRiskColor(msg.securityCheck.risk)}`}>
                                <Shield className="w-3 h-3 mr-1" />
                                Security Risk: {(msg.securityCheck.risk * 100).toFixed(0)}%
                              </Badge>
                            )}
                            {msg.role === 'assistant' && !msg.isStreaming && msg.content.length > 0 && (
                              <>
                                <button
                                  onClick={() => copyToClipboard(msg.content, msg.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => rateMessage(msg.id, 5)}
                                    className={`p-1 rounded transition-colors ${
                                      msg.rating === 5 ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground hover:text-emerald-400'
                                    }`}
                                    disabled={ratedIds.has(msg.id) && msg.rating !== 5}
                                    title="Good response"
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => rateMessage(msg.id, 1)}
                                    className={`p-1 rounded transition-colors ${
                                      msg.rating === 1 ? 'text-red-400 bg-red-500/10' : 'text-muted-foreground hover:text-red-400'
                                    }`}
                                    disabled={ratedIds.has(msg.id) && msg.rating !== 1}
                                    title="Bad response"
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {msg.rating && (
                                  <span className={`text-[10px] ${msg.rating >= 4 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {msg.rating >= 4 ? '👍' : '👎'} Rated
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>

            <div className="border-t flex-shrink-0">
              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="px-4 pt-2 flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 text-xs max-w-[200px]">
                      {isImageFile(att.mimeType) ? (
                        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate text-muted-foreground">{att.filename}</span>
                      <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{formatFileSize(att.size)}</span>
                      <button onClick={() => removeAttachment(idx)} className="text-muted-foreground hover:text-foreground ml-0.5 flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={[...ACCEPTED_IMAGES, ...ACCEPTED_TEXT].join(',')}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    title="Attach file (max 10MB)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message... (Shift+Enter for new line)"
                    className="min-h-[44px] max-h-[120px] resize-none flex-1"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="default"
                    disabled={isLoading || (!input.trim() && attachments.length === 0)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                  >
                    {isLoading && !isStreaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </Card>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Agent Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" /> Agent Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentStatus ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{agentStatus.memoryStats.total}</p>
                        <p className="text-xs text-muted-foreground">Memory Items</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{agentStatus.skills.length}</p>
                        <p className="text-xs text-muted-foreground">Active Skills</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Working Memory</span>
                        <span>{agentStatus.memoryStats.working}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Episodic Memory</span>
                        <span>{agentStatus.memoryStats.episodic}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Semantic Memory</span>
                        <span>{agentStatus.memoryStats.semantic}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Temperature</span>
                        <span>{agentStatus.config.temperature}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Max Tokens</span>
                        <span>{agentStatus.config.maxTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Uptime</span>
                        <span>{formatUptime(agentStatus.uptime)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Loading status...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> Security Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="border-emerald-500/20 bg-emerald-500/5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <AlertDescription className="text-xs text-emerald-300">
                    All security layers active. Prompt injection detection, input sanitization,
                    and output validation are running in real-time.
                  </AlertDescription>
                </Alert>
                <div className="mt-3 space-y-1.5">
                  {['Prompt Injection Firewall', 'Input Sanitization', 'Output Validation', 'Audit Logging'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* LLM Provider */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">🐸 Choose Your Frog Brain</CardTitle>
              </CardHeader>
              <CardContent>
                {agentStatus?.llmProviders && agentStatus.llmProviders.length > 0 ? (
                  <div className="space-y-2">
                    {agentStatus.llmProviders.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setSelectedProvider(selectedProvider === p.name ? null : p.name)}
                        className={`w-full text-left flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors ${
                          selectedProvider === p.name
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedProvider === p.name ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                        <span className="font-mono">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">{p.model}</span>
                      </button>
                    ))}
                    {selectedProvider && (
                      <button onClick={() => setSelectedProvider(null)} className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center py-0.5">
                        Reset to auto
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No external providers configured. Using default.</p>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" /> ReAct Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {agentStatus?.skills.map((skill) => (
                    <Badge key={skill.name} variant="outline" className="text-[10px] font-mono">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Brain Frog reasons step-by-step and decides which tools to use. No special syntax needed.
                </p>
              </CardContent>
            </Card>

            {/* Session Token Counter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  📊 Token Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const totals = messages.reduce((acc, m) => {
                    if (m.tokens) {
                      acc.prompt += m.tokens.prompt || 0;
                      acc.completion += m.tokens.completion || 0;
                    }
                    return acc;
                  }, { prompt: 0, completion: 0 });
                  const total = totals.prompt + totals.completion;
                  return (
                    <div className="space-y-2">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">{total.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Tokens</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="text-sm font-mono font-medium">{totals.prompt.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Prompt</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="text-sm font-mono font-medium">{totals.completion.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Completion</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Messages</span>
                          <span>{messages.length}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">ReAct Steps</span>
                          <span>{messages.reduce((a, m) => a + (m.reactSteps?.length || 0), 0)}</span>
                        </div>
                      </div>
                      {total > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 text-center">
                          ~${(total / 1000 * 0.015).toFixed(4)} @ GPT-4o rate
                        </p>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Memory Browser */}
            <Card>
              <CardHeader className="pb-3">
                <button
                  onClick={() => { if (!showMemory) loadMemory(memorySearch, memoryFilter); setShowMemory(!showMemory); }}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" /> Memory Browser
                  </CardTitle>
                  {showMemory ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CardHeader>
              {showMemory && (
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        className="pl-7 h-7 text-xs"
                        placeholder="Search memory..."
                        value={memorySearch}
                        onChange={(e) => { setMemorySearch(e.target.value); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') loadMemory(memorySearch, memoryFilter); }}
                      />
                    </div>
                    <select
                      className="h-7 text-xs border rounded-md bg-background px-2 text-muted-foreground"
                      value={memoryFilter}
                      onChange={(e) => { setMemoryFilter(e.target.value); loadMemory(memorySearch, e.target.value); }}
                    >
                      <option value="">All types</option>
                      <option value="working">Working</option>
                      <option value="episodic">Episodic</option>
                      <option value="semantic">Semantic</option>
                    </select>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                    {memoryEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No memory entries found.</p>
                    ) : (
                      memoryEntries.slice(0, 20).map(entry => (
                        <div key={entry.id} className="bg-muted/50 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                              {entry.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/60">{timeAgo(entry.updatedAt)}</span>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-[11px]">{entry.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  {memoryEntries.length > 20 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Showing 20 of {memoryEntries.length} entries
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
