import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import logo from "../assets/Deckly.png";

const Terms = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Terms of Service | Deckly";
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
            Terms of Service
          </h1>
          <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Effective: April 2026</span>
          </div>
        </header>

        {/* Full Policy Content */}
        <div className="space-y-16">
          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              1. Acceptance of Terms
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                By accessing or using Deckly ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.
              </p>
              <p>
                Deckly provides a pitch deck management platform that allows founders and investors to upload, organize, share, and track engagement with pitch decks and data rooms.
              </p>
            </div>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              2. Eligibility
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                You must be at least 18 years old (or the age of majority in your jurisdiction) to use this Service. By creating an account, you represent and warrant that you meet this requirement.
              </p>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
            </div>
          </section>

          {/* 3. User Accounts */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              3. User Accounts
            </h2>
            <div className="space-y-6">
              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">A. Account Creation</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  You may create an account using email/password or through third-party authentication providers (Google, GitHub). You agree to provide accurate and complete information during registration.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">B. Account Termination</h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  You may delete your account at any time through the settings page. We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or remain inactive for extended periods.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              4. Acceptable Use
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                You agree not to use the Service to:
              </p>
              <ul className="space-y-3 text-sm text-slate-400 list-disc list-inside">
                <li>Upload content that infringes on intellectual property rights of others</li>
                <li>Distribute malware, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to other users' accounts or data</li>
                <li>Use automated systems to scrape, copy, or replicate Service content</li>
                <li>Share confidential or proprietary information without proper authorization</li>
                <li>Engage in any activity that disrupts or interferes with Service functionality</li>
              </ul>
            </div>
          </section>

          {/* 5. Content & Intellectual Property */}
          <section className="bg-white/[0.02] border border-white/5 p-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              5. Content & Intellectual Property
            </h2>
            <div className="space-y-6 text-slate-400 leading-relaxed">
              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">A. Your Content</h4>
                <p className="text-sm leading-relaxed">
                  You retain all ownership rights to content you upload to Deckly (pitch decks, documents, metadata). By uploading content, you grant Deckly a limited, non-exclusive license to store, process, and display your content solely for the purpose of providing the Service.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">B. Platform Rights</h4>
                <p className="text-sm leading-relaxed">
                  Deckly's software, design, branding, and proprietary features are protected by intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without explicit written permission.
                </p>
              </div>
            </div>
          </section>

          {/* 6. Service Features & Limitations */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              6. Service Features & Limitations
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                Deckly provides the following features subject to your subscription tier:
              </p>
              <ul className="space-y-3 text-sm text-slate-400 list-disc list-inside">
                <li><strong className="text-white">Document Management:</strong> Upload, organize, version, and manage PDF pitch decks with custom branding, metadata, and access controls</li>
                <li><strong className="text-white">Data Rooms:</strong> Organize multiple documents into secure, shareable collections with granular permissions</li>
                <li><strong className="text-white">AI Summarization:</strong> Automatically generate concise, AI-powered summaries of uploaded documents for quick review and analysis</li>
                <li><strong className="text-white">Reviews & Feedback:</strong> Add private notes, tags, and structured reviews to documents for internal collaboration</li>
                <li><strong className="text-white">Analytics:</strong> Track viewer engagement, page views, time spent, and geographic location data</li>
                <li><strong className="text-white">Sharing Controls:</strong> Set expiration dates, disable downloads, require email verification, and manage access links</li>
              </ul>
              <p>
                We reserve the right to modify, suspend, or discontinue any feature of the Service at any time. We will provide reasonable notice for material changes affecting paid tiers.
              </p>
            </div>
          </section>

          {/* 7. Payment & Billing */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              7. Payment & Billing
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                Certain features of the Service require a paid subscription. By subscribing, you agree to the following:
              </p>
              <ul className="space-y-3 text-sm text-slate-400 list-disc list-inside">
                <li>Payments are processed securely through a third-party payment gateway</li>
                <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
                <li>Refunds are provided in accordance with applicable consumer protection laws</li>
                <li>Prices may change with 30 days' notice to active subscribers</li>
                <li>You may cancel at any time, but access will continue through the end of your billing cycle</li>
              </ul>
            </div>
          </section>

          {/* 8. Disclaimers */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              8. Disclaimers
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                <strong>Service Provided "As Is":</strong> The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied, including but not limited to merchantability, fitness for a particular purpose, and non-infringement.
              </p>
              <p>
                <strong>No Investment Advice:</strong> Deckly does not provide investment, legal, or financial advice. Content shared through the Service is the responsibility of the uploading user.
              </p>
              <p>
                <strong>Third-Party Services:</strong> The Service may integrate with third-party providers (Supabase, Vercel, PostHog, Stripe). We are not responsible for the availability or performance of these external services.
              </p>
            </div>
          </section>

          {/* 9. Limitation of Liability */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              9. Limitation of Liability
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                To the maximum extent permitted by law, Deckly and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.
              </p>
              <p>
                Our total liability for any claim arising from the Service shall not exceed the amount you paid to Deckly in the 12 months preceding the claim.
              </p>
            </div>
          </section>

          {/* 10. Indemnification */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              10. Indemnification
            </h2>
            <div className="text-slate-400 leading-relaxed">
              <p>
                You agree to indemnify and hold harmless Deckly, its operators, and affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your uploaded content, or your violation of these Terms.
              </p>
            </div>
          </section>

          {/* 11. Dispute Resolution */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              11. Dispute Resolution
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                Any disputes arising from these Terms or your use of the Service shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration in accordance with applicable arbitration rules.
              </p>
              <p>
                These Terms are governed by the laws of India, without regard to conflict of law principles.
              </p>
            </div>
          </section>

          {/* 12. Changes to Terms */}
          <section>
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-4 uppercase tracking-tight">
              <span className="w-1 h-6 bg-[#54e98a]" />
              12. Changes to Terms
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                We may update these Terms periodically to reflect changes in our Service, legal requirements, or business practices. We will notify users of material changes via email or a prominent notice within the application at least 30 days before changes take effect.
              </p>
              <p>
                Continued use of the Service after changes become effective constitutes acceptance of the updated Terms.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="pt-20 border-t border-white/5 text-center">
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tighter text-center">Contact</h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto mb-8">
              For questions about these Terms, legal inquiries, or concerns about our practices, please contact our team.
            </p>
            <a
              href="mailto:legal@deckly.space"
              className="text-[#54e98a] font-bold uppercase tracking-widest text-[10px] hover:underline"
            >
              legal@deckly.space
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
                href="mailto:legal@deckly.space"
                className="group inline-flex items-center gap-2 text-white hover:text-[#54e98a] text-lg md:text-xl font-bold transition-all"
              >
                legal@deckly.space
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
                <span className="text-[#54e98a] text-sm md:text-base font-bold cursor-default">
                  Terms of Service
                </span>
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
                className="w-[12vw] h-[12vw] object-contain hidden sm:block"
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

export default Terms;
