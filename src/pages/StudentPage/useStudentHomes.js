import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { backend } from "../../application/backend/index.js";
import { isStudentAccommodation } from "../../utils/studentHelpers";

let savedStudentScrollTop = 0;

export function useStudentHomes({ properties, user }) {
  const [universities, setUniversities] = useState([]);
  const [university, setUniversity] = useState(() => user?.studentProfile?.university || "");
  const [area, setArea] = useState("Any area");
  const [shareableOnly, setShareableOnly] = useState(false);
  const [showUniversity, setShowUniversity] = useState(false);

  const universityButtonRef = useRef(null);
  const campusCardRef = useRef(null);

  useEffect(() => {
    let active = true;
    backend.studentRepository.getUniversities().then((rows) => {
      if (!active) return;
      setUniversities(rows);
      if (!university && rows[0]) setUniversity(rows[0].name);
    }).catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = user?.studentProfile?.university;
    if (stored && universities.some((u) => u.name === stored)) setUniversity(stored);
  }, [user?.studentProfile?.university, universities]);

  const selectedUniversity = useMemo(
    () => universities.find((u) => u.name === university) || null,
    [universities, university]
  );
  const campusCity = selectedUniversity?.city || "";

  const cityProperties = useMemo(() => {
    const source = Array.isArray(properties) ? properties : [];
    return source
      .filter((p) => campusCity && p && String(p.city || "").toLowerCase() === campusCity.toLowerCase())
      .filter(isStudentAccommodation);
  }, [properties, campusCity]);

  const areaOptions = useMemo(() => {
    const suburbs = Array.from(new Set(cityProperties.map((p) => p.suburb).filter(Boolean))).sort();
    return ["Any area", ...suburbs];
  }, [cityProperties]);

  useEffect(() => {
    setArea("Any area");
  }, [campusCity]);

  const homes = useMemo(() => {
    return cityProperties
      .filter((p) => area === "Any area" || p.suburb === area)
      .filter((p) => !shareableOnly || Number(p.rooms) >= 2)
      .slice()
      .sort((a, b) => Number(a.rent || 0) - Number(b.rent || 0))
      .slice(0, 9);
  }, [cityProperties, area, shareableOnly]);

  const restoredScrollRef = useRef(false);
  useLayoutEffect(() => {
    const container = document.querySelector(".app-main-shell");
    if (!container) return;

    if (!restoredScrollRef.current && savedStudentScrollTop > 0) {
      container.scrollTop = savedStudentScrollTop;
      if (homes.length > 0 || universities.length > 0) restoredScrollRef.current = true;
    }

    let raf = null;
    const handleScroll = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        savedStudentScrollTop = container.scrollTop;
        raf = null;
      });
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [homes.length, universities.length]);

  // noveatech.debug: Toggle university dropdown and scroll the campus card (with label) to top when opening.
  const handleUniversityToggle = () => {
    if (!showUniversity) {
      // noveatech.debug: Scroll the whole campus card so the "Choose your university" label is visible too.
      campusCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    setShowUniversity((v) => !v);
  };

  return {
    universities, university, setUniversity,
    area, setArea, shareableOnly, setShareableOnly,
    showUniversity, setShowUniversity, handleUniversityToggle,
    universityButtonRef, campusCardRef,
    selectedUniversity, campusCity,
    areaOptions, homes,
  };
}
