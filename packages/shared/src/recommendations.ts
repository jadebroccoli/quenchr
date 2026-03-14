import type {
  FeedAudit,
  CleanupTask,
  CleanupSessionStep,
  CleanupPriority,
  Platform,
  AuditBreakdown,
} from './types';

/**
 * Compute a breakdown of the audit results into percentages.
 */
export function getAuditBreakdown(audit: FeedAudit): AuditBreakdown {
  const total = audit.total_scanned || 1;
  return {
    suggestivePercent: Math.round(((audit.nsfw_detected + audit.sexy_detected) / total) * 100),
    explicitPercent: Math.round((audit.nsfw_detected / total) * 100),
    sexyPercent: Math.round((audit.sexy_detected / total) * 100),
    cleanPercent: Math.round((audit.neutral_detected / total) * 100),
  };
}

/**
 * Session phase labels for display.
 */
export const SESSION_PHASES: {
  priority: CleanupPriority;
  title: string;
  subtitle: string;
  emoji: string;
}[] = [
  {
    priority: 'critical',
    title: 'Settings Tune-up',
    subtitle: 'One toggle = massive algorithm shift',
    emoji: '⚙️',
  },
  {
    priority: 'high',
    title: 'Not Interested Blitz',
    subtitle: 'Train your algorithm to stop showing this',
    emoji: '🚫',
  },
  {
    priority: 'medium',
    title: 'Unfollow Review',
    subtitle: 'Cut out accounts poisoning your feed',
    emoji: '✂️',
  },
  {
    priority: 'maintenance',
    title: 'Deep Clean',
    subtitle: 'Prevent your algorithm from re-learning',
    emoji: '🧹',
  },
];

/**
 * Maps task characteristics to a cleanup priority based on audit results.
 * Settings tasks are always critical, not-interested tasks are high priority
 * when the feed is heavily suggestive, etc.
 */
function assignPriority(task: CleanupTask, audit: FeedAudit): CleanupPriority {
  const breakdown = getAuditBreakdown(audit);
  const titleLower = task.title.toLowerCase();
  const descLower = task.description.toLowerCase();

  // Settings changes are always highest priority — biggest bang for buck
  if (
    titleLower.includes('sensitive content') ||
    titleLower.includes('content preferences') ||
    titleLower.includes('content filter') ||
    titleLower.includes('settings') ||
    descLower.includes('settings')
  ) {
    return 'critical';
  }

  // "Not Interested" tasks are high priority when feed is polluted
  if (
    titleLower.includes('not interested') ||
    titleLower.includes('explore') ||
    titleLower.includes('fyp') ||
    titleLower.includes('for you')
  ) {
    return breakdown.suggestivePercent > 40 ? 'high' : 'medium';
  }

  // Unfollow/review tasks
  if (
    titleLower.includes('unfollow') ||
    titleLower.includes('following') ||
    titleLower.includes('review')
  ) {
    return 'medium';
  }

  // Everything else is maintenance
  return 'maintenance';
}

/**
 * Generate a reason string explaining why this task was recommended.
 */
function generateReason(task: CleanupTask, audit: FeedAudit): string {
  const breakdown = getAuditBreakdown(audit);
  const priority = assignPriority(task, audit);

  switch (priority) {
    case 'critical':
      return `Your feed is ${breakdown.suggestivePercent}% suggestive. This setting change has the biggest impact.`;
    case 'high':
      return `${breakdown.suggestivePercent}% of your feed is thirst content. Marking posts "Not Interested" trains the algorithm fast.`;
    case 'medium':
      return `Unfollowing suggestive accounts prevents them from re-polluting your feed.`;
    case 'maintenance':
      return `Clearing your history stops the algorithm from re-learning old patterns.`;
  }
}

/**
 * Estimate how long a task takes in minutes.
 */
function estimateMinutes(task: CleanupTask): number {
  const titleLower = task.title.toLowerCase();

  if (titleLower.includes('settings') || titleLower.includes('sensitive content')) return 1;
  if (titleLower.includes('not interested') || titleLower.includes('explore') || titleLower.includes('fyp')) return 3;
  if (titleLower.includes('unfollow') || titleLower.includes('following')) return 5;
  if (titleLower.includes('clear') || titleLower.includes('history') || titleLower.includes('cache')) return 1;

  // Default based on difficulty
  switch (task.difficulty) {
    case 'easy': return 2;
    case 'medium': return 4;
    case 'hard': return 6;
  }
}

/**
 * Priority sort order (critical first).
 */
const PRIORITY_ORDER: Record<CleanupPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  maintenance: 3,
};

/**
 * Given an audit and a list of available tasks, generate a prioritized
 * cleanup session tailored to the user's specific feed problems.
 *
 * @param audit - The feed audit results
 * @param tasks - Available cleanup tasks for this platform
 * @param completedTaskIds - IDs of tasks the user has already completed
 * @param isPro - Whether the user has a Pro subscription
 * @returns Sorted array of cleanup session steps
 */
export function generateCleanupSession(
  audit: FeedAudit,
  tasks: CleanupTask[],
  completedTaskIds: string[] = [],
  isPro = false
): CleanupSessionStep[] {
  // Filter to matching platform, exclude completed, respect premium gate
  const eligibleTasks = tasks.filter(
    (t) =>
      t.platform === audit.platform &&
      !completedTaskIds.includes(t.id) &&
      (isPro || !t.is_premium)
  );

  // Map tasks to session steps with priority + context
  const steps: CleanupSessionStep[] = eligibleTasks.map((task) => ({
    task,
    priority: assignPriority(task, audit),
    reason: generateReason(task, audit),
    estimatedMinutes: estimateMinutes(task),
  }));

  // Sort by priority (critical → maintenance), then by points descending
  steps.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.task.points - a.task.points;
  });

  return steps;
}

/**
 * Get summary stats for a cleanup session.
 */
export function getSessionSummary(steps: CleanupSessionStep[]) {
  const totalPoints = steps.reduce((sum, s) => sum + s.task.points, 0);
  const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const stepsByPriority = steps.reduce(
    (acc, s) => {
      acc[s.priority] = (acc[s.priority] || 0) + 1;
      return acc;
    },
    {} as Record<CleanupPriority, number>
  );

  return { totalPoints, totalMinutes, stepsByPriority, totalSteps: steps.length };
}

/**
 * Get the phase info for a given priority.
 */
export function getPhaseInfo(priority: CleanupPriority) {
  return SESSION_PHASES.find((p) => p.priority === priority) ?? SESSION_PHASES[0];
}
