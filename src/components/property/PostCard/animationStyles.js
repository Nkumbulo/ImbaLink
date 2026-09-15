// Updated stylesheet: pulse animation for the bookmark icon
export const LIKE_ANIM_STYLES = `
@keyframes interestPulse {
  0% { transform: scale(1); }
  30% { transform: scale(1.35); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}
.interest-pulse {
  animation: interestPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes interestTextFloat {
  0% { opacity: 0; transform: translateY(3px); }
  15% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}
.interest-toast-text {
  animation: interestTextFloat 1.6s ease forwards;
  white-space: nowrap;
}
`;
