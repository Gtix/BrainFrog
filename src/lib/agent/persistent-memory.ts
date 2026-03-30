import { db } from '@/lib/db';
import type { MemoryEntry } from './types';

/**
 * PersistentMemorySystem
 *
 * Replaces the in-memory-only MemorySystem with a database-backed implementation.
 * - All writes go to SQLite via Prisma (survives restarts)
 * - Search queries hit the database for complete recall
 * - In-memory cache provides fast access for the current working set
 * - Automatic promotion from working → episodic → semantic tiers
 */
export class PersistentMemorySystem {
  // In-memory cache for the current working set (fast access)
  private workingCache: MemoryEntry[] = [];
  private maxWorkingCache = 10;

  constructor() {}

  /**
   * Initialize: preload recent episodic + semantic entries into cache
   */
  async initialize(): Promise<void> {
    // Preload recent episodic entries
    const recentEpisodic = await db.memoryEntry.findMany({
      where: { type: 'episodic' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    // Preload all semantic entries (they're long-term knowledge)
    const allSemantic = await db.memoryEntry.findMany({
      where: { type: 'semantic' },
      orderBy: { accessCount: 'desc' },
    });
    console.log(`[Memory] Loaded ${recentEpisodic.length} episodic + ${allSemantic.length} semantic entries from DB`);
  }

  async addWorking(content: string, importance = 0.5, sessionId?: string): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type: 'working',
      content,
      timestamp: new Date(),
      accessCount: 0,
      importance,
    };

    // Persist to DB
    await db.memoryEntry.create({
      data: {
        id: entry.id,
        sessionId,
        type: entry.type,
        content: entry.content,
        accessCount: 0,
        importance,
      },
    });

    // Add to working cache
    this.workingCache.push(entry);
    if (this.workingCache.length > this.maxWorkingCache) {
      const evicted = this.workingCache.shift();
      if (evicted && evicted.importance > 0.7) {
        await this.promoteToEpisodic(evicted);
      } else if (evicted) {
        // Clean up low-importance working entries from DB after eviction
        await db.memoryEntry.delete({ where: { id: evicted.id } }).catch(() => {});
      }
    }

    return entry;
  }

  private async promoteToEpisodic(entry: MemoryEntry): Promise<void> {
    // Update the existing DB record to episodic type
    await db.memoryEntry.update({
      where: { id: entry.id },
      data: { type: 'episodic', accessCount: entry.accessCount + 1, updatedAt: new Date() },
    });

    // Check if we should promote old episodic entries to semantic
    const episodicCount = await db.memoryEntry.count({ where: { type: 'episodic' } });
    if (episodicCount > 100) {
      // Find old, highly-accessed entries to promote
      const candidates = await db.memoryEntry.findMany({
        where: { type: 'episodic', accessCount: { gt: 5 }, importance: { gt: 0.8 } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
      for (const candidate of candidates) {
        await this.promoteToSemantic(candidate);
      }
      // Clean up excess episodic entries (keep only 100 most recent)
      const excess = await db.memoryEntry.findMany({
        where: { type: 'episodic' },
        orderBy: { createdAt: 'asc' },
        take: episodicCount - 100,
      });
      const excessIds = excess.map(e => e.id);
      if (excessIds.length > 0) {
        await db.memoryEntry.deleteMany({ where: { id: { in: excessIds } } });
      }
    }
  }

  private async promoteToSemantic(entry: { id: string; content: string }): Promise<void> {
    // Check for duplicates
    const exists = await db.memoryEntry.findFirst({
      where: { type: 'semantic', content: entry.content },
    });
    if (!exists) {
      await db.memoryEntry.update({
        where: { id: entry.id },
        data: { type: 'semantic', updatedAt: new Date() },
      });

      // Enforce max semantic entries (keep by importance * accessCount)
      const semanticCount = await db.memoryEntry.count({ where: { type: 'semantic' } });
      if (semanticCount > 500) {
        const allSemantic = await db.memoryEntry.findMany({
          where: { type: 'semantic' },
          orderBy: { createdAt: 'asc' },
        });
        // Sort by importance * accessCount, remove lowest
        allSemantic.sort((a, b) => (b.importance * b.accessCount) - (a.importance * a.accessCount));
        const toRemove = allSemantic.slice(500);
        const toRemoveIds = toRemove.map(e => e.id);
        if (toRemoveIds.length > 0) {
          await db.memoryEntry.deleteMany({ where: { id: { in: toRemoveIds } } });
        }
      }
    }
  }

  async addEpisodic(content: string, importance = 0.5, sessionId?: string): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type: 'episodic',
      content,
      timestamp: new Date(),
      accessCount: 0,
      importance,
    };

    await db.memoryEntry.create({
      data: {
        id: entry.id,
        sessionId,
        type: entry.type,
        content: entry.content,
        accessCount: 0,
        importance,
      },
    });

    return entry;
  }

  async addSemantic(content: string, importance = 0.8, sessionId?: string): Promise<MemoryEntry> {
    const exists = await db.memoryEntry.findFirst({
      where: { type: 'semantic', content },
    });

    if (exists) {
      // Increment access count on existing
      await db.memoryEntry.update({
        where: { id: exists.id },
        data: { accessCount: { increment: 1 } },
      });
      return {
        id: exists.id,
        type: 'semantic',
        content: exists.content,
        timestamp: exists.createdAt,
        accessCount: exists.accessCount + 1,
        importance: exists.importance,
      };
    }

    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type: 'semantic',
      content,
      timestamp: new Date(),
      accessCount: 0,
      importance,
    };

    await db.memoryEntry.create({
      data: {
        id: entry.id,
        sessionId,
        type: entry.type,
        content: entry.content,
        accessCount: 0,
        importance,
      },
    });

    return entry;
  }

  async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Search all memory types in DB using ILIKE-like patterns
    // SQLite uses LIKE (case-insensitive with COLLATE NOCASE)
    const allEntries = await db.memoryEntry.findMany({
      where: queryWords.length > 0
        ? {
            OR: [
              // Full phrase match
              { content: { contains: queryLower } },
              // Individual word matches
              ...queryWords.map(word => ({ content: { contains: word } })),
            ],
          }
        : undefined,
      orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
      take: limit * 3, // Fetch more, then score and trim
    });

    // Score and rank
    const scored = allEntries.map(entry => {
      const entryContent = entry.content.toLowerCase();
      let score = 0;

      // Exact phrase match gets highest score
      if (entryContent.includes(queryLower)) {
        score += 1.0;
      } else {
        // Word-level matching
        const matches = queryWords.filter(w => entryContent.includes(w));
        score += matches.length / Math.max(queryWords.length, 1);
      }

      // Weight by importance and access frequency
      score *= (0.3 + entry.importance * 0.4 + Math.min(entry.accessCount / 10, 0.3));

      // Boost semantic entries slightly (they represent learned knowledge)
      if (entry.type === 'semantic') score *= 1.2;

      return {
        entry: {
          id: entry.id,
          type: entry.type as MemoryEntry['type'],
          content: entry.content,
          timestamp: entry.createdAt,
          accessCount: entry.accessCount,
          importance: entry.importance,
        },
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    // Update access counts for returned entries
    for (const { entry } of results) {
      await db.memoryEntry.update({
        where: { id: entry.id },
        data: { accessCount: { increment: 1 } },
      }).catch(() => {});
    }

    return results.map(r => r.entry);
  }

  async getContextForPrompt(query: string, maxEntries = 5): Promise<string> {
    const relevant = await this.search(query, maxEntries);
    if (relevant.length === 0) return '';

    const memoryStr = relevant.map(m => {
      const age = Math.round((Date.now() - m.timestamp.getTime()) / 60000);
      const ageStr = age < 1 ? 'just now' : age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
      return `[${m.type.toUpperCase()} ${ageStr}] ${m.content}`;
    }).join('\n');

    return `\n<agent-memory>\n${memoryStr}\n</agent-memory>`;
  }

  async compact(): Promise<void> {
    if (this.workingCache.length > this.maxWorkingCache * 0.8) {
      const toPromote = this.workingCache.splice(0, Math.floor(this.workingCache.length / 2));
      for (const entry of toPromote) {
        if (entry.importance > 0.5) {
          await this.promoteToEpisodic(entry);
        } else {
          // Clean up low-importance entries
          await db.memoryEntry.delete({ where: { id: entry.id } }).catch(() => {});
        }
      }
    }
  }

  async clear(sessionId?: string): Promise<void> {
    if (sessionId) {
      await db.memoryEntry.deleteMany({ where: { sessionId } });
    } else {
      await db.memoryEntry.deleteMany({});
    }
    this.workingCache = [];
  }

  async getStats(): Promise<{ working: number; episodic: number; semantic: number; total: number }> {
    const [working, episodic, semantic] = await Promise.all([
      db.memoryEntry.count({ where: { type: 'working' } }),
      db.memoryEntry.count({ where: { type: 'episodic' } }),
      db.memoryEntry.count({ where: { type: 'semantic' } }),
    ]);
    return { working, episodic, semantic, total: working + episodic + semantic };
  }

  async getRecentEpisodic(count = 10): Promise<MemoryEntry[]> {
    const entries = await db.memoryEntry.findMany({
      where: { type: 'episodic' },
      orderBy: { createdAt: 'desc' },
      take: count,
    });
    return entries.map(e => ({
      id: e.id,
      type: 'episodic',
      content: e.content,
      timestamp: e.createdAt,
      accessCount: e.accessCount,
      importance: e.importance,
    }));
  }

  async getAllSemantic(): Promise<MemoryEntry[]> {
    const entries = await db.memoryEntry.findMany({
      where: { type: 'semantic' },
      orderBy: { importance: 'desc' },
    });
    return entries.map(e => ({
      id: e.id,
      type: 'semantic',
      content: e.content,
      timestamp: e.createdAt,
      accessCount: e.accessCount,
      importance: e.importance,
    }));
  }
}
