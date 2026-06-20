const EFFECTIVE_DATE = "May 14, 2025";
const LAST_UPDATED = "May 14, 2026";
const OWNER_NAME = "Anthony Myles II";
const CONTACT_EMAIL = "support@askjimmi.com";

const policySections = [
  {
    title: "Who we are",
    body: `JIMMI is owned and operated by ${OWNER_NAME}, an individual based in Georgia, United States ("JIMMI," "we," "us," or "our"). You can reach us at ${CONTACT_EMAIL} for any privacy-related questions or requests.`,
  },
  {
    title: "Information we collect",
    body: "We collect information you provide directly, including your name and email address when you sign in, onboarding responses about your fitness goals, dietary restrictions, and health context, food and nutrition entries you log by text, voice, or barcode scan, workout and activity descriptions, and body metrics such as weight, height, and goals. We also collect basic usage data (page views, session counts) to understand how the Service is used.",
  },
  {
    title: "Voice and audio data",
    body: "When you use the voice input feature, your spoken audio is transmitted to a third-party speech-to-text service for transcription. We do not store raw audio recordings. Only the resulting text transcript is retained and used to generate JIMMI's coaching response.",
  },
  {
    title: "Camera and barcode scanning",
    body: "When you use the barcode scanner, your device camera is activated solely to read product barcodes in real time. No images, video, or frames are stored or transmitted to our servers. The camera is used only to detect barcode values and is deactivated immediately after a scan.",
  },
  {
    title: "Wearable and health-related data",
    body: "If you choose to connect a wearable device or health platform (such as Oura, Fitbit, and WHOOP), JIMMI may receive data including activity summaries, active calories, total calories, sleep duration, sleep quality, readiness and recovery scores, and related timestamps. JIMMI only requests the data necessary to support coaching, recovery, nutrition, and calorie-balance features. You can revoke access at any time through your connected device's settings.",
  },
  {
    title: "Conversation history",
    body: "Your conversations with JIMMI are stored on our servers for up to 7 days to provide continuity across sessions. After 7 days, messages are automatically deleted. You can request earlier deletion by contacting us at " + CONTACT_EMAIL + ".",
  },
  {
    title: "How we use your information",
    body: "We use collected information to provide personalized nutrition, fitness, and recovery coaching; maintain your food log, workout history, and health profile; generate AI-powered responses tailored to your goals and dietary needs; identify food products from barcodes; improve the reliability and quality of the Service; and communicate service-related information to you.",
  },
  {
    title: "Third-party services",
    body: "JIMMI uses the following third-party services to operate: Manus OAuth for authentication, ElevenLabs for AI voice synthesis, OpenAI Whisper for voice transcription, and Oura and WHOOP for optional wearable data. Each provider processes your information under their own privacy policies. We do not authorize these providers to use your data for their own marketing purposes.",
  },
  {
    title: "Sharing and disclosure",
    body: "We do not sell your personal information. We do not share your information with third parties for advertising or marketing purposes. We may share information with service providers that help us operate JIMMI (such as our hosting and database providers), when required by law or to protect rights and safety, or in connection with a business transfer such as a merger or acquisition.",
  },
  {
    title: "Data storage and security",
    body: "Your data is stored on servers located in the United States. We use reasonable administrative, technical, and organizational safeguards to protect your information from unauthorized access, loss, misuse, or alteration. No internet-connected service can guarantee absolute security.",
  },
  {
    title: "Your rights and choices",
    body: "You may request access to, correction of, or deletion of information associated with your account at any time by contacting us at " + CONTACT_EMAIL + ". You may disconnect wearable integrations at any time. You may stop using JIMMI at any time. Georgia residents and users subject to other applicable privacy laws may have additional rights; contact us to exercise them.",
  },
  {
    title: "Children's privacy",
    body: "JIMMI is not intended for children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided information to JIMMI, please contact us so we can review and remove it.",
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-white/10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(143,232,216,0.18),transparent_34%),radial-gradient(circle_at_12%_40%,rgba(216,199,163,0.12),transparent_32%)]" aria-hidden="true" />
        <div className="container relative z-10 px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between border-b border-white/10 pb-4">
            <a className="jimmi-wordmark text-2xl text-white" href="/" aria-label="JIMMI home">
              <img src="/manus-storage/jimmi-wordmark-cropped_80dcf881.png" alt="JIMMI" className="block h-[1.45rem] w-auto md:h-[1.65rem]" />
            </a>
            <a className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-white/70 transition hover:text-white" href="/terms">
              Terms
            </a>
          </header>

          <div className="max-w-3xl py-16 sm:py-20">
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-[#8fe8d8]">Legal</p>
            <h1 className="mt-4 font-display text-5xl font-light leading-[0.92] tracking-[-0.04em] text-white md:text-7xl">Privacy Policy</h1>
            <p className="mt-6 text-lg leading-8 text-white/70">
              This Privacy Policy explains how JIMMI collects, uses, stores, and shares information when you use askjimmi.com and related coaching features.
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
              For privacy requests or questions, contact us at{" "}
              <a className="text-[#8fe8d8] underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>.
            </p>
            <p className="mt-4 text-white/40">
              {OWNER_NAME}<br />
              Georgia, United States
            </p>
          </aside>

          <div className="space-y-4">
            {policySections.map((section) => (
              <article key={section.title} className="rounded-[1.5rem] border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
                <h2 className="font-display text-2xl font-light tracking-[-0.02em] text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/68">{section.body}</p>
              </article>
            ))}

            <article className="rounded-[1.5rem] border border-[#8fe8d8]/20 bg-[#8fe8d8]/[0.055] p-6">
              <h2 className="font-display text-2xl font-light tracking-[-0.02em] text-white">Changes to this policy</h2>
              <p className="mt-3 text-sm leading-7 text-white/68">
                We may update this Privacy Policy from time to time. If we make material changes, we will update the effective date at the top of this page. Continued use of JIMMI after an update means the revised policy applies to you.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
