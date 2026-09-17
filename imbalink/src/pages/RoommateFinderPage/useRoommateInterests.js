import { useEffect, useState } from "react";
import { getStudentInterests, setStudentInterest } from "../../core/data/domains/students.js";

export function useRoommateInterests({ userId, showToast }) {
  const [interested, setInterested] = useState(new Set());

  useEffect(() => {
    let active = true;
    getStudentInterests(userId).then((ids) => {
      if (active) setInterested(new Set(ids));
    }).catch(() => {});
    return () => { active = false; };
  }, [userId]);

  const toggleInterested = (candidateId) => {
    const key = String(candidateId);
    const next = new Set(interested);
    const willConnect = !next.has(key);
    willConnect ? next.add(key) : next.delete(key);
    setInterested(next);
    setStudentInterest(key, willConnect).catch(() => {});
    showToast(willConnect ? "Request to connect sent." : "Request withdrawn.");
  };

  return { interested, toggleInterested };
}
