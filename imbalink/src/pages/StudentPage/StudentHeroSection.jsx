import { ArrowRight, Check, ChevronDown, GraduationCap, Search, Users } from "lucide-react";
import StudentHeroAnimation from "./StudentHeroAnimation";

export default function StudentHeroSection({
  isDesktopLayout,
  campusCardRef,
  university,
  universityButtonRef,
  showUniversity,
  handleUniversityToggle,
  universities,
  setUniversity,
  setShowUniversity,
  campusCity,
  setTab,
}) {
  return (
    <section className="student-hero">
      <div className="student-hero-inner">
        <div>
          <div className="student-eyebrow"><GraduationCap size={14} /> ImbaLink Students</div>
          <h1>Find your student home.</h1>
          <p>Student-friendly accommodation, filtered to your campus and your budget — built around the way students actually find housing.</p>
          {/* Enhanced animated hero card */}
          <StudentHeroAnimation isDesktop={isDesktopLayout} />
        </div>

        <div className="student-hero-controls">
          <div
            className="student-campus-card student-campus-card-primary"
            ref={campusCardRef}
          >
            <div className="student-campus-label">1 · Choose your university</div>
            <div className="student-select">
              <button
                ref={universityButtonRef}
                type="button"
                onClick={handleUniversityToggle}
                aria-haspopup="listbox"
                aria-expanded={showUniversity}
              >
                <span><GraduationCap size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{university || "Select your university"}</span>
                <ChevronDown size={15} />
              </button>
              {showUniversity && (
                <div className="student-select-menu" role="listbox" aria-label="Choose your university">
                  {universities.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.name === university}
                      onClick={() => { setUniversity(item.name); setShowUniversity(false); }}
                    >
                      {item.name}{item.name === university && <Check size={13} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 10, color: "rgba(251,248,240,.55)", fontSize: 10 }}>
              {campusCity ? `Showing student-friendly homes in ${campusCity}.` : "Choose a university to personalize your accommodation results."}
            </div>
          </div>

          <div className="student-hero-actions">
            <button type="button" className="student-hero-btn primary" onClick={() => document.getElementById("student-homes")?.scrollIntoView({ behavior: "smooth" })}>
              <span className="student-hero-btn-icon"><Search size={15} /></span>
              <span className="student-hero-btn-copy"><strong>2 · Find Accommodation</strong><small>Explore student-friendly homes near your campus</small></span>
              <ArrowRight size={15} />
            </button>
            <button type="button" className="student-roommate-hero-btn" onClick={() => setTab?.("services")}>
              <span className="student-roommate-hero-icon"><Users size={17} /></span>
              <span><strong>3 · Find a Roommate</strong><small>Share a property with another student</small></span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
