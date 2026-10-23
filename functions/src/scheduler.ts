import { onSchedule } from "firebase-functions/v2/scheduler";
import { suspendedTenantIds } from './tenant-status';
import * as admin from "firebase-admin";
import { db } from "./init";
import { FieldValue } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────
// Sprint Auto-Start Scheduler
// ─────────────────────────────────────────────────────────────

interface Sprint {
    id: string;
    projectId: string;
    name: string;
    startDate: string;
    status: 'Planning' | 'Active' | 'Completed' | 'Archived';
    autoStart?: boolean;
}

/**
 * Automatically start sprints that have autoStart enabled and whose startDate has arrived.
 * Runs every hour.
 */
export const autoStartSprints = onSchedule({ schedule: "every 1 hours", region: "europe-west3" }, async (event) => {
    const now = new Date();
    console.log(`[SprintScheduler] Running auto-start check at ${now.toISOString()}`);

    try {
        const snapshot = await db.collectionGroup('sprints')
            .where('status', '==', 'Planning')
            .where('autoStart', '==', true)
            .get();

        if (snapshot.empty) {
            console.log('[SprintScheduler] No pending auto-start sprints found.');
            return;
        }

        const batch = db.batch();
        let updateCount = 0;

        const suspended = await suspendedTenantIds();
        snapshot.docs.forEach(doc => {
            if (suspended.has(doc.ref.path.split('/')[1])) return; // suspended in the admin console
            const sprint = doc.data() as Sprint;

            // Parse start date
            let startDate: Date;
            if ((sprint.startDate as any)?.toDate) {
                startDate = (sprint.startDate as any).toDate();
            } else {
                startDate = new Date(sprint.startDate);
            }

            // If start date is in the past or now
            if (startDate <= now) {
                console.log(`[SprintScheduler] Starting sprint ${doc.id} (Project: ${sprint.projectId})`);
                batch.update(doc.ref, {
                    status: 'Active',
                    updatedAt: FieldValue.serverTimestamp()
                });
                updateCount++;
            }
        });

        if (updateCount > 0) {
            await batch.commit();
            console.log(`[SprintScheduler] Successfully started ${updateCount} sprints.`);
        } else {
            console.log('[SprintScheduler] Found candidates but none ready to start yet.');
        }

    } catch (error: any) {
        console.error('[SprintScheduler] Error auto-starting sprints:', error);
    }
});

// ─────────────────────────────────────────────────────────────
// Daily Health Snapshots Scheduler
// ─────────────────────────────────────────────────────────────

type HealthStatus = 'excellent' | 'healthy' | 'warning' | 'critical' | 'stalemate' | 'normal';

/**
 * Calculate a simplified health score for a project based on task data.
 * This is a cloud function version - simplified from the full client-side calculation.
 */
function calculateSimpleHealthScore(
    tasks: admin.firestore.QueryDocumentSnapshot[]
): { score: number; status: HealthStatus; trend: 'improving' | 'declining' | 'stable' } {
    let score = 70; // Base score

    if (tasks.length === 0) {
        return { score: 50, status: 'normal', trend: 'stable' };
    }

    // Task completion rate
    const completedTasks = tasks.filter(t => t.data().isCompleted).length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    // Boost for high completion
    if (completionRate >= 0.8) score += 15;
    else if (completionRate >= 0.5) score += 5;
    else if (completionRate < 0.3 && totalTasks > 0) score -= 10;

    // Overdue tasks penalty
    const now = new Date();
    const overdueTasks = tasks.filter(t => {
        const data = t.data();
        if (data.isCompleted) return false;
        if (!data.dueDate) return false;
        const dueDate = typeof data.dueDate === 'string' ? new Date(data.dueDate) : data.dueDate.toDate?.() || new Date(data.dueDate);
        return dueDate < now;
    });

    if (overdueTasks.length > 0) {
        score -= Math.min(overdueTasks.length * 5, 25);
    }

    // Urgent/High priority pending penalty
    const urgentPending = tasks.filter(t => {
        const data = t.data();
        return !data.isCompleted && (data.priority === 'Urgent' || data.priority === 'High');
    });

    if (urgentPending.length > 3) score -= 10;
    else if (urgentPending.length > 0) score -= 5;

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: HealthStatus;
    if (score >= 85) status = 'excellent';
    else if (score >= 70) status = 'healthy';
    else if (score >= 50) status = 'warning';
    else if (score >= 30) status = 'critical';
    else status = 'critical';

    // Trend is simplified to 'stable' since we don't have historical data in this context
    // The real trend would require comparing to previous snapshot
    return { score, status, trend: 'stable' };
}

/**
 * Save daily health snapshots for ALL projects.
 * Runs at midnight (00:00) every day.
 */
export const dailyHealthSnapshots = onSchedule(
    { schedule: "0 0 * * *", region: "europe-west3", timeZone: "Europe/Berlin" },
    async (event) => {
        const today = new Date().toISOString().split('T')[0];
        console.log(`[HealthSnapshots] Running daily snapshot for ${today}`);

        try {
            // Get all tenants
            const tenantsSnap = await db.collection('tenants').get();

            if (tenantsSnap.empty) {
                console.log('[HealthSnapshots] No tenants found.');
                return;
            }

            let projectCount = 0;
            let snapshotCount = 0;

            for (const tenantDoc of tenantsSnap.docs) {
                const tenantId = tenantDoc.id;
                if (tenantDoc.get('suspendedAt') != null) continue; // suspended in the admin console

                // Get all projects for this tenant
                const projectsSnap = await db.collection('tenants').doc(tenantId)
                    .collection('projects').get();

                for (const projectDoc of projectsSnap.docs) {
                    projectCount++;
                    const projectId = projectDoc.id;

                    try {
                        // Get tasks for this project
                        const tasksSnap = await db.collection('tenants').doc(tenantId)
                            .collection('projects').doc(projectId)
                            .collection('tasks').get();

                        const health = calculateSimpleHealthScore(tasksSnap.docs);

                        // Save snapshot using date as document ID (prevents duplicates)
                        const snapshotRef = db.collection('tenants').doc(tenantId)
                            .collection('projects').doc(projectId)
                            .collection('healthSnapshots').doc(today);

                        await snapshotRef.set({
                            projectId,
                            tenantId,
                            score: health.score,
                            status: health.status,
                            trend: health.trend,
                            date: today,
                            timestamp: FieldValue.serverTimestamp()
                        });

                        snapshotCount++;
                    } catch (err: any) {
                        console.error(`[HealthSnapshots] Error processing project ${projectId}:`, err.message);
                    }
                }
            }

            console.log(`[HealthSnapshots] Completed. Processed ${projectCount} projects, saved ${snapshotCount} snapshots.`);

        } catch (error: any) {
            console.error('[HealthSnapshots] Error:', error);
        }
    }
);

