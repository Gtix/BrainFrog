'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal, Rocket, Container, Cloud, TestTube, FileText } from 'lucide-react';

const codeExamples = [
  {
    title: 'Clone & Install',
    icon: Terminal,
    code: `# Clone the repository
git clone https://github.com/your-org/brain-frog.git
cd brain-frog

# Install dependencies
npm install
# or: bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Push database schema
npx prisma db push

# Start the development server
npm run dev

# Open http://localhost:3000`,
  },
  {
    title: 'Quick Start with Docker',
    icon: Container,
    code: `# Pull and run with Docker Compose
docker compose up -d

# Or build from source
docker build -t brain-frog .
docker run -p 3000:3000 brain-frog

# The agent will be available at http://localhost:3000`,
  },
  {
    title: 'Use as a Library',
    icon: Rocket,
    code: `import { NexusAgent } from './lib/agent';

const agent = new NexusAgent({
  temperature: 0.7,
  enableMemory: true,
  securityLevel: 'high',
});

await agent.initialize();

const response = await agent.chat({
  message: 'Hello! What can you do?',
});

console.log(response.content);
console.log('Session:', response.sessionId);
console.log('Memory stats:', response.memoryStats);`,
  },
  {
    title: 'API Testing',
    icon: TestTube,
    code: `# Check agent health
curl http://localhost:3000/api/agent/status

# Send a chat message
curl -X POST http://localhost:3000/api/agent/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'

# Rate a response
curl -X POST http://localhost:3000/api/agent/rate \\
  -H "Content-Type: application/json" \\
  -d '{"messageId": "msg-id", "rating": 5}'

# View analytics
curl http://localhost:3000/api/agent/analytics

# Check messaging platform status
curl http://localhost:3000/api/messaging/status`,
  },
];

const deploymentOptions = [
  {
    title: 'Vercel (Recommended)',
    description: 'Deploy to Vercel with zero configuration. Simply connect your GitHub repository and Vercel handles the build and deployment.',
    command: 'npx vercel deploy --prod',
    requirements: ['Vercel account (free tier works)', 'Connected GitHub repo', 'Environment variables set in Vercel dashboard'],
  },
  {
    title: 'Docker',
    description: 'Containerized deployment for any cloud provider or on-premise infrastructure. Includes everything needed in a single container.',
    command: 'docker compose up -d',
    requirements: ['Docker & Docker Compose installed', 'Minimum 1 vCPU, 2GB RAM', 'Persistent volume for SQLite data'],
  },
  {
    title: 'Any Node.js Host',
    description: 'Deploy to any platform that supports Node.js 18+ — Railway, Render, Fly.io, DigitalOcean App Platform, etc.',
    command: 'npm run build && npm start',
    requirements: ['Node.js 18+ runtime', 'Environment variables configured', 'Persistent storage for SQLite (e.g., mounted volume)'],
  },
];

export default function SetupSection() {
  return (
    <section id="setup" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Getting Started
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Up and Running in <span className="text-emerald-400">5 Minutes</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Choose your preferred method to get Brain Frog running. Whether you want to
            test it online, run it locally, or deploy it to production.
          </p>
        </div>

        {/* How to Test Online */}
        <Card className="mb-12 border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cloud className="w-5 h-5 text-emerald-400" />
              How to Test Online (No Download Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              You can test Brain Frog directly from this page! Scroll up to the <strong className="text-foreground">&quot;Live Demo&quot;</strong> section and start chatting with the agent.
              The online demo is powered by the same core engine that runs in production.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              {[
                {
                  step: '1',
                  title: 'Scroll to Demo',
                  desc: 'Navigate to the Live Demo section at the top of this page.',
                },
                {
                  step: '2',
                  title: 'Type a Message',
                  desc: 'Enter any question or use one of the suggested prompts.',
                },
                {
                  step: '3',
                  title: 'Get AI Response',
                  desc: 'Brain Frog responds with context-aware, memory-enhanced answers.'
                },
              ].map((item) => (
                <div key={item.step} className="bg-background/50 rounded-lg p-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm mb-2">
                    {item.step}
                  </div>
                  <h4 className="font-medium mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-background/50 rounded-lg p-4 mt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" /> What the Demo Shows
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span><strong className="text-foreground">Hierarchical Memory:</strong> Watch memory stats update in real-time as the agent stores and retrieves information across messages.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span><strong className="text-foreground">Security Scanning:</strong> Every message is scanned for prompt injection attempts — try sending &quot;ignore all previous instructions&quot; to see the security layer in action.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span><strong className="text-foreground">Skill Registry:</strong> The status panel shows available skills and their versions.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span><strong className="text-foreground">Response Ratings:</strong> Hover over any assistant response to rate it with thumbs up/down.</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Installation Code Examples */}
        <Tabs defaultValue="install" className="mb-12">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
            <TabsTrigger value="install" className="text-xs sm:text-sm">
              Install
            </TabsTrigger>
            <TabsTrigger value="docker" className="text-xs sm:text-sm">
              Docker
            </TabsTrigger>
            <TabsTrigger value="sdk" className="text-xs sm:text-sm">
              SDK
            </TabsTrigger>
            <TabsTrigger value="test" className="text-xs sm:text-sm">
              API Test
            </TabsTrigger>
          </TabsList>

          {codeExamples.map((example) => (
            <TabsContent key={example.title} value={example.title.toLowerCase().split(' ')[0]}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <example.icon className="w-4 h-4 text-emerald-400" />
                    {example.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono leading-relaxed">
                    <code>{example.code}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Deployment Options */}
        <div>
          <h3 className="text-2xl font-bold text-center mb-8">
            Deployment Options
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deploymentOptions.map((option) => (
              <Card key={option.title} className="hover:border-emerald-500/30 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{option.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    <code>{option.command}</code>
                  </pre>
                  <div>
                    <p className="text-xs font-medium mb-1.5">Requirements:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {option.requirements.map((req) => (
                        <li key={req} className="flex items-start gap-1.5">
                          <span className="text-emerald-400">&#8226;</span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
