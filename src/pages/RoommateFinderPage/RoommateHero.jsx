import { ArrowLeft, Search, Play, Users } from "lucide-react";
import AccommodationNetworkAnimation from "../../components/property/AccommodationNetworkAnimation";
import { ROOMMATE_TUTORIAL_VIDEO_ID } from "./helpers";

export default function RoommateHero({ focusProperty, onClearPropertyFocus, heroSectionRef, animationWrapperRef, videoCardRef, videoPlaying, setVideoPlaying }) {
  return (
      <section className="rf-hero" ref={heroSectionRef}>
        <div className="rf-hero-vectors-wrap" ref={animationWrapperRef}>
          <AccommodationNetworkAnimation className="rf-hero-vectors" />
        </div>
        <div className="rf-hero-inner">
          <div className="rf-hero-copy">
            <div className="rf-eyebrow"><Users size={14} /> ImbaLink Students</div>
            {focusProperty ? (
              <>
                <h1>Looking to share this place?</h1>
                <p>These students are interested in sharing {focusProperty.title || "this property"}. Browse their profiles and choose who you'd like to talk to.</p>
                <button type="button" className="rf-hero-cta" onClick={() => { onClearPropertyFocus?.(); }}>
                  <ArrowLeft size={16} /> Back
                </button>
              </>
            ) : (
              <>
                <h1>Find a Roommate</h1>
                <p>Find a student who matches your accommodation preferences and lifestyle — then take the conversation into a place together.</p>
                <button type="button" className="rf-hero-cta" onClick={() => document.getElementById("rf-discover")?.scrollIntoView({ behavior: "smooth" })}>
                  <Search size={16} /> Find My Match
                </button>
              </>
            )}
          </div>
          <div className="rf-hero-video">
            <div className="rf-hero-video-card" ref={videoCardRef}>
              {/* ImbaLink Guide UI */}
              <div className="rf-hero-video-topbar">
                <span className="rf-hero-video-brand">
                  <span className="rf-hero-video-mark"><Play size={11} fill="currentColor" /></span>
                  ImbaLink Guide
                </span>
                <span className="rf-hero-video-pill"><span className="rf-hero-video-dot" /> Tutorial</span>
              </div>
              <div className="rf-hero-video-frame">
                {!videoPlaying ? (
                  <button type="button" className="rf-hero-video-thumb-button" onClick={() => setVideoPlaying(true)} aria-label="Play tutorial">
                    <img
                      className="rf-hero-video-thumb"
                      src={`https://img.youtube.com/vi/${ROOMMATE_TUTORIAL_VIDEO_ID}/hqdefault.jpg`}
                      alt="Tutorial thumbnail"
                    />
                    <div className="rf-hero-video-play">
                      <Play size={30} color="white" fill="white" />
                    </div>
                  </button>
                ) : (
                  <iframe
                    className="rf-hero-video-iframe"
                    src={`https://www.youtube.com/embed/${ROOMMATE_TUTORIAL_VIDEO_ID}?autoplay=1&rel=0`}
                    title="How to find a roommate — tutorial"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
