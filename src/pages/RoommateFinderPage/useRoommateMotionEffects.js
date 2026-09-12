import { useEffect } from "react";

export function useRoommateMotionEffects({ heroSectionRef, animationWrapperRef, videoCardRef }) {
  useEffect(() => {
    const hero = heroSectionRef.current;
    const wrapper = animationWrapperRef.current;
    if (!hero || !wrapper) return;

    let rafId = null;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const dy = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetX = dx * 12;
      targetY = dy * 8;
    };
    const handleMouseLeave = () => { targetX = 0; targetY = 0; };
    const animate = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      wrapper.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
      rafId = requestAnimationFrame(animate);
    };

    hero.addEventListener("mousemove", handleMouseMove);
    hero.addEventListener("mouseleave", handleMouseLeave);
    rafId = requestAnimationFrame(animate);
    return () => {
      hero.removeEventListener("mousemove", handleMouseMove);
      hero.removeEventListener("mouseleave", handleMouseLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [heroSectionRef, animationWrapperRef]);

  useEffect(() => {
    const card = videoCardRef.current;
    if (!card) return;

    let rafId = null;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);
      targetX = dx * 12;
      targetY = dy * 12;
    };
    const handleMouseLeave = () => { targetX = 0; targetY = 0; };
    const animate = () => {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      card.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
      rafId = requestAnimationFrame(animate);
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    rafId = requestAnimationFrame(animate);
    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [videoCardRef]);
}
