'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Brain,
  Shield,
  Zap,
  Puzzle,
  Database,
  MessageSquare,
  BarChart3,
  HardDrive,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Hierarchical Memory',
    description:
      'Three-tier memory system with working, episodic, and semantic layers. The agent remembers context across conversations, automatically promotes important information between tiers, and retrieves relevant context using keyword matching with relevance scoring based on importance and access frequency.',
    tags: ['Cross-Session', 'Auto-Promotion', 'DB-Backed'],
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Shield,
    title: 'Security Scanning',
    description:
      'Real-time prompt injection detection with 8+ attack pattern recognition, input sanitization (XSS, injection prevention), and output validation (credential leak detection). All security events are logged with severity levels for full auditability.',
    tags: ['Injection Detection', 'Input Sanitization', 'Audit Logging'],
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Puzzle,
    title: 'Working Skills',
    description:
      'Skills that actually execute, not just metadata. Web search uses the real z-ai-web-dev-sdk to fetch live results. Image generation creates actual images. Summarizer and translator use the LLM gateway. Skills auto-trigger based on user intent detection — say "search for" or "translate to" and it just works.',
    tags: ['Auto-Trigger', 'Live Search', 'Image Gen', 'LLM-Powered'],
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Multi-LLM & Streaming',
    description:
      'Supports OpenAI, Anthropic, Google Gemini, and z-ai-web-dev-sdk with automatic failover. Users bring their own API keys. Responses stream in real-time via SSE (Server-Sent Events) with a blinking cursor. Select your preferred provider in the UI or let the gateway auto-failover.',
    tags: ['4 Providers', 'Auto-Failover', 'SSE Streaming', 'BYOK'],
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Database,
    title: 'Smart Memory Retrieval',
    description:
      'Keyword-based search across all memory tiers with custom relevance scoring. Results are ranked by a combination of content match quality, importance weight, and access frequency. Semantic entries receive a boost as they represent long-term learned knowledge.',
    tags: ['Keyword Search', 'Relevance Scoring', 'Auto-Rank'],
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: BarChart3,
    title: 'Response Analytics',
    description:
      'Users can rate every response with thumbs up/down. Ratings are stored per-message and linked to the prompt version that generated them. An analytics API provides average ratings per prompt version, daily breakdowns, and recent individual ratings — the foundation for data-driven prompt improvement.',
    tags: ['Ratings', 'Prompt A/B', 'Analytics API'],
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: HardDrive,
    title: 'Session History & Memory Browser',
    description:
      'Load previous conversations from the session history panel. Browse all stored memory entries (working/episodic/semantic) with search and type filtering. Everything persists in SQLite via Prisma — sessions, messages, memory, security logs, and prompt versions survive server restarts.',
    tags: ['Session History', 'Memory Search', 'SQLite', 'Prisma'],
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Zap,
    title: 'Multi-Platform Messaging',
    description:
      'Built-in adapter pattern supporting Telegram, Discord, and WhatsApp. Each platform has a dedicated adapter handling webhook verification, message parsing, and response delivery. The messaging gateway routes all platforms through the same agent engine for consistent behavior.',
    tags: ['Telegram', 'Discord', 'WhatsApp'],
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Built to <span className="text-emerald-400">Show Its Work</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Every feature listed here is built to be transparent and observable. Brain Frog
            makes every step of its reasoning visible.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {feature.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {feature.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] font-mono"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
