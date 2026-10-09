"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/stores/canvas-store";
import OnboardingDialog from "@/app/components/onboarding-dialog";
import EditorLayout from "@/app/components/editor-layout";

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    // Check if onboarding was already completed
    const completedOnboarding = localStorage.getItem("creator-screen-onboarding");
    if (completedOnboarding === "true") {
      setShowOnboarding(false);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("creator-screen-onboarding", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return (
      <div className="flex flex-col h-screen w-full">
        <OnboardingDialog onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  return <EditorLayout />;
}