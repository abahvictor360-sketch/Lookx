import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using LookX, including our acceptable use policy.",
};

// NOTE FOR THE OPERATOR: replace [LookX legal entity] and have these terms
// reviewed by a lawyer before launch.

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="3 October 2026"
      intro={
        <p>
          These terms are an agreement between you and [LookX legal entity] (&ldquo;LookX&rdquo;). By using LookX you
          agree to them. Please read the <a href="#aup" className="text-brand underline">acceptable use policy</a> in particular:
          breaking it leads to a ban.
        </p>
      }
      sections={[
        {
          id: "service",
          title: "What LookX does",
          body: (
            <>
              <p>
                LookX checks phone numbers and images against public web sources, lookup services and community reports,
                and shows a <strong>risk indicator, not a verdict</strong>. Results can be incomplete, out of date or wrong.
                A low risk result doesn&apos;t prove a number or person is trustworthy, and a high one doesn&apos;t prove
                wrongdoing. Use LookX as one input to your own judgement.
              </p>
              <p>LookX shows where an image appears online. It never identifies who a person in a photo is.</p>
            </>
          ),
        },
        {
          id: "eligibility",
          title: "Eligibility and accounts",
          body: (
            <ul>
              <li>You must be 18 or older.</li>
              <li>Keep your sign-in secure. You&apos;re responsible for activity on your account.</li>
              <li>One person, one account. Don&apos;t create accounts to get around limits or bans.</li>
            </ul>
          ),
        },
        {
          id: "aup",
          title: "Acceptable use policy",
          body: (
            <>
              <p>You may use LookX to protect yourself and others from scams, fake vendors, impersonation and stolen photos. You must not:</p>
              <ul>
                <li><strong>stalk, harass, threaten, or locate any person</strong>, or use LookX to track someone&apos;s movements, relationships or whereabouts;</li>
                <li>try to identify a person from their face, or to find out private facts about them (such as relationship status, address, religion, ethnicity or health);</li>
                <li>use results to discriminate unlawfully, or for employment, credit, tenancy or insurance decisions without the checks the law requires;</li>
                <li>submit false, malicious or retaliatory reports, or reports about matters you didn&apos;t experience;</li>
                <li>upload images you have no right to use, or illegal content;</li>
                <li>scrape LookX, automate lookups outside the official API, share accounts, or get around rate limits and free-use limits;</li>
                <li>attempt to break, overload or probe the security of the service.</li>
              </ul>
              <p>
                We monitor for misuse (for example, the same number being looked up repeatedly). We may suspend or ban
                accounts that break this policy, without refund, and report unlawful use to the authorities.
              </p>
            </>
          ),
        },
        {
          id: "reports",
          title: "Community reports",
          body: (
            <ul>
              <li>Reports must be truthful, factual and based on your own experience. Don&apos;t include other people&apos;s private details.</li>
              <li>You give LookX permission to publish your report (without your identity) and to edit or remove it.</li>
              <li>Reports may be moderated before or after publication. Owners of a reported number can <Link href="/dispute" className="text-brand underline">dispute</Link> it; moderators decide.</li>
              <li>We never show who made a report, but may disclose it if the law requires.</li>
            </ul>
          ),
        },
        {
          id: "payments",
          title: "Plans, credits and payments",
          body: (
            <ul>
              <li>Payments are processed by Paystack. Prices are shown in Naira on the <Link href="/pricing" className="text-brand underline">pricing page</Link>.</li>
              <li>Starter credits don&apos;t expire and are used after your monthly free lookups. Credits have no cash value.</li>
              <li>Pro renews monthly until cancelled. If you cancel, Pro stays active until the end of the period you paid for.</li>
              <li>Purchases are non-refundable except where the law requires, or where a lookup failed because of an error on our side, in which case we&apos;ll restore the credit.</li>
            </ul>
          ),
        },
        {
          id: "business",
          title: "Business accounts and API",
          body: (
            <p>
              Business accounts may use the LookX API and bulk lookups for verifying customers, agents or riders,
              subject to these terms, any order form, and a legitimate purpose. Keep API keys secret; you&apos;re
              responsible for all use of your keys and team seats.
            </p>
          ),
        },
        {
          id: "ip",
          title: "Our content",
          body: <p>LookX, its software and design belong to us. Search results link to third-party sites we don&apos;t control.</p>,
        },
        {
          id: "liability",
          title: "Disclaimers and liability",
          body: (
            <p>
              LookX is provided &ldquo;as is&rdquo;. To the extent the law allows, we aren&apos;t liable for losses from
              decisions you make based on results, or for indirect losses, and our total liability is limited to the
              amount you paid us in the 12 months before the claim. Nothing in these terms limits liability that can&apos;t
              be limited by law, or your rights as a consumer.
            </p>
          ),
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of the Federal Republic of Nigeria. Disputes go to the courts of Lagos State, unless consumer law gives you another choice.</p>,
        },
        {
          id: "changes",
          title: "Changes",
          body: <p>We may update these terms. If changes are significant we&apos;ll tell signed-in users before they take effect.</p>,
        },
      ]}
    />
  );
}
