import type { SkillDefinition } from './types';

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.name)) {
      console.warn(`Skill "${skill.name}" already registered. Updating.`);
    }
    this.skills.set(skill.name, skill);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  search(query: string): SkillDefinition[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }

  validatePermissions(skillName: string, requestedPermissions: string[]): boolean {
    const skill = this.skills.get(skillName);
    if (!skill) return false;
    return requestedPermissions.every(p => skill.permissions.includes(p));
  }

  audit(): { name: string; hasSignature: boolean; permissions: string[]; safe: boolean }[] {
    return this.getAll().map(skill => ({
      name: skill.name,
      hasSignature: !!skill.signature,
      permissions: skill.permissions,
      safe: skill.permissions.length === 0 || !!skill.signature,
    }));
  }
}

// Built-in skills
export const builtinSkills: SkillDefinition[] = [
  {
    name: 'web-search',
    description: 'Search the web for information using natural language queries.',
    version: '1.0.0',
    author: 'NexusAgent Core',
    permissions: ['network:read'],
    handler: 'builtin:web-search',
  },
  {
    name: 'code-executor',
    description: 'Execute JavaScript/TypeScript code in a sandboxed environment.',
    version: '1.0.0',
    author: 'NexusAgent Core',
    permissions: ['sandbox:execute'],
    handler: 'builtin:code-executor',
  },
  {
    name: 'file-reader',
    description: 'Read and parse various file formats including JSON, CSV, and text.',
    version: '1.0.0',
    author: 'NexusAgent Core',
    permissions: ['fs:read'],
    handler: 'builtin:file-reader',
  },
  {
    name: 'summarizer',
    description: 'Summarize long texts, documents, or conversation histories.',
    version: '1.0.0',
    author: 'NexusAgent Core',
    permissions: [],
    handler: 'builtin:summarizer',
  },
  {
    name: 'translator',
    description: 'Translate text between multiple languages with high accuracy.',
    version: '1.0.0',
    author: 'NexusAgent Core',
    permissions: [],
    handler: 'builtin:translator',
  },
  {
    name: 'image-generator',
    description: 'Generate images from text descriptions using AI models.',
    version: '1.0.0',
    author: 'NexusAgent Core',
    permissions: ['ai:generate'],
    handler: 'builtin:image-generator',
  },
];
