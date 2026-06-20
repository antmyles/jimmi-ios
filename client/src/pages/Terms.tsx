const EFFECTIVE_DATE = "May 14, 2025";
const LAST_UPDATED = "May 14, 2026";
const OWNER_NAME = "Anthony Myles II";
const CONTACT_EMAIL = "mylesan10@gmail.com";

const termsSections = [
  {
    title: "Acceptance of terms",
    body: `By accessing or using JIMMI (available at askjimmi.com), you agree to be bound by these Terms of Service. JIMMI is owned and operated by ${OWNER_NAME}, an individual based in Georgia, United States. If you do not agree to these terms, please do not use the Service.`,
  },
  {
    title: "Description of the Service",
    body: "JIMMI is an AI-powered personal fitness and nutrition coaching application. It provides personalized guidance on nutrition, recovery, and training based on information you provide. JIMMI is designed to support your wellness goals and is not a substitute for professional medical, dietary, or clinical advice.",
  },
  {
    title: "Not medical advice",
    body: "JIMMI is not a medical device and does not provide medical advice, diagnosis, or treatment. The coaching, nutrition estimates, and recommendations provided by JIMMI are for general wellness and informational purposes only. Always consult a qualified healthcare professional before making significant changes to your diet, exercise routine, or health regimen, especially if you have a medical condition.",
  },
  {
    title: "Eligibility",
    body: "You must be at least 13 years old to use JIMMI. By using the Service, you represent that you meet this age requirement. If you are under 18, you represent that a parent or legal guardian has reviewed and agreed to these terms on your behalf.",
  },
  {
    title: "Your account",
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate information during registration and to keep it up to date. Notify us immediately at " + CONTACT_EMAIL + " if you suspect unauthorized access to your account.",
  },
  {
    title: "Acceptable use",
    body: "You agree to use JIMMI only for lawful purposes and in accordance with these terms. You may not use the Service to transmit harmful, offensive, or misleading content; attempt to gain unauthorized access to any part of the Service; interfere with or disrupt the Service or its servers; or use automated tools to scrape or extract data from the Service.",
  },
  {
    title: "Your content",
    body: "You retain ownership of the information and content you provide to JIMMI (such as food logs, workout descriptions, and goals). By submitting content, you grant JIMMI a limited license to use it solely to provide and improve the Service. We do not sell your content or use it to train AI models for third parties.",
  },
  {
    title: "Third-party integrations",
    body: "JIMMI may connect with third-party services such as Oura and WHOOP. Your use of those integrations is subject to the respective provider's terms and privacy policies. JIMMI is not responsible for the practices of third-party services.",
  },
  {
    title: "Disclaimer of warranties",
    body: 'JIMMI is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or completely accurate. Nutrition estimates, macro calculations, and coaching responses are approximations and may not be suitable for all individuals.',
  },
  {
    title: "Limitation of liability",
    body: `To the fullest extent permitted by law, ${OWNER_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use JIMMI, including but not limited to health outcomes, data loss, or reliance on coaching recommendations.`,
  },
  {
    title: "Termination",
    body: "We reserve the right to suspend or terminate your access to JIMMI at any time, with or without notice, if we believe you have violated these terms or for any other reason at our discretion. You may stop using the Service at any time.",
  },
  {
    title: "Governing law",
    body: "These Terms of Service are governed by the laws of the State of Georgia, United States, without regard to conflict of law principles. Any disputes arising under these terms shall be resolved in the courts of Georgia.",
  },
];

export default function Terms() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-white/10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(143,232,216,0.18),transparent_34%),radial-gradient(circle_at_12%_40%,rgba(216,199,163,0.12),transparent_32%)]" aria-hidden="true" />
        <div className="container relative z-10 px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between border-b border-white/10 pb-4">
            <a className="jimmi-wordmark text-2xl text-white" href="/" aria-label="JIMMI home">
              <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
            </a>
            <a className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-white/70 transition hover:text-white" href="/privacy">
              Privacy
            </a>
          </header>

          <div className="max-w-3xl py-16 sm:py-20">
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-[#8fe8d8]">Legal</p>
            <h1 className="mt-4 font-display text-5xl font-light leading-[0.92] tracking-[-0.04em] text-white md:text-7xl">Terms of Service</h1>
            <p className="mt-6 text-lg leading-8 text-white/70">
              Please read these Terms of Service carefully before using JIMMI. They govern your access to and use of the Service.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/50">
              Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>
      </section>

      <section className="container px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 text-sm leading-6 text-white/60 lg:sticky lg:top-6 lg:self-start">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-white/45">Contact</p>
            <p className="mt-3">
              Questions about these terms? Contact us at{" "}
              <a className="text-[#8fe8d8] underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>.
            </p>
            <p className="mt-4 text-white/40">
              {OWNER_NAME}<br />
              Georgia, United States
            </p>
            <div className="mt-6 border-t border-white/10 pt-4">
              <a className="text-[#8fe8d8] text-xs underline-offset-4 hover:underline" href="/privacy">
                View Privacy Policy →
              </a>
            </div>
          </aside>

          <div className="space-y-4">
            {termsSections.map((section) => (
              <article key={section.title} className="rounded-[1.5rem] border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
                <h2 className="font-display text-2xl font-light tracking-[-0.02em] text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/68">{section.body}</p>
              </article>
            ))}

            <article className="rounded-[1.5rem] border border-[#8fe8d8]/20 bg-[#8fe8d8]/[0.055] p-6">
              <h2 className="font-display text-2xl font-light tracking-[-0.02em] text-white">Changes to these terms</h2>
              <p className="mt-3 text-sm leading-7 text-white/68">
                We may update these Terms of Service from time to time. If we make material changes, we will update the effective date at the top of this page. Continued use of JIMMI after an update constitutes your acceptance of the revised terms.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
