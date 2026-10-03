/**
 * Guard for the optional question a user can ask alongside an image lookup.
 *
 * LookX answers questions about the IMAGE (is it stolen, AI-generated, edited,
 * a stock photo, reported, where else it appears). It never answers questions
 * about the PERSON in it (who they are, their relationships, where they live,
 * their age, or other personal or sensitive traits). Answering those would mean
 * identifying the person, which LookX doesn't do (see the strict boundary in the
 * product spec and the acceptable use policy).
 *
 * "Is this vendor legit?" / "Is this a scam?" stay in scope: they are answered
 * from reports and web evidence about the image, not by identifying anyone.
 *
 * This keyword guard is the first layer. The AI prompt (Phase 3) is the second:
 * it must also refuse person-level questions that slip past these patterns.
 *
 * Shared by the search box (instant feedback) and the API route (enforcement).
 */

export const MAX_QUESTION_LENGTH = 300;

/** Suggested questions shown as chips in the UI. All of them are in scope. */
export const SUGGESTED_QUESTIONS = [
  "Does this photo appear under other names?",
  "Is this photo AI-generated or edited?",
  "Is this a stock or catalog photo?",
  "Has this image been reported?",
] as const;

/** The in-scope question we suggest when a personal question is blocked. */
export const SAFE_ALTERNATIVE = SUGGESTED_QUESTIONS[0];

export type QuestionTopic =
  | "identity"
  | "relationship"
  | "location"
  | "contact"
  | "personal_attribute"
  | "sensitive_attribute";

export type QuestionCheck =
  | { allowed: true; question: string }
  | { allowed: false; topic: QuestionTopic | "too_long"; message: string };

// A reference to a person rather than to the image itself.
const PERSON = String.raw`(?:he|she|they|him|her|them|his|hers|their|this (?:person|guy|girl|man|woman|lady|boy|babe|dude|vendor|seller)|the (?:person|guy|girl|man|woman|lady|boy)|(?:this|that) (?:face|individual))`;

const RULES: { topic: QuestionTopic; pattern: RegExp }[] = [
  {
    topic: "identity",
    pattern: new RegExp(
      String.raw`\b(?:who(?:'s| is| are)\b|identify|identity|what(?:'s| is) (?:${PERSON}(?:'s)?|the) (?:real |full )?name|real name|full name|name of ${PERSON}|whose (?:face|photo|picture)|recogni[sz]e|find (?:${PERSON}|their|his|her) (?:profile|account|instagram|facebook|socials?|tiktok|linkedin))`,
      "i",
    ),
  },
  {
    topic: "relationship",
    pattern: new RegExp(
      String.raw`\b(?:married|marriage|marry|husband|wife|spouse|divorced?|engaged|fianc[eé]e?|girlfriend|boyfriend|cheating|cheat on|side ?(?:chick|guy|piece)|in a relationship|dating (?:someone|anyone)|have (?:a )?(?:kids|children)|is ${PERSON} single)\b`,
      "i",
    ),
  },
  {
    topic: "location",
    pattern: new RegExp(
      String.raw`\b(?:where (?:does|do|is|are) ${PERSON}|where ${PERSON} (?:live|stay|work)s?|home address|address of|(?:${PERSON}(?:'s)?) (?:address|location|house|workplace|office)|locate|track (?:${PERSON}|down))\b`,
      "i",
    ),
  },
  {
    topic: "contact",
    pattern: new RegExp(
      String.raw`\b(?:(?:${PERSON}(?:'s)?) (?:phone|number|email|whatsapp|contact)|contact (?:${PERSON})|reach (?:${PERSON}))\b`,
      "i",
    ),
  },
  {
    topic: "personal_attribute",
    pattern: new RegExp(
      String.raw`\b(?:how old|(?:${PERSON}(?:'s)?) (?:age|job|salary|income|family|parents|relatives|school)|what does ${PERSON} do|is ${PERSON} (?:rich|broke|a criminal))\b`,
      "i",
    ),
  },
  {
    topic: "sensitive_attribute",
    pattern: new RegExp(
      String.raw`\b(?:religion|muslim|christian|ethnicity|tribe|igbo|yoruba|hausa|gay|lesbian|sexuality|pregnant|hiv|sick|disease|disabled|criminal record|immigration status)\b`,
      "i",
    ),
  },
];

const MESSAGES: Record<QuestionTopic, string> = {
  identity:
    "LookX can't tell you who someone is. We show where an image appears online, not who a face belongs to.",
  relationship:
    "LookX can't tell you whether someone is married or in a relationship. That would mean identifying them and looking into their private life, which LookX doesn't do.",
  location:
    "LookX can't help find where someone lives or works. Using LookX to locate people is against our acceptable use policy.",
  contact:
    "LookX can't find someone's contact details from a photo.",
  personal_attribute:
    "LookX can't tell you personal details about the person in a photo. We check the image itself, not the person.",
  sensitive_attribute:
    "LookX doesn't make guesses about anyone's religion, ethnicity, health, sexuality or similar personal traits.",
};

/** Explains what LookX CAN do instead; appended to every blocked message. */
export const REDIRECT_HINT = `What we can check: whether this photo appears on other profiles or under other names, which is a common sign of a fake or catfish account.`;

export function checkImageQuestion(raw: string | null | undefined): QuestionCheck {
  const question = (raw ?? "").replace(/\s+/g, " ").trim();
  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      allowed: false,
      topic: "too_long",
      message: `Keep your question under ${MAX_QUESTION_LENGTH} characters.`,
    };
  }
  for (const rule of RULES) {
    if (rule.pattern.test(question)) {
      return { allowed: false, topic: rule.topic, message: MESSAGES[rule.topic] };
    }
  }
  return { allowed: true, question };
}
