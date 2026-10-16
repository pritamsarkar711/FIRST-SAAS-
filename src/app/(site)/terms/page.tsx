export const metadata = { title: "Terms of Service" };

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Acceptance",
    p: [
      "By creating an Audit Form account or using the service you agree to these Terms of Service. If you do not agree, do not use the service. These terms apply to all plans, tools and features.",
    ],
  },
  {
    h: "2. The service",
    p: [
      "Audit Form analyzes publicly accessible websites and produces an estimate of approval readiness for advertising networks such as Google AdSense, Ezoic, Mediavine and Raptive. Results are informational estimates, not guarantees. Audit Form is not affiliated with, endorsed by, or acting on behalf of Google or any ad network.",
      "Final approval decisions are always made by the ad networks themselves. We do not control and cannot promise any outcome.",
    ],
  },
  {
    h: "3. Accounts",
    p: [
      "You must provide accurate information, keep your password confidential, and are responsible for activity under your account. One person or company may hold one primary account unless we agree otherwise in writing.",
      "We may suspend accounts that abuse the service: automated bulk scraping of the audit engine, attempts to audit sites you do not have a legitimate interest in, circumventing credit limits, or reselling reports commercially without consent.",
    ],
  },
  {
    h: "4. Credits and payments",
    p: [
      "Plans grant credits that are consumed by audits, generated articles and index submissions. Credits are valid indefinitely but are non-transferable between accounts.",
      "Payments are processed through the gateways shown at checkout. Manual gateway payments (for example bKash, Nagad or Rocket send-money) require a valid transaction ID and are credited after verification. Providing a false transaction ID is fraud and leads to permanent suspension.",
    ],
  },
  {
    h: "5. Acceptable use of the content writer",
    p: [
      "Generated articles are drafts for you to review, edit and publish under your own name and responsibility. You are responsible for the accuracy, legality and originality of anything you publish.",
      "You may not use the writer to produce spam, misleading medical or financial claims, content that impersonates real people, or content that violates the policies of the platforms you publish on.",
    ],
  },
  {
    h: "6. Affiliate program",
    p: [
      "Commission is earned on verified, non-refunded payments made by customers who registered through your referral link. Self-referrals, fake accounts and incentivized signups are void. Commission rates are configurable and may change with notice. Withdrawals are processed after review.",
    ],
  },
  {
    h: "7. Liability",
    p: [
      "The service is provided as is. To the maximum extent permitted by law, Audit Form is not liable for indirect or consequential damages, lost revenue, rejected applications, or losses arising from reliance on audit results. Total liability is limited to the amount you paid in the 12 months before the claim.",
    ],
  },
  {
    h: "8. Changes",
    p: [
      "We may update these terms. Material changes are announced on the site or by email at least 14 days before taking effect. Continued use after that date means acceptance.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {SECTIONS.map((s) => (
          <div key={s.h} className="mb-8">
            <h2 className="text-lg font-bold text-foreground">{s.h}</h2>
            {s.p.map((p, i) => <p key={i} className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{p}</p>)}
          </div>
        ))}
      </section>
    </>
  );
}
