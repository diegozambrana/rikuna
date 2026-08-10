import { Hero } from "@/features/marketing/Hero"
import { HowItWorks } from "@/features/marketing/HowItWorks"
import { TrustSection } from "@/features/marketing/TrustSection"
import { MarketingFooter } from "@/features/marketing/MarketingFooter"

export default function MarketingHomePage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <HowItWorks />
      <TrustSection />
      <MarketingFooter />
    </div>
  )
}
