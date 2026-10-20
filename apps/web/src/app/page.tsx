import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { PlatformMarquee } from "@/components/landing/PlatformMarquee";
import { Features } from "@/components/landing/Features";
import { TVSection } from "@/components/landing/TVSection";
import { AppsSection } from "@/components/landing/AppsSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <PlatformMarquee />
      <Features />
      <TVSection />
      <AppsSection />
      <SecuritySection />
      <CTA />
      <Footer />
    </main>
  );
}
