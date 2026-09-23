'use client';

import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { HoneycombOverlay } from '@/components/landing/HoneycombOverlay';
import { VerificationDemo } from '@/components/landing/VerificationDemo';
import { ArchitectureGrid } from '@/components/landing/ArchitectureGrid';
import { StatutoryFlow } from '@/components/landing/StatutoryFlow';
import { LedgerStream } from '@/components/landing/LedgerStream';
import { InquiryForm } from '@/components/landing/InquiryForm';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#020305] text-[#F4F7FB] selection:bg-[#38BDF8]/25 selection:text-[#67E8F9] overflow-x-hidden font-sans">
      {/* Primary Honeycomb Background Layer with high-contrast subtle dark overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 bg-[#020305] bg-[url('/assets/honeycomb-background.jpg')] bg-cover bg-center bg-no-repeat opacity-40 mix-blend-screen"
        aria-hidden="true"
      />

      {/* Atmospheric luminous glow and SVG honeycomb vector elements */}
      <HoneycombOverlay />

      {/* Top Navigation */}
      <Navbar onNavigateSection={scrollToSection} />

      {/* Main Content Area */}
      <main className="relative z-10">
        <Hero
          onExploreClick={() => scrollToSection('architecture')}
          onVerifyClick={() => scrollToSection('verification')}
        />

        <VerificationDemo />

        <ArchitectureGrid />

        <StatutoryFlow />

        <LedgerStream />

        <InquiryForm />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
