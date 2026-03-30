'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Blocks } from 'lucide-react';

const architectureComponents = [
  {
    name: 'Web Dashboard & API',
    description: 'Next.js 16 application serving both the interactive dashboard and REST API endpoints. The dashboard includes a live chat demo, real-time agent status, and security monitoring. API routes handle chat, ratings, analytics, prompt versioning, and security logging.',
    details: 'Built with Next.js App Router, React Server Components for static sections, and client components for interactive features like the chat interface. API routes use standard Next.js route handlers.',
  },
  {
    name: 'Agent Runtime',
    description: 'The core execution engine that processes user messages through a pipeline: Input Sanitization → Prompt Injection Detection → Memory Retrieval → LLM Call → Output Validation → Response. Each stage is independently testable.',
    details: 'Manages conversation sessions via SQLite, caches sessions in memory for performance, and stores all messages persistently. Security events are logged both in-memory and to the database.',
  },
  {
    name: 'Persistent Memory System',
    description: 'Hierarchical three-tier memory backed by SQLite: Working memory (short-term context, auto-evicts), Episodic memory (conversation history with importance scoring), Semantic memory (long-term knowledge). All tiers persist across server restarts.',
    details: 'Memory items are retrieved via keyword matching with relevance scoring that factors in content match quality, importance weight, and access frequency. Automatic promotion: working → episodic → semantic based on access patterns.',
  },
  {
    name: 'Skill Registry',
    description: 'Extensible plugin system where skills are defined with metadata including name, description, version, author, and required permissions. Skills can be registered programmatically and searched by query. Built-in skills include web-search, code-executor, file-reader, summarizer, translator, and image-generator.',
    details: 'Currently skills are metadata definitions with a permission model. The architecture supports adding execution handlers in future releases. An audit method provides visibility into registered skills and their permission requirements.',
  },
  {
    name: 'AI Provider Integration',
    description: 'Uses z-ai-web-dev-sdk for AI-powered conversational responses. The agent sends structured messages with system prompt, conversation history, and memory context to generate intelligent, context-aware responses.',
    details: 'Currently uses a single AI provider. The architecture is designed to support adding a multi-provider gateway with failover in a future release.',
  },
  {
    name: 'Security Layer',
    description: 'Prompt injection detection with 8+ attack pattern recognition (identity manipulation, instruction override, system prompt extraction, etc.), input sanitization removing XSS and injection payloads, and output validation detecting credential leaks.',
    details: 'Every chat message passes through the security pipeline. All events are logged with severity levels (info, warning, critical). Critical events are logged to both in-memory and database audit logs.',
  },
];

const techStack = {
  'Frontend': ['Next.js 16', 'TypeScript', 'Tailwind CSS 4', 'shadcn/ui', 'Framer Motion'],
  'Backend': ['Next.js API Routes', 'Node.js / Bun', 'REST API'],
  'Database': ['SQLite', 'Prisma ORM'],
  'AI/ML': ['z-ai-web-dev-sdk', 'System Prompts'],
  'Security': ['Input Sanitization', 'Injection Detection', 'Output Validation', 'Audit Logging'],
  'Infrastructure': ['Docker', 'GitHub Actions CI/CD'],
};

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="py-20 px-4 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Architecture
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Designed for <span className="text-emerald-400">Transparency</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            A modular architecture built with real technologies. No exaggerated claims
            about frameworks we don&apos;t actually use.
          </p>
        </div>

        <Tabs defaultValue="components" className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="components" className="gap-2">
              <Blocks className="w-4 h-4" /> Core Components
            </TabsTrigger>
            <TabsTrigger value="techstack" className="gap-2">
              <Code className="w-4 h-4" /> Tech Stack
            </TabsTrigger>
          </TabsList>

          <TabsContent value="components">
            <div className="grid md:grid-cols-2 gap-4">
              {architectureComponents.map((component) => (
                <Card key={component.name} className="hover:border-emerald-500/30 transition-colors">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{component.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {component.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed bg-muted/50 rounded-lg p-3">
                      {component.details}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="techstack">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(techStack).map(([category, items]) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {items.map((item) => (
                        <Badge key={item} variant="outline" className="font-mono text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
