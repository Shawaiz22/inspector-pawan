import type { Role } from "./types";

/** Categories for nearby places that air quality letters can be addressed to. */
export type PlaceCategory = "industrial" | "construction" | "school" | "hospital" | "commercial" | "other";

/** A structured place entry with category tagging and optional contact details. */
export interface StructuredPlace {
  name: string;
  category: PlaceCategory;
  customCategory?: string | null;
  contact?: string | null;
}

/** Either a legacy plain string name or a rich structured place. */
export type PlaceEntry = string | StructuredPlace;

/** Category presets for UI display and selection. */
export const PLACE_CATEGORIES: ReadonlyArray<{ id: PlaceCategory; label: string; placeholder: string }> = [
  { id: "industrial", label: "Industrial / Factory", placeholder: "e.g. Govindpura Industrial Area, Boiler Plant" },
  { id: "construction", label: "Construction site", placeholder: "e.g. Metro Line 3 Pier 42 Site" },
  { id: "school", label: "School / College", placeholder: "e.g. St. Xavier Senior Secondary School" },
  { id: "hospital", label: "Hospital / Clinic", placeholder: "e.g. City Care Polyclinic & Trauma Center" },
  { id: "commercial", label: "Commercial / Market", placeholder: "e.g. New Market Wholesale Complex" },
  { id: "other", label: "Other", placeholder: "e.g. Timber Yard, Grain Depot, Bus Terminal" },
];

/** Normalizes any PlaceEntry into a consistent StructuredPlace. */
export function normalizePlace(place: PlaceEntry): StructuredPlace {
  if (typeof place === "string") {
    return { name: place.trim(), category: "other", customCategory: null, contact: null };
  }
  return {
    name: place.name.trim(),
    category: place.category || "other",
    customCategory: place.customCategory?.trim() || null,
    contact: place.contact?.trim() || null,
  };
}

/** Extracts just the display name of a place entry. */
export function placeName(place: PlaceEntry): string {
  return typeof place === "string" ? place.trim() : place.name.trim();
}

/** Formats a place entry into a concise description for the Gemini prompt. */
export function placePromptDescription(place: PlaceEntry): string {
  if (typeof place === "string") return place.trim();
  const catLabel = place.category === "other" && place.customCategory
    ? `Other (${place.customCategory})`
    : place.category;
  return `${place.name} (type: ${catLabel})`;
}

/** Normalizes a contact string to digits-only for WhatsApp deep links, or returns null if not a valid phone. */
export function toWhatsAppNumber(contact: string | null | undefined): string | null {
  if (!contact) return null;
  const digits = contact.replace(/\D/g, "");
  // Needs at least 10 digits to be a phone number
  return digits.length >= 10 ? digits : null;
}

/** Returns email address if contact string looks like an email. */
export function toEmailAddress(contact: string | null | undefined): string | null {
  if (!contact) return null;
  const trimmed = contact.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** Quick chips for "Other" role controls to help users specify what they control. */
export const OTHER_CONTROLS_CHIPS: readonly string[] = [
  "Dust misting / wet cleaning",
  "Outdoor schedules & sports",
  "Air filters & purifiers",
  "Public advisories & notices",
  "Shift & operating hours",
  "Vehicle & parking rules",
  "Waste burning enforcement",
];

/** Contextual place name placeholders based on workspace role. */
export function rolePlacePlaceholder(role: Role): string {
  switch (role) {
    case "ward_officer":
      return "e.g. Ward 12, Kolar Road";
    case "school":
      return "e.g. Delhi Public School, Sector 4";
    case "housing_society":
      return "e.g. Gulmohar Enclave Residents Welfare Association";
    case "other":
      return "e.g. City Health Polyclinic or Metro Station 5";
  }
}
