/**
 * Live-activity ticker.
 *
 * DISABLED — renders nothing.
 *
 * It scrolled four hardcoded lines presented as real, timestamped activity:
 *
 *   "Rahul from Mumbai booked Satyanarayan Pooja with Pt. Ram Naresh · just now"
 *   "Neha from Hyderabad contacted Acharya Prem · 2 min ago"
 *   "Vikram from Delhi booked Griha Pravesh with Pt. Sharma · 5 min ago"
 *   "Priya from Pune left a 5-star review for Pt. Mishra · 12 min ago"
 *
 * None of it ever happened. The production database holds zero users, zero
 * pandits, zero bookings and zero reviews, so every one of those bookings,
 * contacts and 5-star reviews is fabricated social proof shown to real
 * visitors — on a platform that takes payments. That is a trust problem, not a
 * styling one, and it does not become true once there are real users either:
 * the strings are static.
 *
 * To bring it back, feed it a real recent-activity endpoint (anonymised —
 * first name and city only, never a full name or phone) and render nothing
 * when that endpoint returns an empty list, exactly as it does now.
 */
export function HeroTicker() {
  return null;
}
