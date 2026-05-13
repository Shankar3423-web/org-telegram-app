// src/reactContext/ReferralContext.js
// NOTE: Referral processing (reward logic, score updates) is now handled
// inside userManagement.js → initializeUser(). This context is only for
// UI concerns: invite link, friend list, share helpers, and welcome popup.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

import { useTelegram } from "./TelegramContext.js";
import { database } from "../services/FirebaseConfig.js";
import {
  ref,
  onValue,
} from "firebase/database";

const ReferralContext = createContext();
export const useReferral = () => useContext(ReferralContext);

export const ReferralProvider = ({ children }) => {
  const { user } = useTelegram();

  const [inviteLink, setInviteLink] = useState("");
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // ======================================
  // CHECK IF REFERRAL WAS JUST PROCESSED
  // (Signal from userManagement.js via custom event + sessionStorage fallback)
  // ======================================
  useEffect(() => {
    if (!user?.id) return;

    const checkAndShowPopup = () => {
      try {
        const wasProcessed = sessionStorage.getItem("referralJustProcessed");
        if (wasProcessed === "true") {
          setShowWelcomePopup(true);
          sessionStorage.removeItem("referralJustProcessed");
        }
      } catch (e) {
        // sessionStorage may not be available in all environments
      }
    };

    // Listen for the event fired by userManagement.js after referral processing
    const handleReferralProcessed = () => {
      checkAndShowPopup();
    };

    window.addEventListener("referralProcessed", handleReferralProcessed);

    // Also do an initial check in case the event already fired before this mounted
    checkAndShowPopup();

    return () => {
      window.removeEventListener("referralProcessed", handleReferralProcessed);
    };
  }, [user?.id]);

  // ======================================
  // GENERATE INVITE LINK
  // ======================================
  useEffect(() => {
    if (!user?.id) return;

    const botUsername =
      process.env.REACT_APP_BOT_USERNAME ||
      "orgtelegramapp_bot";

    const code = btoa(`${user.id}_${Date.now()}`)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 12);

    setInviteLink(
      `https://t.me/${botUsername}?startapp=ref_${code}_${user.id}`
    );
  }, [user?.id]);

  // ======================================
  // REFERRAL LIST (NO UNKNOWN BUG)
  // ======================================
  useEffect(() => {
    if (!user?.id) return;

    const referralsRef = ref(
      database,
      `users/${user.id}/referrals`
    );

    const unsubscribe = onValue(
      referralsRef,
      async (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setInvitedFriends([]);
          return;
        }

        const list = Object.values(data).map(
          (val) => ({
            id: val.id,
            name: val.name || "Unknown",
            referralDate: val.joinedAt || 0,
            xp: val.xp || 50,
          })
        );

        setInvitedFriends(list);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  // ======================================
  // SHARE HELPERS
  // ======================================
  const copyToClipboard = async () => {
    if (!inviteLink) return false;
    await navigator.clipboard.writeText(inviteLink);
    return true;
  };

  const shareToTelegram = () => {
    if (!inviteLink) return;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(
        inviteLink
      )}`,
      "_blank"
    );
  };

  const shareToWhatsApp = () => {
    if (!inviteLink) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        inviteLink
      )}`,
      "_blank"
    );
  };

  const shareToTwitter = () => {
    if (!inviteLink) return;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        inviteLink
      )}`,
      "_blank"
    );
  };

  const value = {
    inviteLink,
    invitedFriends,
    showWelcomePopup,
    setShowWelcomePopup,
    copyToClipboard,
    shareToTelegram,
    shareToWhatsApp,
    shareToTwitter,
  };

  return (
    <ReferralContext.Provider value={value}>
      {children}
    </ReferralContext.Provider>
  );
};
