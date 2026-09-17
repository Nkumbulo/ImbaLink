import { ArrowRight, X } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../../components/common/Avatar";
import { computeRoommateCompatibility } from "../../utils/studentHelpers";

export default function RoommateFindAModal({ showFindA, findAStudents, closeFindA, myProfile, setSelectedId, setFindAStudents, findARandomStudents }) {
  return showFindA ? (
        <div className="rf-find-a-overlay" role="dialog" aria-modal="true" aria-label="Find-a students" onMouseDown={(e) => { if (e.target === e.currentTarget) closeFindA(); }}>
          <div className="rf-find-a-panel">
            <div className="rf-find-a-head">
              <div>
                <h3>Find-a</h3>
                <p>A fresh mix of compatible students you may get along with.</p>
              </div>
              <button type="button" className="rf-find-a-close" onClick={closeFindA} aria-label="Close Find-a"><X size={15} /></button>
            </div>
            {findAStudents.length === 0 ? (
              <div className="rf-empty">No other compatible students are available right now.</div>
            ) : (
              <div className="rf-find-a-grid">
                {findAStudents.map((student) => {
                  const compatibility = computeRoommateCompatibility(myProfile, student);
                  const tags = Array.isArray(student.preferenceTags) ? student.preferenceTags.slice(0, 3) : [];
                  return (
                    <article className="rf-find-a-card" key={student.id}>
                      <div className="rf-find-a-person">
                        <div className="rf-find-a-avatar">
                          {student.avatarUrl ? <img src={student.avatarUrl} alt="" loading="lazy" /> : (student.name || "S").charAt(0).toUpperCase()}
                        </div>
                        <div style={{minWidth:0}}>
                          <div className="rf-find-a-name">{student.name || "Student"}</div>
                          <div className="rf-find-a-meta">{student.university || "University not set"}{student.studyYear ? ` · ${student.studyYear}` : ""}</div>
                        </div>
                      </div>
                      <div className="rf-find-a-tags">
                        {tags.map((tag) => <span className="rf-find-a-tag" key={`${student.id}-${tag}`}>{tag}</span>)}
                        <span className="rf-find-a-match">{compatibility?.percent ? `${Math.round(compatibility.percent)}% match` : "Good match"}</span>
                      </div>
                      <button type="button" className="rf-find-a-profile" onClick={() => { closeFindA(); setSelectedId(student.id); }}>View Profile</button>
                    </article>
                  );
                })}
              </div>
            )}
            {findAStudents.length > 0 && <button type="button" className="rf-btn-secondary" style={{marginTop:14,width:'100%'}} onClick={() => setFindAStudents(findARandomStudents())}>Show me different students</button>}
          </div>
        </div>
  ) : null;
}
