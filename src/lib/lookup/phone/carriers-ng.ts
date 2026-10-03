/**
 * Original network for a Nigerian mobile number, from its NCC-assigned prefix.
 * Numbers can be ported between networks, so this is the ORIGINAL allocation,
 * shown with a caveat. Abstract/Twilio data (when configured) takes priority.
 *
 * Keys are the leading digits of the national significant number
 * (e.g. 0803 123 4567 -> "803"). 4-digit keys are checked before 3-digit ones.
 */
const PREFIXES: Record<string, string> = {
  // MTN
  "803": "MTN", "806": "MTN", "703": "MTN", "706": "MTN", "813": "MTN", "816": "MTN",
  "810": "MTN", "814": "MTN", "903": "MTN", "906": "MTN", "913": "MTN", "916": "MTN",
  "704": "MTN", "7025": "MTN", "7026": "MTN",
  // Glo
  "805": "Glo", "807": "Glo", "705": "Glo", "815": "Glo", "811": "Glo", "905": "Glo", "915": "Glo",
  // Airtel
  "802": "Airtel", "808": "Airtel", "708": "Airtel", "812": "Airtel", "701": "Airtel",
  "902": "Airtel", "901": "Airtel", "904": "Airtel", "907": "Airtel", "912": "Airtel", "911": "Airtel",
  // 9mobile
  "809": "9mobile", "818": "9mobile", "817": "9mobile", "909": "9mobile", "908": "9mobile",
  // Others
  "804": "Ntel",
};

export function nigerianNetworkFromPrefix(nationalNumber: string): string | null {
  return PREFIXES[nationalNumber.slice(0, 4)] ?? PREFIXES[nationalNumber.slice(0, 3)] ?? null;
}
