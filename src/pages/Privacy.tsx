import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import logo from "../assets/Deckly.png";

const Privacy = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Privacy Policy | Deckly";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-200 selection:bg-[#54e98a]/30 selection:text-[#54e98a] font-sans">
      {/* Navigation Header */}
      <nav className="border-b border-white/5 bg-[#0e0e0e]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={logo} alt="Deckly" className="w-8 h-8 object-contain" />
            <span className="font-bold tracking-tighter text-lg group-hover:text-[#54e98a] transition-colors uppercase border-l border-white/10 pl-3">
              DECKLY
            </span>
          </Link>
          <Link
            to="/login"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors"
          >
            Back to App
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20">
        {/* Header */}
        <header className="mb-20">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#54e98a] mb-8 hover:translate-x-[-4px] transition-transform cursor-pointer"
          >
            <ArrowLeft size={12} /> Return
          </button>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6 uppercase">
            Privacy Policy
          </h1>
          <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Effective: April 2026</span>
          </div>
        </header>

        {/* Full Policy Content */}
        <div className="space-y-16">
          {/* 1. Definitions & Scope */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              1. Scope & Definitions
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                This Privacy Policy describes how Deckly ("we," "us," or "our")
                collects, uses, and protects your information when you use our
                pitch deck management services, web applications, and related
                APIs (the "Service").
              </p>
              <p>
                By accessing the Service, you consent to the data practices
                described in this policy. We prioritize data minimization,
                meaning we only collect what is strictly necessary to provide a
                functional and high-performance content experience.
              </p>
            </div>
          </section>

          {/* 2. Information Collection */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              2. Information Collection
            </h2>
            <div className="space-y-6">
              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">
                  A. Information You Provide
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Includes account registration details (Email, Name), payment
                  information (handled by third-party processors), and any
                  content you upload, such as PDF assets, metadata, and data
                  room configurations.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">
                  B. Automatically Collected Data
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  We collect technical data to ensure Service stability,
                  security, and to provide analytics. This includes browser
                  types, device identifiers, and interaction events (pages
                  viewed, duration, saves).
                </p>
                <ul className="space-y-4 text-sm text-slate-400 list-disc list-inside">
                  <li>
                    <strong>IP Addresses & Location:</strong> IP addresses are
                    used for security (rate limiting), approximate geographic
                    location, and fraud prevention. Raw IP addresses are not
                    stored in our analytics database beyond what is necessary
                    for these purposes. When viewers access shared documents, we
                    collect approximate geographic location data (country and
                    city) derived from IP addresses to provide location
                    analytics to document owners.
                  </li>
                  <li>
                    <strong>Viewer Email Collection:</strong> When document
                    owners require email verification for access, we collect the
                    viewer's email address and associate it with their viewing
                    session for reporting to the document owner.
                  </li>
                  <li>
                    <strong>Visitor Tracking:</strong> We use a randomly
                    generated identifier stored in your browser's local storage
                    to distinguish unique document views and prevent analytics
                    inflation. This identifier is not linked to your identity
                    unless you provide your email address.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Sharing & Third Parties */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              3. Data Sharing & Third Parties
            </h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              We do not sell data. Information is shared only as described below
              under strict confidentiality agreements:
            </p>

            <div className="mb-6 bg-white/[0.02] border-l-2 border-[#54e98a] p-6">
              <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">
                Document Analytics Sharing
              </h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Viewing data including pages viewed, time spent, approximate
                location, and email address (if provided) is shared with the
                owner of the document being viewed. By accessing a shared
                document, viewers consent to this data collection and sharing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-500">Infrastructure</span>
                <span className="text-slate-300 text-right">
                  Supabase, Vercel
                </span>
              </div>
              <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-500">Analytics</span>
                <span className="text-slate-300 text-right">PostHog</span>
              </div>
              <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-500">Communication</span>
                <span className="text-slate-300 text-right">Resend</span>
              </div>
              <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-500">Payments</span>
                <span className="text-slate-300 text-right">Stripe</span>
              </div>
            </div>
          </section>

          {/* 4. User Rights */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              4. Your Global Rights (GDPR/CCPA)
            </h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Users have administrative controls to manage their privacy:
            </p>
            <ul className="space-y-4 text-sm text-slate-400">
              <li>
                <strong className="text-white">Access & Portability:</strong>{" "}
                Request a copy of all data stored in your account profile.
              </li>
              <li>
                <strong className="text-white">Correction:</strong> Modify your
                account information at any time via Settings.
              </li>
              <li>
                <strong className="text-white">Deletion:</strong> Delete your
                account and associated documents permanently from our systems.
              </li>
            </ul>
          </section>

          {/* 5. Retention & Security */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              5. Retention & Security
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                <strong>Account Data:</strong> We retain data only as long as an
                account is active. Upon account deletion, we purge user-specific
                data from production databases within 30 days.
              </p>
              <p>
                <strong>Analytics Data:</strong> Analytics data (page views,
                engagement metrics) is retained for the lifetime of the
                associated document. When a document is deleted, all associated
                viewing data is permanently removed within 30 days.
              </p>
              <p>
                <strong>Security:</strong> Data is protected via database-level
                Row Level Security (RLS) policies, encrypted storage volumes,
                and strict environment isolation.
              </p>
            </div>
          </section>

          {/* 6. Cookies & Analytics */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              6. Cookies & Analytics (PostHog)
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                We use <strong>PostHog</strong>, a third-party analytics suite,
                to collect information about how you interact with our platform
                to improve Service stability and feature development.
              </p>
              <p>
                PostHog is configured in cookieless mode using memory-only
                persistence. This means we avoid tracking you across different
                browsing sessions with persistent non-essential cookies. We do
                not use this analytics data for cross-site behavioral
                advertising. Local storage is used minimally for functional
                session continuity within the application.
              </p>
            </div>
          </section>

          {/* 7. Children's Privacy */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              7. Children's Privacy
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Our Service is not directed to individuals under the age of 16 (or
              the applicable legal age in your jurisdiction). We do not
              knowingly collect personal data from children. If we become aware
              of an unauthorized registration by a minor, we will delete their
              information immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              8. International Data Transfers
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Your information is processed on servers located in various global
              jurisdictions, primarily in India and the United States. We rely
              on our infrastructure providers' (Supabase, Vercel) data transfer
              mechanisms and Data Processing Agreements (DPAs) to ensure
              appropriate safeguards for international transfers.
            </p>
          </section>

          {/* 9. Compliance & Updates */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              9. Compliance & Updates
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                <strong>Data Breach Notification:</strong> In the unlikely event
                of a security breach involving your personal information, we
                will notify you and relevant regulatory authorities without
                undue delay, typically within 72 hours of discovery.
              </p>
              <p>
                <strong>Changes to Policy:</strong> We may update this policy
                periodically to reflect changes in our Service or legal
                environment. Significant updates will be communicated via email
                or a prominent notification within the application.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="pt-20 border-t border-white/5 text-center">
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tighter text-center">
              Contact
            </h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto mb-8">
              For data requests, privacy concerns, or questions regarding our
              privacy standards, please contact our team.
            </p>
            <a
              href="mailto:privacy@deckly.space"
              className="text-[#54e98a] font-bold uppercase tracking-widest text-[10px] hover:underline"
            >
              privacy@deckly.space
            </a>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 mt-10 relative overflow-hidden pt-24 pb-8 bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e] to-[#54e98a]/10">
        {/* Subtle Background Pattern & Glow */}
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_center,_#54e98a_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#54e98a]/[0.08] blur-[120px] pointer-events-none rounded-t-[100%]" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Top CTA Section */}
          <div className="max-w-2xl mb-24">
            <div className="text-[#54e98a] text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2">
              <span className="text-xl leading-none -mt-1">+</span> Contact Us
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white leading-tight">
              A securing workspace for,{" "}
              <span className="text-slate-500">
                founders and investors workflows.
              </span>
            </h2>
          </div>

          {/* Middle Links Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 mb-16">
            {/* Contact Info */}
            <div className="space-y-2">
              <p className="text-slate-500 text-xs font-medium">
                Contact Team at:
              </p>
              <a
                href="mailto:privacy@deckly.space"
                className="group inline-flex items-center gap-2 text-white hover:text-[#54e98a] text-lg md:text-xl font-bold transition-all"
              >
                privacy@deckly.space
                <ArrowUpRight
                  size={20}
                  className="text-slate-400 group-hover:text-[#54e98a] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                />
              </a>
            </div>

            {/* Horizontal Links */}
            <ul className="flex flex-wrap items-center gap-6 md:gap-10">
              <li>
                <Link
                  to="/privacy"
                  className="text-white hover:text-[#54e98a] text-sm md:text-base font-bold transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <div className="text-slate-600 hover:text-slate-400 text-sm md:text-base font-bold transition-colors cursor-not-allowed group relative flex items-center">
                  Terms of Service
                  <span className="absolute -top-3 -right-6 px-1 py-0.5 bg-white/5 text-[8px] font-bold uppercase tracking-widest rounded-sm opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1 group-hover:translate-y-0 text-slate-400">
                    Soon
                  </span>
                </div>
              </li>
              <li>
                <div className="text-slate-600 hover:text-slate-400 text-sm md:text-base font-bold transition-colors cursor-not-allowed group relative flex items-center">
                  Cookie Policy
                  <span className="absolute -top-3 -right-6 px-1 py-0.5 bg-white/5 text-[8px] font-bold uppercase tracking-widest rounded-sm opacity-0 group-hover:opacity-100 transition-opacity -translate-y-1 group-hover:translate-y-0 text-slate-400">
                    Soon
                  </span>
                </div>
              </li>
            </ul>
          </div>

          {/* Massive Brand Name */}
          <div className="mb-8 w-full border-b border-white/5 pb-8 flex justify-center items-center">
            <div className="flex items-center justify-center gap-4 w-full">
              {/* Deckly Logo Mark as the D */}
              <img
                src={logo}
                alt="Deckly"
                className="w-[8vw] h-[8vw] object-contain hidden sm:block"
              />
              <h1 className="text-[14vw] sm:text-[12vw] leading-none font-bold tracking-tighter text-white select-none lowercase">
                deckly
              </h1>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
            <p className="text-[10px] text-white font-medium tracking-wide">
              © 2026 Deckly. All rights reserved.
            </p>
            <div className="flex gap-6 text-[10px] text-white font-medium tracking-wide">
              <a href="#" className="hover:text-[#54e98a] transition-colors">
                LinkedIn
              </a>
              <a href="#" className="hover:text-[#54e98a] transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-[#54e98a] transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
