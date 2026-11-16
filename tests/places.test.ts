import { describe, expect, it } from "vitest";
import {
  normalizePlace,
  placeName,
  placePromptDescription,
  rolePlacePlaceholder,
  toEmailAddress,
  toWhatsAppNumber,
  type StructuredPlace,
} from "@/lib/places";
import { createWorkspaceRequest } from "@/lib/api/schemas";

describe("lib/places", () => {
  it("normalizes a string place into a StructuredPlace", () => {
    const normalized = normalizePlace("Govindpura Industrial Area");
    expect(normalized).toEqual({
      name: "Govindpura Industrial Area",
      category: "other",
      customCategory: null,
      contact: null,
    });
  });

  it("preserves structured place properties with trimming", () => {
    const input: StructuredPlace = {
      name: "  St. Xavier Senior Secondary  ",
      category: "school",
      customCategory: null,
      contact: "  +91 9876543210  ",
    };
    const normalized = normalizePlace(input);
    expect(normalized.name).toBe("St. Xavier Senior Secondary");
    expect(normalized.category).toBe("school");
    expect(normalized.contact).toBe("+91 9876543210");
  });

  it("formats place description for Gemini prompt", () => {
    expect(placePromptDescription("Govindpura")).toBe("Govindpura");

    expect(
      placePromptDescription({
        name: "Metro Pier 42",
        category: "construction",
        customCategory: null,
        contact: null,
      }),
    ).toBe("Metro Pier 42 (type: construction)");

    expect(
      placePromptDescription({
        name: "Timber Mart",
        category: "other",
        customCategory: "Sawmill & wood cutting",
        contact: null,
      }),
    ).toBe("Timber Mart (type: Other (Sawmill & wood cutting))");
  });

  it("extracts clean phone number for WhatsApp deep link", () => {
    expect(toWhatsAppNumber("+91 98765 43210")).toBe("919876543210");
    expect(toWhatsAppNumber("9876543210")).toBe("9876543210");
    expect(toWhatsAppNumber("123")).toBeNull(); // too short
    expect(toWhatsAppNumber(null)).toBeNull();
  });

  it("validates email contact strings", () => {
    expect(toEmailAddress("ward12@citycorp.gov.in")).toBe("ward12@citycorp.gov.in");
    expect(toEmailAddress("not an email")).toBeNull();
    expect(toEmailAddress(null)).toBeNull();
  });

  it("provides contextual placeholders for workspace roles", () => {
    expect(rolePlacePlaceholder("ward_officer")).toContain("Ward");
    expect(rolePlacePlaceholder("school")).toContain("School");
    expect(rolePlacePlaceholder("housing_society")).toContain("Residents");
    expect(rolePlacePlaceholder("other")).toContain("Polyclinic");
  });

  it("validates workspace creation with both string and structured places in schema", () => {
    const valid = createWorkspaceRequest.safeParse({
      role: "ward_officer",
      name: "Ward 12 Office",
      places: [
        "Plain text place",
        {
          name: "City Hospital",
          category: "hospital",
          contact: "+919876543210",
        },
        {
          name: "Wood Mill",
          category: "other",
          customCategory: "Sawmill",
        },
      ],
    });
    expect(valid.success).toBe(true);
  });
});
