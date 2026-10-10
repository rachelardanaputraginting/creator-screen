"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    Button,
} from "@/components/ui";

export default function OnboardingDialog({
    onComplete,
}: {
    onComplete?: () => void;
}) {
    const [step, setStep] = useState(1);
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        // Check if onboarding was already completed
        const completedOnboarding = localStorage.getItem(
            "creator-screen-onboarding",
        );
        if (completedOnboarding === "true") {
            setCompleted(true);
        }
    }, []);

    const handleComplete = () => {
        localStorage.setItem("creator-screen-onboarding", "true");
        setCompleted(true);
        onComplete?.();
    };

    if (completed) {
        return null;
    }

    return (
        <Dialog open>
            <DialogContent className="max-w-md sm:max-w-lg sm:px-4 sm:py-8">
                <DialogHeader>
                    <DialogTitle>Welcome to Creator Screen</DialogTitle>
                    <DialogDescription>
                        Create beautiful layouts for coding, tutorials, and
                        content creation.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Step 1 */}
                    {step === 1 && (
                        <div>
                            <h3 className="text-sm font-medium">
                                1. Choose your content
                            </h3>
                            <p className="mb-4 text-sm text-muted-foreground">
                                Select a screen or window source to display on
                                the canvas.
                            </p>
                            <Button
                                onClick={() => setStep(2)}
                                className="w-full"
                            >
                                Get Started
                            </Button>
                        </div>
                    )}

                    {/* Step 2 */}
                    {step === 2 && (
                        <div>
                            <h3 className="text-sm font-medium">
                                2. Add your camera
                            </h3>
                            <p className="mb-4 text-sm text-muted-foreground">
                                Enable your camera in the right sidebar. It
                                stays fixed below your profile - no floating
                                windows.
                            </p>
                            <Button
                                onClick={() => setStep(3)}
                                className="w-full"
                            >
                                Next
                            </Button>
                        </div>
                    )}

                    {/* Step 3 */}
                    {step === 3 && (
                        <div>
                            <h3 className="text-sm font-medium">
                                3. Enter fullscreen
                            </h3>
                            <p className="mb-4 text-sm text-muted-foreground">
                                Press F11 or Ctrl+Shift+F to enter fullscreen
                                mode. The editor UI will disappear.
                            </p>
                            <Button
                                onClick={() => setStep(4)}
                                className="w-full"
                            >
                                Got it
                            </Button>
                        </div>
                    )}

                    {/* Step 4 */}
                    {step === 4 && (
                        <div>
                            <h3 className="text-sm font-medium">
                                4. Record with your phone
                            </h3>
                            <p className="mb-4 text-sm text-muted-foreground">
                                Place your smartphone beside the laptop to
                                record the physical setup.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Creator Screen does not record video - it only
                                displays the composition.
                            </p>
                            <Button onClick={handleComplete} className="w-full">
                                Get Started
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
