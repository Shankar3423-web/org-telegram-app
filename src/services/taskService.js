import { ref, get, update, set } from "firebase/database";
import { database } from "./FirebaseConfig";

/**
 * Increments progress for all active (non-claimed) tasks of a specific type
 * across all categories (daily, weekly, achievements, normal).
 */
export async function incrementTaskProgress(userId, taskType, amount = 1) {
    if (!userId) return;

    try {
        const categories = ["daily", "weekly", "achievements", "normal"];
        const updates = {};
        let hasUpdates = false;

        for (const cat of categories) {
            const tasksDefRef = ref(database, `tasks/${cat}`);
            const tasksDefSnap = await get(tasksDefRef);
            const tasksDef = tasksDefSnap.val();

            if (!tasksDef) continue;

            const userTasksRef = ref(database, `connections/${userId}/tasks/${cat}`);
            const userTasksSnap = await get(userTasksRef);
            const userTasks = userTasksSnap.val() || {};

            for (const [taskId, task] of Object.entries(tasksDef)) {
                // Only target tasks of the matching type
                if (task.type !== taskType) continue;

                const userData = userTasks[taskId] || { progress: 0, completed: false, claimed: false };

                // Don't update if already claimed (unless it's repeatable, but claiming usually handles the reset)
                if (userData.claimed) continue;

                const currentProgress = userData.progress || 0;
                const newProgress = currentProgress + amount;
                const target = task.target || 1;
                const isCompleted = newProgress >= target;

                updates[`connections/${userId}/tasks/${cat}/${taskId}/progress`] = newProgress;
                updates[`connections/${userId}/tasks/${cat}/${taskId}/completed`] = isCompleted;
                updates[`connections/${userId}/tasks/${cat}/${taskId}/lastUpdated`] = Date.now();
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            await update(ref(database), updates);
            console.log(`Updated all ${taskType} tasks progress by ${amount}`);
        }
    } catch (error) {
        console.error("Error updating task progress:", error);
    }
}
