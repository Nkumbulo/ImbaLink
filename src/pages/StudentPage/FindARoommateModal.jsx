import { Sparkles, UserRound, X } from "lucide-react";

export default function FindARoommateModal({
  showFindA,
  closeFindA,
  recommendationsLoading,
  recommendedStudents,
  selectedStudent,
  setSelectedStudent,
}) {
  if (!showFindA) return null;

  return (
    <div
      className="find-a-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Find-a students"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeFindA();
      }}
    >
      <div className="find-a-panel">
        <div className="find-a-head">
          <div className="find-a-title-wrap">
            <div className="find-a-icon"><Sparkles size={19} /></div>
            <div>
              <h3>Find-a</h3>
              <p>Students at your university who have posted a general roommate request.</p>
            </div>
          </div>
          <button type="button" className="find-a-close" onClick={closeFindA} aria-label="Close Find-a">
            <X size={17} />
          </button>
        </div>

        {recommendationsLoading ? (
          <div className="find-a-spinner">Finding compatible students…</div>
        ) : recommendedStudents.length === 0 ? (
          <div className="find-a-empty">
            No students at this university have an active general roommate request right now.
          </div>
        ) : (
          <>
            <div className="find-a-grid">
              {recommendedStudents.map((student) => {
                const initials = String(student.name || "Student").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
                const tags = Array.isArray(student.preferenceTags) ? student.preferenceTags.slice(0, 3) : [];
                return (
                  <article className="find-a-card" key={student.id}>
                    <div className="find-a-card-top">
                      <div className="find-a-avatar">
                        {student.avatarUrl ? <img src={student.avatarUrl} alt="" loading="lazy" /> : initials}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="find-a-card-name">{student.name || "Student"}</div>
                        <div className="find-a-meta">
                          {student.university || "University not listed"}<br />
                          {student.studyYear || "Student"}{student.area ? ` · ${student.area}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="find-a-tags">
                      {tags.map((tag, i) => <span className="find-a-tag" key={`${student.id}-tag-${i}`}>{String(tag)}</span>)}
                      <span className="find-a-match">General request</span>
                    </div>
                    <button type="button" className="find-a-profile-btn" onClick={() => setSelectedStudent(student)}>
                      <UserRound size={12} /> View Profile
                    </button>
                  </article>
                );
              })}
            </div>

            {selectedStudent && (
              <div className="find-a-detail">
                <div className="find-a-detail-top">
                  <div className="find-a-avatar">
                    {selectedStudent.avatarUrl ? <img src={selectedStudent.avatarUrl} alt="" /> : String(selectedStudent.name || "Student").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <h4>{selectedStudent.name || "Student"}</h4>
                    <p>
                      {selectedStudent.university || "University not listed"}
                      {selectedStudent.studyYear ? ` · ${selectedStudent.studyYear}` : ""}
                      {selectedStudent.area ? ` · ${selectedStudent.area}` : ""}
                    </p>
                  </div>
                </div>
                <div className="find-a-detail-about">
                  {selectedStudent.aboutMe || "This student has not added an introduction yet."}
                </div>
                {selectedStudent.preferences && (
                  <div className="find-a-detail-about"><strong>Preferences:</strong> {selectedStudent.preferences}</div>
                )}
                {selectedStudent.budget && (
                  <div className="find-a-detail-about"><strong>Budget:</strong> {selectedStudent.budget}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
