import { database } from "../services/FirebaseConfig";
import { ref, get, update } from "firebase/database";

export const initializeUser = async (user) => {
  if (!user) return null;

  const userId = user.id.toString();
  const userRef = ref(database, `users/${userId}`);

  try {
    const snapshot = await get(userRef);
    const now = Date.now();
    const todayUTC = new Date().toISOString().split("T")[0];

    // 🟢 NON-DESTRUCTIVE BASE META PROFILE
    const baseMetaProfile = {
      meta: {
        name: user.username || user.first_name || "Anonymous",
      },
      lastUpdated: now,
    };

    // If user does NOT exist → initialize full base structure
    if (!snapshot.exists()) {
      baseMetaProfile.createdAt = now;
      baseMetaProfile.lastPlayed = now;
      baseMetaProfile.lastReset = {
        daily: todayUTC,
      };
      baseMetaProfile.streak = {
        currentStreakCount: 1,
        lastStreakCheckDateUTC: todayUTC,
        longestStreakCount: 1,
      };
    }

    // 🟢 Update base profile safely (won’t overwrite referrals/referredBy)
    await update(userRef, baseMetaProfile);

    // 🟢 Initialize Score only if it doesn't exist
    const scoreRef = ref(database, `users/${userId}/Score`);
    const scoreSnap = await get(scoreRef);

    if (!scoreSnap.exists()) {
      await update(scoreRef, {
        farming_score: 0,
        game_highest_score: 0,
        game_score: 0,
        network_score: 0,
        news_score: 0,
        no_of_tickets: 3,
        task_score: 0,
        total_score: 0,
      });

      console.log("Default scores initialized for new user.");
    }

    return userId;
  } catch (error) {
    console.error("Error during user initialization:", error);
    return null;
  }
};
