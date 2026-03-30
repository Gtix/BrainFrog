import type { SecurityAuditLog } from './types';

export class SecurityManager {
  private auditLogs: SecurityAuditLog[] = [];
  private maxLogs = 1000;

  log(event: string, severity: SecurityAuditLog['severity'], details: string, sourceIp?: string, userId?: string): void {
    const entry: SecurityAuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      event,
      severity,
      details,
      sourceIp,
      userId,
    };
    this.auditLogs.push(entry);
    if (this.auditLogs.length > this.maxLogs) {
      this.auditLogs = this.auditLogs.slice(-this.maxLogs);
    }
    if (severity === 'critical') {
      console.error(`[SECURITY CRITICAL] ${event}: ${details}`);
    } else if (severity === 'warning') {
      console.warn(`[SECURITY WARNING] ${event}: ${details}`);
    }
  }

  sanitizeInput(input: string): string {
    let sanitized = input.trim();
    const patterns = [
      /<\s*script[^>]*>.*?<\s*\/\s*script>/gi,
      /javascript\s*:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /<\s*iframe[^>]*>.*?<\s*\/\s*iframe>/gi,
      /<\s*object[^>]*>.*?<\s*\/\s*object>/gi,
      /<\s*embed[^>]*>/gi,
    ];
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, '[SANITIZED]');
    }
    if (sanitized !== input.trim()) {
      this.log('INPUT_SANITIZATION', 'warning', `Potentially dangerous input detected and sanitized`);
    }
    return sanitized;
  }

  detectPromptInjection(input: string): { safe: boolean; risk: number; indicators: string[] } {
    const indicators: string[] = [];
    const lower = input.toLowerCase();
    const patterns = [
      { regex: /ignore (all )?(previous|above) (instructions?|prompts?|rules?)/i, label: 'Instruction override attempt' },
      { regex: /you are now (a |an )?(different|new|no longer)/i, label: 'Identity manipulation' },
      { regex: /system prompt|developer instructions?|hidden prompt/i, label: 'System prompt extraction attempt' },
      { regex: /\[INST\]|<<SYS>>|<\|im_start\|>.*system/i, label: 'Special token injection' },
      { regex: /forget (everything|all|your instructions?)/i, label: 'Memory wipe attempt' },
      { regex: /pretend (you are|to be)|act as if you are/i, label: 'Role manipulation' },
      { regex: /reveal (your|the) (system|initial|original) prompt/i, label: 'Prompt disclosure attempt' },
      { regex: /admin|root|superuser|debug mode/i, label: 'Privilege escalation attempt' },
    ];
    let risk = 0;
    for (const { regex, label } of patterns) {
      if (regex.test(lower)) {
        indicators.push(label);
        risk += 0.2;
      }
    }
    risk = Math.min(risk, 1.0);
    const safe = risk < 0.4;
    if (!safe) {
      this.log('PROMPT_INJECTION_DETECTED', risk >= 0.8 ? 'critical' : 'warning',
        `Risk level: ${(risk * 100).toFixed(0)}%. Indicators: ${indicators.join(', ')}`);
    }
    return { safe, risk, indicators };
  }

  validateOutput(output: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];
    if (output.length > 10000) issues.push('Output exceeds maximum length');
    const sensitivePatterns = [
      { regex: /api[_-]?key\s*[=:]\s*["'][^"']+["']/i, label: 'Potential API key leakage' },
      { regex: /password\s*[=:]\s*["'][^"']+["']/i, label: 'Potential password leakage' },
      { regex: /token\s*[=:]\s*["'][A-Za-z0-9\-_\.]{20,}["']/i, label: 'Potential token leakage' },
      { regex: /(sk|pk|rk)_[a-zA-Z0-9]{20,}/i, label: 'Potential credential leakage' },
    ];
    for (const { regex, label } of sensitivePatterns) {
      if (regex.test(output)) {
        issues.push(label);
        this.log('OUTPUT_CREDENTIAL_LEAK', 'critical', label);
      }
    }
    return { safe: issues.length === 0, issues };
  }

  getAuditLogs(limit = 50): SecurityAuditLog[] {
    return this.auditLogs.slice(-limit);
  }

  getCriticalEvents(): SecurityAuditLog[] {
    return this.auditLogs.filter(l => l.severity === 'critical');
  }

  clearLogs(): void {
    this.auditLogs = [];
  }
}
