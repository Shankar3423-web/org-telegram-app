import { database } from "../services/FirebaseConfig";
import { ref, get, update, runTransaction } from "firebase/database";

// ======================================
// SAFE SCORE UPDATE (FIREBASE TRANSACTION)
// ======================================
const safeUpdateScores = async (userId, amount) => {
  const userRef = ref(database, `users/${userId}`);

  await runTransaction(userRef, (data) => {
    if (!data) return data;

    if (!data.Score) {
      data.Score = {
        farming_score: 0,
        network_score: 0,
        game_score: 0,
        news_score: 0,
        task_score: 0,
        total_score: 0,
        game_highest_score: 0,
        no_of_tickets: 3,
      };
    }

    data.Score.network_score =
      (data.Score.network_score || 0) + amount;

    data.Score.total_score =
      (data.Score.total_score || 0) + amount;

    return data;
  });
};

// ======================================
// PROCESS REFERRAL (called after user is created)
// ======================================
const processReferral = async (newUserId, referrerId, user) => {
  try {
    // Self-referral check
    if (referrerId === newUserId) {
      console.log("Referral skipped: self-referral detected.");
      return;
    }

    // Check referrer exists in DB
    const referrerSnap = await get(
      ref(database, `users/${referrerId}`)
    );
    if (!referrerSnap.exists()) {
      console.log("Referral skipped: referrer does not exist.");
      return;
    }

    // Check if already processed (dedup)
    const referredBySnap = await get(
      ref(database, `users/${newUserId}/referredBy`)
    );
    if (referredBySnap.exists()) {
      console.log("Referral skipped: already rewarded.");
      return;
    }

    const timestamp = Date.now();
    const newUserName =
      user.username || user.first_name || "Unknown";
    const referrerData = referrerSnap.val();
    const referrerName =
      referrerData.name ||
      referrerData?.meta?.name ||
      "Unknown";

    const updates = {};

    // Set referredBy on new user
    updates[`users/${newUserId}/referredBy`] = {
      id: referrerId,
      name: referrerName,
    };

    updates[`users/${newUserId}/referralSource`] = "Invite";

    // Add new user inside referrer's referrals list
    updates[`users/${referrerId}/referrals/${newUserId}`] = {
      id: newUserId,
      name: newUserName,
      joinedAt: timestamp,
      xp: 50,
    };

    await update(ref(database), updates);

    // 🔥 LEVEL 1: Direct referral rewards
    await safeUpdateScores(referrerId, 100);
    await safeUpdateScores(newUserId, 50);

    // 🔥 LEVEL 2: Parent referral
    const parent = referrerData.referredBy;
    if (parent?.id) {
      await safeUpdateScores(parent.id, 20);

      // 🔥 LEVEL 3: Grandparent referral
      const grandSnap = await get(
        ref(database, `users/${parent.id}`)
      );
      const grand = grandSnap.val()?.referredBy;

      if (grand?.id) {
        await safeUpdateScores(grand.id, 10);
      }
    }

    // Signal to ReferralContext to show welcome popup
    try {
      sessionStorage.setItem("referralJustProcessed", "true");
      window.dispatchEvent(new Event("referralProcessed"));
    } catch (e) {
      // sessionStorage may not be available in all environments
    }

    console.log(
      "✅ Referral processed successfully:",
      referrerId,
      "->",
      newUserId
    );
  } catch (error) {
    console.error("❌ Error processing referral:", error);
  }
};

// ======================================
// MAIN: INITIALIZE USER
// ======================================
export const initializeUser = async (user, startParam) => {
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

    // 🟢 Update base profile safely (won't overwrite referrals/referredBy)
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

    // 🟢 REFERRAL PROCESSING (user is guaranteed to exist now)
    if (startParam && startParam.startsWith("ref_")) {
      const parts = startParam.split("_");
      if (parts.length >= 3) {
        const referrerId = parts[2];
        await processReferral(userId, referrerId, user);
      }
    }

    return userId;
  } catch (error) {
    console.error("Error during user initialization:", error);
    return null;
  }
};
