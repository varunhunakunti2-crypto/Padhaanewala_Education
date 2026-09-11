import Header from "@/components/jobhire/Header";
import Hero from "@/components/jobhire/Hero";
import { CategoriesSection } from "@/components/jobhire/Categories";
import JobsSection from "@/components/jobhire/Jobs";
import { CareerSection } from "@/components/jobhire/CareerSection";
import StatsBar from "@/components/jobhire/StatsBar";
import Testimonials from "@/components/jobhire/Testimonials";
import NewsSection from "@/components/jobhire/News";
import AppDownload from "@/components/jobhire/AppDownload";
import Footer from "@/components/jobhire/Footer";

export default function JobhireHome() {
  return (
    <div className="overflow-x-clip bg-white">
      <Header />
      <main>
        <Hero />
        <CategoriesSection />
        <JobsSection />
        <CareerSection />
        <StatsBar />
        <Testimonials />
        <NewsSection />
        <AppDownload />
      </main>
      <Footer />
    </div>
  );
}