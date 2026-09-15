import { useEffect, useState } from "react";
import { getAgentRegistration, getCompanyRegistration } from "../core/data/domains/registrations.js";

/** Keeps auth-driven profile/registration state and logout cleanup out of App.jsx. */
export default function useAppSessionState({
  isAuthenticated, user, userProfile, setUserProfile,
  setLandlordRegistration, setProRegistration, setContractorRegistrations,
  setSaved, setLiked, setThreads, setViewingRequested, setConversationUnreadCounts,
  setMessagesState, setCollectionsView, setTab,
}) {
  const [agentRegistration, setAgentRegistration] = useState(null);
  const [companyRegistration, setCompanyRegistration] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user && !userProfile) setUserProfile(user);
  }, [isAuthenticated, user, userProfile, setUserProfile]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setAgentRegistration(null);
      setCompanyRegistration(null);
      return;
    }
    let active = true;
    const userId = user.id;
    getAgentRegistration(userId).then((record) => {
      if (active) setAgentRegistration(record || null);
    }).catch(() => {});
    getCompanyRegistration(userId).then((record) => {
      if (active) setCompanyRegistration(record || null);
    }).catch(() => {});
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated) return;
    setUserProfile(null);
    setLandlordRegistration(null);
    setAgentRegistration(null);
    setCompanyRegistration(null);
    setProRegistration(null);
    setContractorRegistrations([]);
    setSaved(new Set());
    setLiked(new Set());
    setThreads({});
    setViewingRequested({});
    setConversationUnreadCounts({});
    setMessagesState({});
    setCollectionsView("saved");
    setTab("home");
  }, [isAuthenticated]);

  return {
    agentRegistration, setAgentRegistration, companyRegistration, setCompanyRegistration,
  };
}
