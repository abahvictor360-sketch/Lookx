import { describe, expect, it } from "vitest";
import { detectInput, normalizePhone, validateImageFile } from "../detect";

describe("normalizePhone", () => {
  it.each([
    "08031234567",
    "+2348031234567",
    "234 803 123 4567",
    "2348031234567",
    "0803-123-4567",
    "(0803) 123 4567",
    "002348031234567",
  ])("normalises %s to E.164", (input) => {
    expect(normalizePhone(input)?.e164).toBe("+2348031234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("0800000")).toBeNull();
  });

  it("handles non-Nigerian international numbers", () => {
    expect(normalizePhone("+44 20 7946 0958")?.country).toBe("GB");
  });
});

describe("detectInput", () => {
  it("detects phone numbers", () => {
    expect(detectInput("0803 123 4567")).toMatchObject({ kind: "phone", e164: "+2348031234567" });
  });
  it("flags invalid phone-like input", () => {
    expect(detectInput("0801").kind).toBe("unknown");
    expect(detectInput("080312345").kind).toBe("invalid_phone");
  });
  it("detects image URLs", () => {
    expect(detectInput("https://example.com/a.jpg")).toEqual({ kind: "image_url", url: "https://example.com/a.jpg" });
  });
  it("explains the face-identification limit", () => {
    expect(detectInput("who is this girl").kind).toBe("person_query");
  });
  it("handles empty input", () => {
    expect(detectInput("   ").kind).toBe("empty");
  });
});

describe("validateImageFile", () => {
  it("accepts allowed types under 10MB", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
  });
  it("rejects other types and big files", () => {
    expect(validateImageFile({ type: "image/gif", size: 1000 })).not.toBeNull();
    expect(validateImageFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).not.toBeNull();
  });
});
