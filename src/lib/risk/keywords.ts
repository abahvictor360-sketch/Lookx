/** Scam-related phrases that flag a web mention. Matched case-insensitively. */
const SCAM_PATTERN =
  /\b(scam(?:mer|mers|med)?|fraud(?:ster|sters|ulent)?|fake|419|beware|yahoo ?boys?|impost[eo]r|swindl\w*|ripped off|con ?(?:man|artist)|don'?t pay|do not pay|stole my money|blocked me after (?:payment|paying))\b/i;

export function isScamText(text: string) {
  return SCAM_PATTERN.test(text);
}
