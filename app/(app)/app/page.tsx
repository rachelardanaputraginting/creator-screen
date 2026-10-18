"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/stores/canvas-store";
import OnboardingDialog from "@/app/components/onboarding-dialog";
import EditorLayout from "@/app/components/editor-layout";
import CaptureSourcePicker from "@/app/components/capture-source-picker";

export default function EditorPage() {
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

  return (
    <>
      {showOnboarding ? (
        <div className="flex flex-col h-screen w-full">
          <OnboardingDialog onComplete={handleOnboardingComplete} />
        </div>
      ) : (
        <EditorLayout />
      )}
      {/* The desktop shell can ask for a screen/window picker at any moment —
          including while the editor is in presentation/fullscreen mode, where
          the layout branch used to render no picker at all. Mounted once here
          so the overlay can never be missing. */}
      <CaptureSourcePicker />
    </>
  );
}
