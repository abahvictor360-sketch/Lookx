import { describe, expect, it } from "vitest";
import { checkImageQuestion, MAX_QUESTION_LENGTH, SUGGESTED_QUESTIONS } from "../question";

describe("checkImageQuestion", () => {
  it.each([
    ["is this person married", "relationship"],
    ["Is she married?", "relationship"],
    ["does he have a wife", "relationship"],
    ["is this guy single", "relationship"],
    ["is he cheating on me", "relationship"],
    ["who is this", "identity"],
    ["what is her real name", "identity"],
    ["find her instagram", "identity"],
    ["where does he live", "location"],
    ["what is his phone number", "contact"],
    ["how old is she", "personal_attribute"],
    ["what does he do for work", "personal_attribute"],
    ["is she muslim", "sensitive_attribute"],
  ])("blocks %j (%s)", (q, topic) => {
    const r = checkImageQuestion(q);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.topic).toBe(topic);
  });

  it.each([
    ...SUGGESTED_QUESTIONS,
    "Is this vendor legit?",
    "Is this a scam?",
    "is this photo stolen from someone else",
    "Is this picture photoshopped?",
    "Is this iPhone listing photo real?",
    "Has this image been used on Jiji before?",
    "Is this a wedding photo from another site?",
    "",
  ])("allows %j", (q) => {
    expect(checkImageQuestion(q).allowed).toBe(true);
  });

  it("rejects overly long questions", () => {
    expect(checkImageQuestion("a".repeat(MAX_QUESTION_LENGTH + 1))).toMatchObject({ allowed: false, topic: "too_long" });
  });

  it("normalises whitespace", () => {
    expect(checkImageQuestion("  is   this AI?  ")).toEqual({ allowed: true, question: "is this AI?" });
  });
});
