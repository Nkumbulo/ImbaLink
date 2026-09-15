import { Phone, MessageCircle, Facebook, Instagram } from "lucide-react";
import { T } from "../../../styles/tokens";

export const shareProperty = async (p) => {
  const propertyId = p?.id;
  if (!propertyId) return;
  const url = `${window.location.origin}/?property=${encodeURIComponent(String(propertyId))}`;
  const title = p?.title || p?.type || "Property on ImbaLink";
  const text = `${title}\nView on ImbaLink`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(url);
      window.dispatchEvent(new CustomEvent("imbalink:toast", {
        detail: { message: "Property link copied — View on ImbaLink" }
      }));
    }
  } catch (error) {
    if (error?.name !== "AbortError") console.warn("Property share failed:", error);
  }
};

export const digitsOnly = (v) => (v ? String(v).replace(/[^\d]/g, "") : "");
export const telDigits = (v) => {
  if (!v) return "";
  const trimmed = String(v).trim();
  const hasPlus = trimmed.startsWith("+");
  return (hasPlus ? "+" : "") + trimmed.replace(/[^\d]/g, "");
};
export const stripHandle = (v) => (v ? String(v).replace(/^@/, "").trim() : "");

export function buildContactMethods(p) {
  const methods = [];
  const phone = p.phone || p.phoneNumber || "";
  const waSource = p.whatsapp || p.whatsappNumber || phone;
  const messenger = p.messenger || p.messengerUsername || p.facebook || "";
  const instagram = p.instagram || p.instagramHandle || "";

  if (phone) {
    methods.push({
      id: "call",
      label: "Call",
      value: phone,
      href: `tel:${telDigits(phone)}`,
      Icon: Phone,
      iconBg: T.ink,
    });
  }
  if (waSource) {
    const text = encodeURIComponent(
      `Hi ${p.landlord || "there"}, I'm interested in your listing "${p.title || ""}" on ImbaLink.`
    );
    methods.push({
      id: "whatsapp",
      label: "WhatsApp",
      value: phone || waSource,
      href: `https://wa.me/${digitsOnly(waSource)}?text=${text}`,
      Icon: MessageCircle,
      iconBg: "#25D366",
    });
  }
  if (messenger) {
    methods.push({
      id: "messenger",
      label: "Messenger",
      value: `@${stripHandle(messenger)}`,
      href: `https://m.me/${stripHandle(messenger)}`,
      Icon: Facebook,
      iconBg: "#0084FF",
    });
  }
  if (instagram) {
    methods.push({
      id: "instagram",
      label: "Instagram",
      value: `@${stripHandle(instagram)}`,
      href: `https://instagram.com/${stripHandle(instagram)}`,
      Icon: Instagram,
      iconBg: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4)",
    });
  }
  return methods;
}

// 🔥 Helper to safely check listing verification (prevents crash from boolean values)
export const isListingVerified = (p) =>
  p?.verification === "verified" || p?.verified === true || p?.verificationStatus === "verified";
