import { backend } from '../../application/backend/index.js';
import { useState, useEffect } from "react";
import { GraduationCap, UserRound, Briefcase, KeyRound, ArrowRight, ArrowLeft } from "lucide-react";
import { T } from "../../styles/tokens";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useAuth } from "../../auth/AuthContext";
import { STUDY_YEARS, ACCOMMODATION_PREFERENCES } from "../../utils/studentHelpers";

// Google's mark, inlined. Loading it from a CDN would put a third-party
// request in front of the sign-in button on connections that can least
// afford it, and Google's brand guidelines allow local copies.
function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/>
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/>
      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z"/>
    </svg>
  );
}

export default function UserOnboarding() {
  useBodyScrollLock(true);
  const { signInWithGoogle, completeProfile, logInWithCredentials, needsProfile, user, loading } = useAuth();

  const [error, setError] = useState("");
  const [showBusiness, setShowBusiness] = useState(false);
  const [universities, setUniversities] = useState([]);
  const [accountKind, setAccountKind] = useState("general"); // "general" | "student"

  const [form, setForm] = useState({
    firstName: "",
    surname: "",
    phone: "",
    university: "",
    studyYear: "",
    budget: "",
    accommodationPreference: "Any",
    wantsRoommate: false,
    username: "",
    password: "",
  });

  // Google usually hands us a name — prefill it so the profile step is a
  // couple of taps rather than a form.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      firstName: f.firstName || user.firstName || "",
      surname: f.surname || user.surname || "",
      phone: f.phone || user.phone || "",
    }));
  }, [user]);

  useEffect(() => {
    if (!needsProfile) return;
    let active = true;
    backend.studentRepository.getUniversities()
      .then((rows) => {
        if (!active) return;
        setUniversities(rows);
        setForm((f) => ({ ...f, university: f.university || rows[0]?.name || "" }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [needsProfile]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err?.message || "Couldn't reach Google sign-in. Check your connection and try again.");
    }
  };

  const handleBusinessLogin = async () => {
    if (!form.username.trim() || !form.password) {
      setError("Enter your username and password.");
      return;
    }
    setError("");
    try {
      await logInWithCredentials(form.username.trim(), form.password);
    } catch (err) {
      setError(err?.message || "No pro, agent, landlord or company account matched those details.");
    }
  };

  const handleComplete = async () => {
    const firstName = form.firstName.trim();
    const surname = form.surname.trim();

    if (!firstName || !surname) {
      setError("Add your first name and surname to continue.");
      return;
    }
    if (accountKind === "student" && !form.university) {
      setError("Select your university to continue.");
      return;
    }

    setError("");
    try {
      await completeProfile({
        firstName,
        surname,
        phone: form.phone.trim(),
        accountType: accountKind,
        studentProfile:
          accountKind === "student"
            ? {
                university: form.university,
                studyYear: form.studyYear,
                preferredCity: universities.find((u) => u.name === form.university)?.city || "",
                preferredArea: "",
                budget: form.budget.trim(),
                accommodationPreference: form.accommodationPreference,
                wantsRoommate: form.wantsRoommate,
              }
            : null,
      });
    } catch (err) {
      setError(err?.message || "Couldn't save your profile. Please try again.");
    }
  };

  const inputClass = "w-full rounded-xl px-3 py-3 f-body outline-none";
  const inputStyle = {
    background: T.paperDim,
    color: T.ink,
    border: `1px solid ${T.line}`,
    fontSize: 16,
  };

  const isStudent = accountKind === "student";

  const shell = (children) => (
    <div
      className="fixed inset-0 z-[1000] sm:z-50 flex items-center justify-center p-5 overflow-y-auto form-modal-backdrop"
      style={{ background: T.ink }}
    >
      <div
        className="w-full rounded-3xl p-6 form-modal-panel"
        style={{
          background: T.paper,
          maxWidth: 420,
          maxHeight: "90vh",
          overflowY: "auto",
          margin: "auto",
        }}
      >
        {children}
        {error && (
          <div
            className="f-body mt-4 rounded-xl px-3 py-2.5"
            style={{ background: "#FBE9E4", color: T.brick, fontSize: 12, lineHeight: 1.4 }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );

  // ---- Step 2: signed in with Google, still needs an account type --------
  if (needsProfile) {
    return shell(
      <>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: isStudent ? T.jacaranda : T.ink }}
        >
          {isStudent ? <GraduationCap size={25} color={T.paper} /> : <UserRound size={25} color={T.paper} />}
        </div>

        <div className="f-display" style={{ color: T.ink, fontSize: 23, lineHeight: 1.15 }}>
          <span style={{ fontWeight: 800 }}>Almost</span>{" "}
          <span style={{ fontWeight: 800, color: isStudent ? T.jacaranda : T.brick }}>there</span>
        </div>

        <div className="f-body mt-2 leading-relaxed" style={{ color: T.ink60, fontSize: 11.5 }}>
          Signed in as {user?.email}. Two quick things and you're in — you can change any of this later from your profile.
        </div>

        <div className="flex gap-1.5 mt-4 p-1 rounded-full" style={{ background: T.paperDim }}>
          <button
            type="button"
            onClick={() => { setAccountKind("general"); setError(""); }}
            className="flex-1 py-2 rounded-full f-body font-semibold"
            style={{
              background: !isStudent ? T.ink : "transparent",
              color: !isStudent ? T.paper : T.ink60,
              fontSize: 10.5,
            }}
          >
            Looking for a place
          </button>
          <button
            type="button"
            onClick={() => { setAccountKind("student"); setError(""); }}
            className="flex-1 py-2 rounded-full f-body font-semibold flex items-center justify-center gap-1"
            style={{
              background: isStudent ? T.jacaranda : "transparent",
              color: isStudent ? T.paper : T.ink60,
              fontSize: 10.5,
            }}
          >
            <GraduationCap size={12} /> I'm a student
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
          />
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="Surname"
            value={form.surname}
            onChange={(e) => update("surname", e.target.value)}
          />
        </div>

        <input
          className={`${inputClass} mt-2`}
          style={inputStyle}
          placeholder="Phone number (optional)"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
        />
        <div className="f-body mt-1.5" style={{ color: T.ink60, fontSize: 10.5 }}>
          Landlords and agents use this to reach you about a viewing. You can add it later.
        </div>

        {isStudent && (
          <div className="mt-4 rounded-2xl p-3" style={{ background: T.paperDim }}>
            <select
              className={inputClass}
              style={inputStyle}
              value={form.university}
              onChange={(e) => update("university", e.target.value)}
            >
              <option value="">Select your university</option>
              {universities.map((u) => (
                <option key={u.id || u.name} value={u.name}>{u.name}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <select
                className={inputClass}
                style={inputStyle}
                value={form.studyYear}
                onChange={(e) => update("studyYear", e.target.value)}
              >
                <option value="">Year of study</option>
                {STUDY_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Budget /mo"
                inputMode="numeric"
                value={form.budget}
                onChange={(e) => update("budget", e.target.value)}
              />
            </div>

            <select
              className={`${inputClass} mt-2`}
              style={inputStyle}
              value={form.accommodationPreference}
              onChange={(e) => update("accommodationPreference", e.target.value)}
            >
              {ACCOMMODATION_PREFERENCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <label className="flex items-center gap-2 mt-3 f-body" style={{ color: T.ink, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={form.wantsRoommate}
                onChange={(e) => update("wantsRoommate", e.target.checked)}
              />
              I'm open to finding a roommate
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleComplete}
          disabled={loading}
          className="w-full mt-4 py-3.5 rounded-xl f-body font-semibold flex items-center justify-center gap-2"
          style={{
            background: isStudent ? T.jacaranda : T.ink,
            color: T.paper,
            fontSize: 13,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Saving..." : <>Enter ImbaLink <ArrowRight size={15} /></>}
        </button>
      </>
    );
  }

  // ---- Step 1: signed out -----------------------------------------------
  if (showBusiness) {
    return shell(
      <>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: T.ink }}>
          <Briefcase size={25} color={T.paper} />
        </div>
        <div className="f-display" style={{ color: T.ink, fontSize: 23, lineHeight: 1.15 }}>
          <span style={{ fontWeight: 800 }}>Pro</span>{" "}
          <span style={{ fontWeight: 800, color: T.brick }}>sign in</span>
        </div>
        <div className="f-body mt-2 leading-relaxed" style={{ color: T.ink60, fontSize: 11.5 }}>
          For pro, agent, landlord and company accounts, using the username and password set during registration.
        </div>

        <input
          className={`${inputClass} mt-4`}
          style={inputStyle}
          placeholder="Username"
          autoCapitalize="none"
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
        />
        <input
          className={`${inputClass} mt-2`}
          style={inputStyle}
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
        />

        <button
          type="button"
          onClick={handleBusinessLogin}
          disabled={loading}
          className="w-full mt-4 py-3.5 rounded-xl f-body font-semibold flex items-center justify-center gap-2"
          style={{ background: T.ink, color: T.paper, fontSize: 13, opacity: loading ? 0.6 : 1 }}
        >
          <KeyRound size={15} /> {loading ? "Signing in..." : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => { setShowBusiness(false); setError(""); }}
          className="w-full mt-2 py-2.5 rounded-xl f-body font-semibold flex items-center justify-center gap-1.5"
          style={{ background: "transparent", color: T.ink60, fontSize: 11.5 }}
        >
          <ArrowLeft size={13} /> Back
        </button>
      </>
    );
  }

  return shell(
    <>
      <style>{`
        @keyframes wave-gesture {
          0%, 60%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
        }
        .wave-emoji { display: inline-block; transform-origin: 70% 70%; animation: wave-gesture 2.2s ease-in-out 0.3s 1; }
      `}</style>

      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: T.ink }}>
        <UserRound size={25} color={T.paper} />
      </div>

      <div className="f-display" style={{ color: T.ink, fontSize: 23, lineHeight: 1.15 }}>
        <span style={{ fontWeight: 800 }}>Welcome</span>{" "}
        <span className="wave-emoji" style={{ fontSize: 20 }}>👋</span>
        <br />
        <span style={{ fontWeight: 800, color: T.brick }}>to ImbaLink</span>
      </div>

      <div className="f-body mt-2 leading-relaxed" style={{ color: T.ink60, fontSize: 11.5 }}>
        Sign in with Google to browse listings, save places, message landlords and agents, and find a roommate. No passwords to remember.
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full mt-5 py-3.5 rounded-xl f-body font-semibold flex items-center justify-center gap-2.5"
        style={{
          background: T.paper,
          color: T.ink,
          border: `1px solid ${T.line}`,
          fontSize: 13.5,
          opacity: loading ? 0.6 : 1,
          boxShadow: "0 1px 2px rgba(20,32,26,0.08)",
        }}
      >
        <GoogleMark /> {loading ? "Opening Google..." : "Continue with Google"}
      </button>

      <div className="f-body mt-4 text-center" style={{ color: T.ink60, fontSize: 10.5, lineHeight: 1.5 }}>
        By continuing you agree to ImbaLink's terms and privacy policy.
      </div>

      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.line}` }}>
        <button
          type="button"
          onClick={() => { setShowBusiness(true); setError(""); }}
          className="w-full py-2.5 rounded-xl f-body font-semibold flex items-center justify-center gap-1.5"
          style={{ background: T.paperDim, color: T.ink, fontSize: 11.5 }}
        >
          <Briefcase size={13} /> Pro, agent or landlord account
        </button>
      </div>
    </>
  );
}
