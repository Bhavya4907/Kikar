import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — Kikar",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[hsl(0,0%,8%)] text-white font-sora">
      <div className="max-w-2xl mx-auto px-6 md:px-12 py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white text-xs font-medium uppercase tracking-widest mb-10 transition-colors"
        >
          ← Back
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          Kikar <span className="text-[hsl(119,99%,46%)]">Privacy Policy</span>
        </h1>
        <p className="text-white/50 text-sm mb-10">
          kikkar.vercel.app · Last updated: August 10, 2026
        </p>

        <div className="space-y-8 text-white/80 text-sm leading-relaxed">
          <p>
            This Privacy Policy explains what information Kikar (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), an
            AI-powered messaging application available at kikkar.vercel.app and as an Android app, collects
            from you, how we use it, and the choices you have. By creating an account or using Kikar, you
            agree to the practices described here.
          </p>
          <p>
            Kikar is currently in development / pre-launch. This policy is written to reflect what the
            application does today and will be updated as features change.
          </p>

          <Section title="1. Information We Collect">
            <SubHead>Account information</SubHead>
            <p>
              When you sign up, we collect the email address and password you provide. Authentication is
              handled by our backend provider, Supabase, which stores your password in hashed (encrypted)
              form — we never see or store your raw password.
            </p>
            <SubHead>Profile information</SubHead>
            <p>
              You may choose to add a display name, username, bio, and an avatar image (or avatar URL) to
              your profile. This information may be visible to other users of Kikar.
            </p>
            <SubHead>AI characters you create</SubHead>
            <p>
              If you create a custom AI character, we store the name, emoji, personality description, and
              speaking style you provide. This information is used to generate the character&apos;s behavior
              and is stored in our database.
            </p>
            <SubHead>Messages</SubHead>
            <p>
              We store the messages you send — both conversations with AI characters and direct messages to
              other users — so that your chat history persists across sessions.
            </p>
            <SubHead>AI-generated content</SubHead>
            <p>
              When you generate an AI persona, chat reply, or image, the relevant text (such as your prompt
              or conversation history) is sent to our AI providers to generate a response. See &quot;Third-Party
              Services&quot; below.
            </p>
            <SubHead>Device and push notification data</SubHead>
            <p>
              If you use the Android app and enable notifications, we store a push notification token tied
              to your account so we can deliver notifications to your device.
            </p>
          </Section>

          <Section title="2. How We Use Your Information">
            <List
              items={[
                "To create and manage your account",
                "To provide core features: chatting with AI characters, direct messaging, and profile display",
                "To generate AI personas, chat responses, and AI images based on content you provide",
                "To send push notifications (e.g. new message alerts), if enabled",
                "To maintain and improve the security and functionality of the app",
              ]}
            />
          </Section>

          <Section title="3. Third-Party Services">
            <p>
              Kikar relies on the following third-party services to operate. When you use related features,
              relevant data is shared with them:
            </p>
            <SubHead>Supabase</SubHead>
            <p>
              Our database, authentication, and file storage provider. Account credentials, profile data,
              characters, and messages are stored on Supabase&apos;s infrastructure.
            </p>
            <SubHead>Google Gemini</SubHead>
            <p>
              Used to generate AI chat responses, analyze writing styles for persona replicas, and create AI images.
              Messages, character prompts, and image prompts you submit are processed by Google&apos;s Gemini API to
              generate replies.
            </p>
            <p>
              These providers process data on our behalf and may retain it according to their own privacy
              policies. We recommend reviewing their policies if you&apos;d like more detail on how they handle
              data.
            </p>
          </Section>

          <Section title="4. Data Storage & Security">
            <p>
              Your data is stored on Supabase&apos;s cloud infrastructure. Passwords are hashed by Supabase Auth
              and are never stored or visible to us in plain text. That said, no method of transmission or
              storage is 100% secure, and as an early-stage, pre-launch project, Kikar has not yet undergone
              a formal security audit. We encourage you not to share sensitive personal information in chats
              or your profile beyond what&apos;s necessary.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your account, profile, character, and message data for as long as your account is
              active. You may request deletion of your account and associated data at any time by contacting
              us (see &quot;Contact Us&quot; below).
            </p>
          </Section>

          <Section title="6. Your Choices and Rights">
            <List
              items={[
                "You can edit or update your profile information at any time within the app.",
                "You can request a copy of the personal data we hold about you.",
                "You can request that we delete your account and associated data.",
                "You can disable push notifications through your device settings.",
              ]}
            />
            <p>To exercise any of these rights, contact us using the details below.</p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>
              Kikar is not directed at children under 13, and we do not knowingly collect personal
              information from children under 13. If you believe a child has provided us with personal
              information, please contact us so we can remove it.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this Privacy Policy as Kikar&apos;s features evolve, especially as the app moves
              from development toward public launch. We&apos;ll update the &quot;Last updated&quot; date above when
              changes are made. Continued use of Kikar after changes means you accept the updated policy.
            </p>
          </Section>

          <Section title="9. Contact Us">
            <p>If you have questions about this Privacy Policy or want to exercise your data rights, contact us at:</p>
            <p className="text-[hsl(119,99%,46%)] font-semibold">bhavya497sharma@gmail.com</p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-[hsl(119,99%,46%)] mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-white/95 mt-4 mb-1">{children}</h3>
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
