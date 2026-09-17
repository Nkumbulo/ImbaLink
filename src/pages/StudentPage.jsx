import useMediaQuery from "../hooks/useMediaQuery";
import { T } from "../styles/tokens";
import { getStudentPageStyles } from "./StudentPage/studentPageStyles";
import { useStudentHomes } from "./StudentPage/useStudentHomes";
import { useFindARoommate } from "./StudentPage/useFindARoommate";
import StudentHeroSection from "./StudentPage/StudentHeroSection";
import StudentHomesSection from "./StudentPage/StudentHomesSection";
import FindARoommateModal from "./StudentPage/FindARoommateModal";

export default function StudentPage({
  properties = [],
  liked,
  saved,
  toggleLike,
  toggleSave,
  openProperty,
  setTab,
  user,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
  shareRequestCounts = {},
  onFindRoommate,
}) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");

  const {
    universities, university, setUniversity,
    area, showUniversity, setShowUniversity, handleUniversityToggle,
    universityButtonRef, campusCardRef,
    campusCity, homes,
  } = useStudentHomes({ properties, user });

  const {
    showFindA, openFindA, closeFindA,
    recommendedStudents, recommendationsLoading,
    selectedStudent, setSelectedStudent,
  } = useFindARoommate({ university, userId: user?.id });

  return (
    <main className="student-page">
      <style>{getStudentPageStyles(T)}</style>

      <StudentHeroSection
        isDesktopLayout={isDesktopLayout}
        campusCardRef={campusCardRef}
        university={university}
        universityButtonRef={universityButtonRef}
        showUniversity={showUniversity}
        handleUniversityToggle={handleUniversityToggle}
        universities={universities}
        setUniversity={setUniversity}
        setShowUniversity={setShowUniversity}
        campusCity={campusCity}
        setTab={setTab}
      />

      <StudentHomesSection
        homes={homes}
        campusCity={campusCity}
        area={area}
        openFindA={openFindA}
        setTab={setTab}
        isTabletOrDesktop={isTabletOrDesktop}
        isDesktopLayout={isDesktopLayout}
        liked={liked}
        saved={saved}
        toggleLike={toggleLike}
        toggleSave={toggleSave}
        openProperty={openProperty}
        onOpenLister={onOpenLister}
        viewingRequested={viewingRequested}
        onRequestViewing={onRequestViewing}
        onSend={onSend}
        onOpenMessage={onOpenMessage}
        shareRequestCounts={shareRequestCounts}
        onFindRoommate={onFindRoommate}
      />

      <FindARoommateModal
        showFindA={showFindA}
        closeFindA={closeFindA}
        recommendationsLoading={recommendationsLoading}
        recommendedStudents={recommendedStudents}
        selectedStudent={selectedStudent}
        setSelectedStudent={setSelectedStudent}
      />
    </main>
  );
}
