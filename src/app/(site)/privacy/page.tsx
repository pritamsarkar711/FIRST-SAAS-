export const metadata = { title: "Privacy Policy" };

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "What we collect",
    p: [
      "Account data: your name, email address and password hash. If you sign in with Google, we receive your name, email and profile image.",
      "Audit data: the domains you audit and the crawl results and reports generated for them. The crawl only requests pages any visitor could see; it does not log into your site or read private data.",
      "Usage data: credit consumption, tool inputs (keywords, links you provide), and payment records where applicable.",
    ],
  },
  {
    h: "What we do not do",
    p: [
      "We do not sell your personal data. We do not run third-party advertising trackers on this site. We do not read your email, analytics, or Search Console, and the audit never requires access to your accounts.",
    ],
  },
  {
    h: "How data is used",
    p: [
      "To run audits and tools, maintain your report history, process payments, prevent abuse, and answer support messages. Article generation sends your keyword and link list to our AI providers, who process it solely to produce your output.",
    ],
  },
  {
    h: "Retention and deletion",
    p: [
      "Reports are kept until you delete them. You can delete individual audits from your dashboard or request full account deletion by contacting support. Deleted data is removed from production systems within 30 days.",
    ],
  },
  {
    h: "Security",
    p: [
      "Passwords are hashed with scrypt. Sessions use signed JWT cookies. All traffic runs over HTTPS. Payment transactions are handled by the payment gateways; we never store card numbers.",
    ],
  },
  {
    h: "Your rights",
    p: [
      "You can access, correct or delete your personal data at any time from your dashboard or by emailing support. If you are in the EEA or UK you also have the right to data portability and to lodge a complaint with your supervisory authority.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
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
