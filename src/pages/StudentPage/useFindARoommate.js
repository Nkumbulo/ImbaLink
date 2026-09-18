import { useState } from "react";
import { backend } from "../../application/backend/index.js";

export function useFindARoommate({ university, userId }) {
  const [showFindA, setShowFindA] = useState(false);
  const [recommendedStudents, setRecommendedStudents] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadFindAStudents = async () => {
    setRecommendationsLoading(true);
    try {
      // Find-a is intentionally broader than the compatibility recommender:
      // show every student at the selected university who has an active
      // GENERAL roommate request (property_id IS NULL), whether compatible or not.
      const rows = await backend.sharingRepository.getUniversityGeneralShareRequestStudents(university, userId);
      const shuffled = [...(Array.isArray(rows) ? rows : [])].sort(() => Math.random() - 0.5);
      setRecommendedStudents(shuffled);
    } catch (error) {
      console.error("Failed to load Find-a students:", error);
      setRecommendedStudents([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const openFindA = () => {
    setShowFindA(true);
    loadFindAStudents();
  };

  const closeFindA = () => {
    setShowFindA(false);
    setSelectedStudent(null);
  };

  return {
    showFindA, openFindA, closeFindA,
    recommendedStudents, recommendationsLoading,
    selectedStudent, setSelectedStudent,
  };
}
