import { db } from '@/lib/db';

/**
 * PromptVersioning
 *
 * Manages system prompt versions. The honest version:
 * - Stores multiple versions of the system prompt
 * - Tracks which version each session uses
 * - Records user ratings per response
 * - Computes average ratings per prompt version
 * - Lets operators see which prompt performs best
 *
 * What it does NOT do (yet):
 * - It does NOT automatically optimize prompts (no DSPy)
 * - It does NOT auto-switch to better prompts
 * - It does NOT evolve on its own
 *
 * What it provides: The DATA and INFRASTRUCTURE for informed decisions.
 * A human operator (or future automation) reviews the analytics and decides
 * which prompt version to activate.
 */

export interface PromptVersionData {
  id: string;
  label: string;
  description: string;
  content: string;
  isActive: boolean;
  isDefault: boolean;
  totalUses: number;
  avgRating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalMessages: number;
  totalRatings: number;
  averageRating: number;
  promptVersions: PromptVersionData[];
  topRatedPrompt: PromptVersionData | null;
  ratingsByDay: Array<{ date: string; count: number; avgRating: number }>;
  recentRatings: Array<{ messageId: string; rating: number; ratedAt: Date; promptVersionLabel?: string }>;
}

export class PromptVersioning {

  /**
   * Get the currently active prompt content.
   * Falls back to the default if none is explicitly active.
   */
  async getActivePrompt(): Promise<{ id: string; content: string; label: string }> {
    const active = await db.promptVersion.findFirst({ where: { isActive: true } });
    if (active) {
      return { id: active.id, content: active.content, label: active.label };
    }
    const default_ = await db.promptVersion.findFirst({ where: { isDefault: true } });
    if (default_) {
      return { id: default_.id, content: default_.content, label: default_.label };
    }
    // If nothing exists yet, create the default
    const created = await db.promptVersion.create({
      data: {
        label: 'Default v1',
        description: 'Original NexusAgent system prompt',
        content: `You are NexusAgent, a revolutionary AI assistant that combines the accessibility of OpenClaw with the self-improving capabilities of Hermes Agent. You are security-first, privacy-focused, and designed to help users with a wide range of tasks. You have access to a hierarchical memory system, an extensible skill framework, and multiple LLM providers. Always be helpful, accurate, and transparent about your capabilities and limitations.`,
        isDefault: true,
        isActive: true,
      },
    });
    return { id: created.id, content: created.content, label: created.label };
  }

  /**
   * Create a new prompt version.
   * The newly created version is NOT active — you must explicitly activate it.
   */
  async createVersion(label: string, content: string, description = ''): Promise<PromptVersionData> {
    const version = await db.promptVersion.create({
      data: { label, content, description },
    });
    return this.toData(version);
  }

  /**
   * List all prompt versions, ordered by most recent first.
   */
  async listVersions(): Promise<PromptVersionData[]> {
    const versions = await db.promptVersion.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return versions.map(v => this.toData(v));
  }

  /**
   * Activate a specific prompt version. Deactivates all others.
   * This is a MANUAL operation — the system does not auto-switch.
   */
  async activateVersion(versionId: string): Promise<PromptVersionData> {
    // Deactivate all
    await db.promptVersion.updateMany({ where: {}, data: { isActive: false } });
    // Activate target
    const version = await db.promptVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    });
    return this.toData(version);
  }

  /**
   * Delete a prompt version. Cannot delete the active one.
   */
  async deleteVersion(versionId: string): Promise<boolean> {
    const version = await db.promptVersion.findUnique({ where: { id: versionId } });
    if (!version) return false;
    if (version.isActive) throw new Error('Cannot delete the active prompt version');
    await db.promptVersion.delete({ where: { id: versionId } });
    return true;
  }

  /**
   * Record that a session is using a prompt version.
   */
  async assignSessionToVersion(sessionId: string, versionId: string): Promise<void> {
    await db.agentSession.update({
      where: { id: sessionId },
      data: { promptVersionId: versionId },
    });
  }

  /**
   * Update usage count and average rating for a prompt version.
   * Called after each chat interaction.
   */
  async updateVersionMetrics(versionId: string): Promise<void> {
    const messages = await db.chatMessage.findMany({
      where: { promptVersionId: versionId, role: 'assistant', rating: { not: null } },
    });
    const totalUses = await db.chatMessage.count({
      where: { promptVersionId: versionId, role: 'assistant' },
    });
    const avgRating = messages.length > 0
      ? messages.reduce((sum, m) => sum + (m.rating || 0), 0) / messages.length
      : 0;

    await db.promptVersion.update({
      where: { id: versionId },
      data: { totalUses, avgRating: Math.round(avgRating * 100) / 100 },
    });
  }

  /**
   * Get full analytics summary.
   */
  async getAnalytics(): Promise<AnalyticsSummary> {
    const [totalSessions, totalMessages, ratedMessages, promptVersions] = await Promise.all([
      db.agentSession.count(),
      db.chatMessage.count(),
      db.chatMessage.count({ where: { rating: { not: null } } }),
      db.promptVersion.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    // Average rating
    const rated = await db.chatMessage.findMany({ where: { rating: { not: null } } });
    const averageRating = rated.length > 0
      ? Math.round((rated.reduce((s, m) => s + (m.rating || 0), 0) / rated.length) * 100) / 100
      : 0;

    // Top rated prompt version
    const topRated = [...promptVersions]
      .filter(v => v.totalUses > 0)
      .sort((a, b) => b.avgRating - a.avgRating)[0] || null;

    // Ratings by day (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentRated = await db.chatMessage.findMany({
      where: { rating: { not: null }, ratedAt: { gte: fourteenDaysAgo } },
      orderBy: { ratedAt: 'asc' },
    });

    const byDay = new Map<string, { count: number; totalRating: number }>();
    for (const m of recentRated) {
      const day = m.ratedAt?.toISOString().split('T')[0] || 'unknown';
      const existing = byDay.get(day) || { count: 0, totalRating: 0 };
      existing.count++;
      existing.totalRating += m.rating || 0;
      byDay.set(day, existing);
    }
    const ratingsByDay = Array.from(byDay.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      avgRating: Math.round((data.totalRating / data.count) * 100) / 100,
    }));

    // Recent ratings (last 20)
    const recentRatings = await db.chatMessage.findMany({
      where: { rating: { not: null } },
      orderBy: { ratedAt: 'desc' },
      take: 20,
      include: { session: { include: { promptVersion: { select: { label: true } } } } },
    });

    return {
      totalSessions,
      totalMessages,
      totalRatings: rated.length,
      averageRating,
      promptVersions: promptVersions.map(v => this.toData(v)),
      topRatedPrompt: topRated ? this.toData(topRated) : null,
      ratingsByDay,
      recentRatings: recentRatings.map(m => ({
        messageId: m.id,
        rating: m.rating!,
        ratedAt: m.ratedAt || m.timestamp,
        promptVersionLabel: m.session?.promptVersion?.label,
      })),
    };
  }

  private toData(v: { id: string; label: string; description: string; content: string; isActive: boolean; isDefault: boolean; totalUses: number; avgRating: number; createdAt: Date; updatedAt: Date }): PromptVersionData {
    return { ...v };
  }
}

// Singleton
let instance: PromptVersioning | null = null;

export function getPromptVersioning(): PromptVersioning {
  if (!instance) instance = new PromptVersioning();
  return instance;
}
