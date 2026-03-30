'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, AlertTriangle } from 'lucide-react';

type FeatureStatus = boolean | 'planned';

interface ComparisonRow {
  feature: string;
  openclaw: FeatureStatus;
  hermes: FeatureStatus;
  nexus: FeatureStatus;
}

const comparisons: ComparisonRow[] = [
  { feature: 'Open Source', openclaw: true, hermes: true, nexus: true },
  { feature: 'Multi-Platform Messaging', openclaw: true, hermes: false, nexus: true },
  { feature: 'Self-Improving Learning', openclaw: false, hermes: true, nexus: 'planned' },
  { feature: 'Hierarchical Memory', openclaw: false, hermes: true, nexus: true },
  { feature: 'Skill Registry', openclaw: true, hermes: false, nexus: true },
  { feature: 'MCP Integration', openclaw: false, hermes: true, nexus: false },
  { feature: 'Zero Telemetry', openclaw: true, hermes: true, nexus: true },
  { feature: 'Security Scanning', openclaw: false, hermes: false, nexus: true },
  { feature: 'Prompt Injection Prevention', openclaw: false, hermes: false, nexus: true },
  { feature: 'Skill Sandboxing', openclaw: false, hermes: false, nexus: 'planned' },
  { feature: 'OAuth 2.0 + PKCE Auth', openclaw: false, hermes: false, nexus: 'planned' },
  { feature: 'Web Dashboard', openclaw: false, hermes: false, nexus: true },
  { feature: 'Docker Deployment', openclaw: false, hermes: false, nexus: true },
  { feature: 'Multi-LLM Failover', openclaw: false, hermes: true, nexus: true },
  { feature: 'Security Audit Logging', openclaw: false, hermes: false, nexus: true },
  { feature: 'Response Analytics', openclaw: false, hermes: false, nexus: true },
  { feature: 'Prompt Versioning', openclaw: false, hermes: false, nexus: true },
  { feature: 'Persistent Memory (DB)', openclaw: false, hermes: false, nexus: true },
];

function StatusIcon({ status }: { status: FeatureStatus }) {
  if (status === true) {
    return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
  }
  if (status === 'planned') {
    return (
      <AlertTriangle className="w-4 h-4 text-yellow-400 mx-auto" title="Planned" />
    );
  }
  return <X className="w-4 h-4 text-red-400/50 mx-auto" />;
}

export default function ComparisonSection() {
  return (
    <section id="comparison" className="py-20 px-4 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Comparison
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-emerald-400">Brain Frog</span> vs The Competition
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            A transparent comparison. Green = built and working. Yellow = planned/in-progress.
            We only ship what we&apos;ve actually built.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium text-muted-foreground w-1/3">Feature</th>
                    <th className="p-4 text-center font-medium w-1/6">
                      <div className="flex flex-col items-center gap-1">
                        <span>OpenClaw</span>
                      </div>
                    </th>
                    <th className="p-4 text-center font-medium w-1/6">Hermes Agent</th>
                    <th className="p-4 text-center font-medium w-1/6">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-emerald-400 font-bold">Brain Frog</span>
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Open Source</Badge>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="p-4 text-muted-foreground">{row.feature}</td>
                      <td className="p-4 text-center">
                        <StatusIcon status={row.openclaw} />
                      </td>
                      <td className="p-4 text-center">
                        <StatusIcon status={row.hermes} />
                      </td>
                      <td className="p-4 text-center">
                        <StatusIcon status={row.nexus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
