import LandingFaq from "./components/landing-faq";
import LandingFeatures from "./components/landing-features";
import LandingFooter, { LandingCta } from "./components/landing-footer";
import LandingGallery from "./components/landing-gallery";
import LandingHero from "./components/landing-hero";
import LandingNav from "./components/landing-nav";
import LandingSteps from "./components/landing-steps";
import LandingWhy from "./components/landing-why";

/**
 * The marketing page at `/`. Pure server component: the only interactivity is
 * anchors and native `<details>`, so it ships without client JavaScript.
 */
export default function LandingPage() {
    return (
        <>
            <LandingNav />
            <main>
                <LandingHero />
                <LandingWhy />
                <hr className="h-px border-0 bg-line" />
                <LandingFeatures />
                <LandingSteps />
                <LandingGallery />
                <hr className="h-px border-0 bg-line" />
                <LandingFaq />
                <LandingCta />
            </main>
            <LandingFooter />
        </>
    );
}
