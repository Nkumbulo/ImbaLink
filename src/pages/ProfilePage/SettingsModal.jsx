import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import {
  Bell, ChevronRight, Globe2, LockKeyhole, Volume2, Palette,
  ShieldCheck, FileText, Database, Info, X, RotateCcw, Check,
} from "lucide-react";
import { T } from "../../styles/tokens";
import { THEMES } from "./constants";
import { getPublishedLegalDocument } from "../../core/data/domains/legalDocuments";

const LANGUAGE_OPTIONS = [
  { id: "en", label: "English", note: "Primary app language", available: true },
  { id: "sn", label: "Shona", note: "Language pack coming soon", available: false },
  { id: "nd", label: "isiNdebele", note: "Language pack coming soon", available: false },
];

const SOUND_OPTIONS = [
  { id: "imba-tone", label: "ImbaTone", note: "ImbaLink signature chime", file: "notification-message.wav" },
  { id: "general", label: "ImbaLink General", note: "Standard ImbaLink alert", file: "notification-general.wav" },
];

function Row({ icon: Icon, title, description, value, onClick, danger = false }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left" style={{ background: T.paperDim, color: danger ? T.brick : T.ink }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: danger ? "rgba(184,61,49,.10)" : "rgba(47,122,85,.10)", color: danger ? T.brick : T.jacaranda }}>
        <Icon size={17} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block f-body font-semibold" style={{ fontSize: 12 }}>{title}</span>
        {description && <span className="block f-body mt-0.5" style={{ color: T.ink60, fontSize: 10.5 }}>{description}</span>}
      </span>
      {value && <span className="f-body font-semibold" style={{ color: T.ink60, fontSize: 10.5 }}>{value}</span>}
      <ChevronRight size={15} style={{ color: T.ink60 }} />
    </button>
  );
}

function Section({ title, children }) {
  return <section className="space-y-2"><div className="f-mono px-1" style={{ color: T.ink60, fontSize: 9.5, letterSpacing: ".12em" }}>{title.toUpperCase()}</div>{children}</section>;
}

export default function SettingsModal({
  theme,
  onTheme,
  onNotifications,
  onClose,
}) {
  const [language, setLanguage] = useState("en");
  const [sound, setSound] = useState("imba-tone");
  const [view, setView] = useState("main");
  const [notice, setNotice] = useState("");
  const [legalDoc, setLegalDoc] = useState(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalError, setLegalError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      Preferences.get({ key: "imbalink-language" }),
      Preferences.get({ key: "imbalink-notification-tone" }),
    ]).then(([lang, tone]) => {
      if (cancelled) return;
      if (lang.value) setLanguage(lang.value);
      if (tone.value) setSound(tone.value);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const chooseLanguage = async (id) => {
    const option = LANGUAGE_OPTIONS.find((item) => item.id === id);
    if (!option?.available) {
      setNotice(`${option?.label || "This language"} is not available yet.`);
      return;
    }
    setLanguage(id);
    document.documentElement.lang = id;
    await Preferences.set({ key: "imbalink-language", value: id });
    setNotice("Language preference saved.");
  };

  const chooseSound = async (id) => {
    setSound(id);
    await Preferences.set({ key: "imbalink-notification-tone", value: id });
    const selected = SOUND_OPTIONS.find((item) => item.id === id);
    if (selected) {
      try {
        const audio = new Audio(`/sounds/${selected.file}`);
        audio.volume = 0.8;
        await audio.play();
      } catch {}
    }
    setNotice("Notification tone selected.");
  };

  const resetPreferences = async () => {
    await Promise.all([
      Preferences.remove({ key: "imbalink-language" }),
      Preferences.remove({ key: "imbalink-notification-tone" }),
      Preferences.remove({ key: "imbalink-theme" }),
    ]);
    setLanguage("en");
    setSound("imba-tone");
    document.documentElement.lang = "en";
    onTheme("classic");
    setNotice("App preferences restored to their defaults.");
  };

  const openTerms = async () => {
    setView("terms");
    setLegalError("");
    setLegalLoading(true);
    try {
      const doc = await getPublishedLegalDocument("terms-of-service");
      setLegalDoc(doc);
    } catch (error) {
      setLegalError("The full Terms & Conditions could not be loaded right now. Please try again.");
    } finally {
      setLegalLoading(false);
    }
  };

  const selectedTheme = THEMES.find((item) => item.id === theme) || THEMES[0];
  const selectedLanguage = LANGUAGE_OPTIONS.find((item) => item.id === language)?.label || "English";
  const selectedSound = SOUND_OPTIONS.find((item) => item.id === sound)?.label || "ImbaTone";

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center" style={{ background: "rgba(20,32,26,.52)" }} onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-hidden rounded-t-[28px] sm:rounded-[28px]" style={{ background: T.paper, border: `1px solid ${T.line}`, boxShadow: "0 28px 80px rgba(0,0,0,.24)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div>
            <div className="f-display font-bold" style={{ color: T.ink, fontSize: 18 }}>Settings</div>
            <div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>Manage your ImbaLink experience</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings" style={{ color: T.ink60 }}><X size={19} /></button>
        </div>

        {view === "main" && (
          <div className="p-5 overflow-y-auto max-h-[calc(92vh-76px)] space-y-5">
            <div className="rounded-2xl p-4" style={{ background: selectedTheme.soft, border: `1px solid ${selectedTheme.line}` }}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: selectedTheme.color, color: selectedTheme.navText }}><Palette size={18} /></span>
                <div className="flex-1"><div className="f-display font-semibold" style={{ color: T.ink, fontSize: 13 }}>Your ImbaLink</div><div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>Everything important is in one place.</div></div>
                <Check size={16} style={{ color: selectedTheme.color }} />
              </div>
            </div>

            <Section title="Appearance & sound">
              <Row icon={Palette} title="Theme" description="Choose your ImbaLink colour and visual style" value={selectedTheme.name} onClick={() => { onTheme(); }} />
              <Row icon={Volume2} title="Notification tones" description="Choose and preview the ImbaLink alert sound" value={selectedSound} onClick={() => setView("sounds")} />
              <Row icon={Bell} title="Notifications" description="Alerts, sound, desktop and mobile delivery" onClick={onNotifications} />
            </Section>

            <Section title="Language & region">
              <Row icon={Globe2} title="Language" description="Choose the language used by ImbaLink" value={selectedLanguage} onClick={() => setView("language")} />
            </Section>

            <Section title="Privacy & legal">
              <Row icon={LockKeyhole} title="Privacy" description="What ImbaLink collects, stores and shares" onClick={() => setView("privacy")} />
              <Row icon={FileText} title="Terms of use" description="Rules for listings, messaging and accounts" onClick={() => setView("terms-summary")} />
              <Row icon={ShieldCheck} title="Safety & trust" description="Verification, scams, reporting and safer viewings" onClick={() => setView("safety")} />
            </Section>

            <Section title="App & data">
              <Row icon={Database} title="Data & storage" description="Local app data and offline preferences" onClick={() => setView("data")} />
              <Row icon={Info} title="About ImbaLink" description="Version, support and product information" value="v1.0.0" onClick={() => setView("about")} />
            </Section>

            <button type="button" onClick={resetPreferences} className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3" style={{ color: T.brick, background: "rgba(184,61,49,.08)", fontSize: 11, fontWeight: 700 }}>
              <RotateCcw size={14} /> Restore default app preferences
            </button>

            {notice && <div className="rounded-xl px-3 py-2 text-center f-body" style={{ background: T.paperDim, color: T.ink60, fontSize: 10.5 }}>{notice}</div>}
          </div>
        )}

        {view === "sounds" && <ChoiceView title="Notification tones" subtitle="Your notification sound is part of the ImbaLink identity." onBack={() => setView("main")} options={SOUND_OPTIONS} selected={sound} onSelect={chooseSound} />}
        {view === "language" && <ChoiceView title="Language" subtitle="English is currently the primary ImbaLink interface language." onBack={() => setView("main")} options={LANGUAGE_OPTIONS} selected={language} onSelect={chooseLanguage} />}
        {view === "privacy" && <LegalView title="Privacy" onBack={() => setView("main")}>
          <p>ImbaLink uses account, profile, listing and messaging information to provide the services you request.</p>
          <p>Your information should only be visible to people who need it for the relevant ImbaLink feature, subject to account permissions and platform controls.</p>
          <p>Do not publish passwords, private financial information, identity documents or other sensitive information in public listing descriptions or chats.</p>
          <p>You can use <strong>Report a problem</strong> and <strong>Help & safety</strong> from your Profile to raise concerns about privacy, abuse, scams or incorrect information.</p>
        </LegalView>}
        {view === "terms-summary" && <LegalView title="Terms & Conditions" onBack={() => setView("main")}>
          <div className="rounded-2xl p-4" style={{ background: T.paperDim, border: `1px solid ${T.line}` }}>
            <p style={{ color: T.ink }}>These Terms explain the rules for using ImbaLink, including accounts, property listings, messaging, verification, safety, payments, user content, moderation, privacy, Pro features and legal responsibilities.</p>
            <button type="button" onClick={openTerms} className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: T.jacaranda, color: "#fff", fontWeight: 700 }}>
              Read the full Terms & Conditions <ChevronRight size={15} />
            </button>
          </div>
          <p>By using ImbaLink, you agree to follow the applicable Terms and use the platform honestly, safely and lawfully.</p>
        </LegalView>}
        {view === "terms" && <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: T.paper }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${T.line}` }}>
            <div><div className="f-display font-bold" style={{ color: T.ink, fontSize: 18 }}>{legalDoc?.title || "ImbaLink Terms & Conditions"}</div><div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>{legalDoc?.version ? `Version ${legalDoc.version}` : "Latest published version"}{legalDoc?.effective_date ? ` · Effective ${legalDoc.effective_date}` : ""}</div></div>
            <button type="button" onClick={() => setView("terms-summary")} aria-label="Close full Terms & Conditions" style={{ color: T.ink60 }}><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-10 lg:px-20">
            <div className="mx-auto max-w-4xl f-body whitespace-pre-wrap" style={{ color: T.ink60, fontSize: 12, lineHeight: 1.75 }}>
              {legalLoading && <p>Loading the latest published Terms & Conditions…</p>}
              {legalError && <div className="rounded-xl p-3" style={{ background: "rgba(184,61,49,.08)", color: T.brick }}>{legalError}</div>}
              {!legalLoading && legalDoc && legalDoc.content}
              {!legalLoading && !legalDoc && !legalError && <p>The full Terms & Conditions are not available yet.</p>}
            </div>
          </div>
        </div>}
        {view === "safety" && <LegalView title="Safety & trust" onBack={() => setView("main")}>
          <p>Meet property owners or agents in safe conditions, tell someone where you are going, and avoid rushed decisions.</p>
          <p>Never send money simply because someone pressures you. Confirm the property, person, payment details and agreement before paying.</p>
          <p>Use verification information as a trust signal, not as a substitute for your own checks.</p>
          <p>If something feels suspicious, stop the conversation and use <strong>Report a problem</strong>. For immediate danger, contact the appropriate local emergency service.</p>
        </LegalView>}
        {view === "data" && <LegalView title="Data & storage" onBack={() => setView("main")}>
          <p>ImbaLink stores small preference values locally so your theme, notification choices and language preference can persist between sessions.</p>
          <p>Some app features also use native local storage and synchronisation so the mobile experience can reopen quickly.</p>
          <p>Restoring default preferences removes local preference values such as your selected theme, language and notification tone. It does not delete your account or cloud data.</p>
        </LegalView>}
        {view === "about" && <LegalView title="About ImbaLink" onBack={() => setView("main")}>
          <p><strong>ImbaLink</strong> connects people with properties, landlords, students, contractors, agents and related property services.</p>
          <p>Version 1.0.0</p>
          <p>For help, use the Help & safety area or Report a problem from your Profile.</p>
        </LegalView>}
      </div>
    </div>
  );
}

function ChoiceView({ title, subtitle, options, selected, onSelect, onBack }) {
  return <div className="p-5 overflow-y-auto max-h-[calc(92vh-76px)]">
    <button type="button" onClick={onBack} className="f-body mb-4" style={{ color: T.jacaranda, fontSize: 11, fontWeight: 700 }}>← Settings</button>
    <div className="f-display font-bold" style={{ color: T.ink, fontSize: 17 }}>{title}</div>
    <div className="f-body mt-1 mb-4" style={{ color: T.ink60, fontSize: 10.5 }}>{subtitle}</div>
    <div className="space-y-2">{options.map((option) => {
      const active = option.id === selected;
      return <button type="button" key={option.id} onClick={() => onSelect(option.id)} className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left" style={{ background: active ? T.paperDim : "transparent", border: `1px solid ${active ? T.line : "transparent"}`, opacity: option.available === false ? .58 : 1 }}>
        <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `1.5px solid ${active ? T.jacaranda : T.line}` }}>{active && <span className="w-2.5 h-2.5 rounded-full" style={{ background: T.jacaranda }} />}</span>
        <span className="flex-1"><span className="block f-body font-semibold" style={{ color: T.ink, fontSize: 12 }}>{option.label}</span><span className="block f-body mt-0.5" style={{ color: T.ink60, fontSize: 10 }}>{option.note}</span></span>
        {option.available === false && <span className="f-mono" style={{ color: T.ink60, fontSize: 8 }}>SOON</span>}
      </button>;
    })}</div>
  </div>;
}

function LegalView({ title, children, onBack }) {
  return <div className="p-5 overflow-y-auto max-h-[calc(92vh-76px)]">
    <button type="button" onClick={onBack} className="f-body mb-4" style={{ color: T.jacaranda, fontSize: 11, fontWeight: 700 }}>← Settings</button>
    <div className="f-display font-bold mb-4" style={{ color: T.ink, fontSize: 17 }}>{title}</div>
    <div className="space-y-3 f-body" style={{ color: T.ink60, fontSize: 11, lineHeight: 1.6 }}>{children}</div>
  </div>;
}
