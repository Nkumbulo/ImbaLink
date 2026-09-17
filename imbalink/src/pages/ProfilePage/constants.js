import { Building2, Wrench, Handshake, Landmark } from "lucide-react";
import { T } from "../../styles/tokens";

export const GOLD = T.gold ?? "#C9A24B";

// Ecosystem hubs — order controls render order below.
export const HUBS = [
  {
    tab: "landlord",
    hubType: "landlord",
    dark: true,
    iconBg: T.brick,
    icon: Building2,
    title: "Landlord Hub",
    subtitle: "Listings, tenants & viewing requests",
  },
  {
    tab: "contractors",
    hubType: "contractor",
    iconBg: T.jacaranda,
    icon: Wrench,
    title: "Contractor Hub",
    subtitle: "Find maintenance & property services",
  },
  {
    tab: "agent",
    hubType: "agent",
    iconBg: GOLD,
    icon: Handshake,
    title: "Agent Hub",
    subtitle: "Manage listings & client leads",
  },
  {
    tab: "company",
    hubType: "company",
    iconBg: T.teal ?? "#3E7C7C",
    icon: Landmark,
    title: "Company Hub",
    subtitle: "Agency accounts & team management",
  },
];

export const SETTINGS_ROWS = ["Theme", "Notification preferences", "Report a problem", "Help & safety"];

export const THEMES = [
  { id: "classic", name: "Imba Green", description: "The signature ImbaLink green", color: "#2F7A55", soft: "#E7F0EA", deep: "#204F3A", surface: "#FBF8F0", surface2: "#F1EBDB", surface3: "#E9E1CB", ink: "#14201A", muted: "#62695F", line: "#E7DFC9", navText: "#FFFFFF", rgb: "47,122,85" },
  { id: "ocean", name: "Coastal Blue", description: "Fresh blue with a calm, modern feel", color: "#287C86", soft: "#E4F1F2", deep: "#1D5961", surface: "#F7FAF9", surface2: "#EAF2F1", surface3: "#DDEAE8", ink: "#142325", muted: "#617073", line: "#D8E4E2", navText: "#FFFFFF", rgb: "40,124,134" },
  { id: "blush", name: "Blush Rose", description: "A soft feminine rose palette with warm neutrals", color: "#B85C7A", soft: "#F8E8EE", deep: "#873F5A", surface: "#FFF9FA", surface2: "#F7ECEF", surface3: "#F0DEE5", ink: "#2B1D24", muted: "#75666D", line: "#EAD7DE", navText: "#FFFFFF", rgb: "184,92,122" },
  { id: "liquid", name: "Imba Liquid Glass", description: "A dark translucent glass theme with soft depth and refraction", color: "#8B9CFF", soft: "rgba(255,255,255,.10)", deep: "#080B14", surface: "#070A11", surface2: "rgba(255,255,255,.075)", surface3: "#111728", ink: "#F5F7FF", muted: "#A8B0C4", line: "rgba(255,255,255,.14)", navText: "#FFFFFF", rgb: "139,156,255" },
];

// Resolves a consistent identity from `profile` (persisted db profile) with
// `user` (live auth session) as a fallback — so the header, avatar, and sign-out
// button never disagree about who's signed in.
export function resolveIdentity(profile, user) {
  const name = profile?.name || user?.name || profile?.firstName || user?.firstName || null;
  const firstName = profile?.firstName || user?.firstName || (profile?.name || user?.name || "").split(" ")[0] || null;
  const initial = (firstName || name || "U").charAt(0).toUpperCase();
  // Set for Google accounts; empty for business credential sign-ins, in which
  // case Avatar keeps drawing the initial.
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl || "";
  return { name, firstName, initial, avatarUrl };
}

// Priority order when a user holds more than one role — highest listed wins.
export function resolveAccountLabel({ companyRegistration, agentRegistration, landlordRegistration, contractorRegistration, studentMode }) {
  if (companyRegistration) return "Company Account";
  if (agentRegistration) return "Agent Account";
  if (landlordRegistration) return "Landlord Account";
  if (contractorRegistration) return "Contractor Account";
  if (studentMode) return "Student Account";
  return "Tenant Account";
}
