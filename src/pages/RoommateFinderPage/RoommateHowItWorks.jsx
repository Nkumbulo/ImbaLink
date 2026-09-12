import React from "react";

export default function RoommateHowItWorks() {
  return (
        <section className="rf-section">
          <div className="rf-section-head">
            <div>
              <h2>How it works</h2>
              <p>Turn a good match into a joint rental plan.</p>
            </div>
          </div>
          <div className="rf-how">
            {[
              ["01", "Set your preferences", "Tell us your budget, area and accommodation type."],
              ["02", "Find a match", "Browse recommended students or search for someone specific."],
              ["03", "Message or connect", "Talk inside ImbaLink before agreeing to anything."],
              ["04", "Explore homes together", "Once you've matched, explore student accommodation together."],
            ].map(([number, title, text]) => (
              <div className="rf-step" key={number}>
                <div className="rf-step-num">{number}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>
  );
}
