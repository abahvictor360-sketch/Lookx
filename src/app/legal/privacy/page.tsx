import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How LookX collects, uses and protects personal data, in line with the Nigeria Data Protection Act 2023 and the GDPR.",
};

// NOTE FOR THE OPERATOR: replace [LookX legal entity] and the registered address,
// and have this reviewed by a lawyer before launch.
const ENTITY = "[LookX legal entity], [registered address], Nigeria";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="3 October 2026"
      intro={
        <>
          <p>
            LookX helps people check a phone number or image before they pay, date or trust someone. This policy
            explains what personal data we handle, why, and your rights under the <strong>Nigeria Data Protection Act
            2023 (NDPA)</strong> and, where it applies, the <strong>EU/UK General Data Protection Regulation (GDPR)</strong>.
          </p>
          <p>
            In short: we collect as little as we can, we never identify people from their face, uploaded images are
            deleted after 24 hours, and we never show who ran a lookup or who made a report.
          </p>
        </>
      }
      sections={[
        {
          id: "who",
          title: "Who we are",
          body: (
            <p>
              The data controller is {ENTITY} (&ldquo;LookX&rdquo;, &ldquo;we&rdquo;). You can reach us, including our Data
              Protection Officer, through the <Link href="/legal/data-request" className="text-brand underline">data request form</Link>.
            </p>
          ),
        },
        {
          id: "collect",
          title: "Data we collect",
          body: (
            <>
              <p><strong>When you use LookX</strong></p>
              <ul>
                <li>Account details: email address, and your name if you sign in with Google.</li>
                <li>Lookups: the phone numbers you check, images you upload or link to, any question you ask about an image, the results, and when you ran them. Lookups are logged against your account to deter misuse.</li>
                <li>Technical data: a keyed hash of your IP address (we don&apos;t store the address itself) and a random device identifier in a cookie, used to enforce free-use limits and prevent abuse.</li>
                <li>Reports you submit: the number or image, category, platform, your description and any screenshot.</li>
                <li>Payments: the product, amount and Paystack reference. Card and bank details go directly to Paystack; we never see or store them.</li>
                <li>Data requests and disputes: your email, phone number and what you tell us.</li>
              </ul>
              <p><strong>About people who are looked up</strong></p>
              <p>
                When someone checks a number or image, we gather what is already public (web pages, carrier and line
                data, where an image appears online) and LookX community reports. We do not compile addresses,
                relatives, ID numbers or similar details, and our automated summaries are instructed to leave them out.
                <strong> We do not use facial recognition</strong> and never identify who is in a photo.
              </p>
              <p>
                <strong>Photo metadata:</strong> we read the camera, date and editing software from an image&apos;s metadata.
                If a photo contains GPS location, we only note that it is present. We never store or show the location.
              </p>
            </>
          ),
        },
        {
          id: "use",
          title: "How we use data and our lawful bases",
          body: (
            <ul>
              <li><strong>Providing lookups, accounts, history and payments</strong>: performance of our contract with you.</li>
              <li><strong>Helping the public avoid fraud</strong> by summarising public sources and community reports: our legitimate interests and the public interest in fraud prevention, balanced by strict limits (no face identification, no personal details, a dispute process, neutral language).</li>
              <li><strong>Preventing abuse</strong> (rate limits, bans, flagging repeated lookups of the same number): legitimate interests.</li>
              <li><strong>Keeping payment records</strong>: legal obligations (tax and accounting).</li>
              <li><strong>Product analytics</strong>: legitimate interests, using cookieless, aggregated analytics.</li>
            </ul>
          ),
        },
        {
          id: "sharing",
          title: "Who we share data with",
          body: (
            <>
              <p>We use trusted service providers (data processors) who may only use data to provide their service to us:</p>
              <ul>
                <li>Supabase (database, authentication, file storage) and Vercel (hosting, cookieless analytics).</li>
                <li>Anthropic (AI summaries and image checks). Uploaded images and search results are sent for analysis, not used to train models.</li>
                <li>SerpAPI, Brave Search and TinEye (web and reverse image search); Abstract API and Twilio (number details and SMS verification codes).</li>
                <li>Paystack (payments).</li>
              </ul>
              <p>
                We don&apos;t sell personal data. We disclose data to authorities only when the law requires it.
                Shared result links never include who ran the lookup.
              </p>
            </>
          ),
        },
        {
          id: "transfers",
          title: "International transfers",
          body: (
            <p>
              Some providers process data outside Nigeria (for example in the EU or United States). Where we transfer
              personal data abroad we rely on the safeguards required by Part VIII of the NDPA and, for GDPR, on
              adequacy decisions or standard contractual clauses.
            </p>
          ),
        },
        {
          id: "retention",
          title: "How long we keep data",
          body: (
            <ul>
              <li>Uploaded images: deleted automatically after <strong>24 hours</strong>. We keep only a fingerprint (perceptual hash) so re-uploads of a reported image can be matched; it can&apos;t be turned back into the image.</li>
              <li>Lookup history: kept while your account is open (free accounts see the last 30 days). You can ask us to delete it.</li>
              <li>Rate-limit records: about 2 days. SMS verification records: up to 7 days.</li>
              <li>Reports: while they remain relevant, or until removed after a dispute or moderation. Rejected reports&apos; screenshots are deleted.</li>
              <li>Payment records: as long as tax law requires (generally up to 6 years).</li>
            </ul>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <>
              <p>Under the NDPA (sections 34 to 38) and the GDPR you can ask us to:</p>
              <ul>
                <li>give you a copy of your data, or move it to another service;</li>
                <li>correct inaccurate data, or delete it;</li>
                <li>restrict or object to how we use it, including object to processing based on legitimate interests;</li>
                <li>review reports about your phone number (or use the faster <Link href="/dispute" className="text-brand underline">dispute flow</Link>).</li>
              </ul>
              <p>
                Use the <Link href="/legal/data-request" className="text-brand underline">data request form</Link>. We reply within
                30 days and may need to confirm your identity. You can also complain to the{" "}
                <strong>Nigeria Data Protection Commission (NDPC)</strong>, or your local supervisory authority if you are in the EU/UK.
              </p>
            </>
          ),
        },
        {
          id: "security",
          title: "Security",
          body: (
            <p>
              Data is encrypted in transit, access to every table is restricted by row-level security, uploaded images
              are kept in private storage, API keys and secrets stay on our servers, and we hash IP addresses and
              search queries in our logs where possible. No system is perfect; if a breach affects you we will notify
              you and the NDPC as the law requires.
            </p>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: <p>LookX is for people aged 18 and over. We don&apos;t knowingly collect data from children.</p>,
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              We use essential cookies only: your sign-in session and a device identifier for free-use limits.
              Analytics is cookieless. Payment pages are provided by Paystack under its own policy.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          body: <p>If we make significant changes we&apos;ll update the date above and tell signed-in users.</p>,
        },
      ]}
    />
  );
}
