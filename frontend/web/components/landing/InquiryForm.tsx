'use client';

import { useState, FormEvent } from 'react';
import { Mail, Send, CheckCircle2, Building, ShieldCheck, MapPin } from 'lucide-react';

export function InquiryForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    jurisdiction: 'Lagos State Ministry of Lands',
    inquiryType: 'Node Deployment',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        organization: '',
        jurisdiction: 'Lagos State Ministry of Lands',
        inquiryType: 'Node Deployment',
        message: '',
      });
    }, 600);
  };

  return (
    <section id="contact" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Contact context */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] mb-3">
              <Mail className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span className="text-[12px] font-mono uppercase tracking-wider text-[#67E8F9]">
                State & Cadastral Inquiries
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#F4F7FB] tracking-tight mb-4">
              Deploy Anagu for Your State Jurisdiction
            </h2>
            <p className="text-[#94A3B8] text-base leading-relaxed mb-8">
              Whether you represent a State Bureau of Lands, Office of the Surveyor General, 
              or a licensed survey institution, our consortium engineers assist with validator node 
              provisioning and legacy database migration.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-[10px] bg-[#0A0F16]/60 border border-[rgba(91,133,167,0.18)]">
                <Building className="h-5 w-5 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-[#F4F7FB]">
                    Inter-Agency Integration
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Connect existing GIS databases (ArcGIS, QGIS, AutoCAD) directly to PostGIS verification microservices.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-[10px] bg-[#0A0F16]/60 border border-[rgba(91,133,167,0.18)]">
                <ShieldCheck className="h-5 w-5 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-[#F4F7FB]">
                    Statutory Compliance Audits
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Formal cryptographic certification adhering to the 1978 Land Use Act and SURCON specifications.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Form */}
          <div className="lg:col-span-7">
            <div className="rounded-[12px] bg-[#0A0F16]/80 border border-[rgba(91,133,167,0.22)] p-6 sm:p-10 backdrop-blur-md shadow-[0_0_24px_rgba(56,189,248,0.08)]">
              {submitted ? (
                <div className="py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-[#05080D] border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F4F7FB] mb-2">
                    Inquiry Transmitted to Registry Secretariat
                  </h3>
                  <p className="text-sm text-[#94A3B8] max-w-md mx-auto mb-6">
                    A technical liaison will review your jurisdictional requirements and contact your office with node deployment documentation.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="h-10 px-5 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.25)] text-[#F4F7FB] text-sm hover:border-[#38BDF8] transition-colors"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Engr. Kenneth Okeke"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-[#F4F7FB] placeholder-[#526174] text-sm focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        Official Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="official@ministry.gov.ng"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-[#F4F7FB] placeholder-[#526174] text-sm focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        Organization / Agency
                      </label>
                      <input
                        type="text"
                        value={formData.organization}
                        onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                        placeholder="State Ministry of Lands & Survey"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-[#F4F7FB] placeholder-[#526174] text-sm focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        Inquiry Focus
                      </label>
                      <select
                        value={formData.inquiryType}
                        onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-[#F4F7FB] text-sm focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                      >
                        <option value="Node Deployment">State Consortium Node Deployment</option>
                        <option value="Cadastre Integration">Cadastre & GIS Migration</option>
                        <option value="Surveyor General Onboarding">Surveyor Licensing & Keys</option>
                        <option value="Statutory Legal Advisory">Section 28 Compliance Review</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Technical Scope & Message *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Specify your jurisdiction, parcel volume, or existing GIS software stack..."
                      className="w-full p-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-[#F4F7FB] placeholder-[#526174] text-sm focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    {submitting ? (
                      <div className="h-4 w-4 rounded-full border-2 border-[#020305] border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <span>Submit Cadastral Request</span>
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
