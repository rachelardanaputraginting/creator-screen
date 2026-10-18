"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { CaptureSource } from "@/types/electron";

/**
 * Source picker shown when the Electron shell asks the renderer to choose a
 * screen or window for getDisplayMedia. Renders nothing in a normal browser
 * (the bridge is absent).
 */
export function CaptureSourcePicker() {
    const [sources, setSources] = useState<CaptureSource[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const bridge = window.creatorScreen;
        if (!bridge) return;
        return bridge.onPickerRequest((next) => {
            setSources(next);
            setOpen(true);
        });
    }, []);

    const choose = (id: string) => {
        setOpen(false);
        window.creatorScreen?.selectSource(id);
    };

    if (!open) return null;

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) choose("");
            }}
        >
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Pilih sumber layar</DialogTitle>
                    <DialogDescription>
                        Pilih layar atau jendela yang ingin dibagikan.
                    </DialogDescription>
                </DialogHeader>
                {sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Tidak ada sumber yang tersedia.
                    </p>
                ) : (
                    <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                        {sources.map((source) => (
                            <button
                                key={source.id}
                                type="button"
                                onClick={() => choose(source.id)}
                                className="flex flex-col gap-2 rounded-md border border-border p-2 text-left transition-colors hover:bg-accent"
                            >
                                <span
                                    role="img"
                                    aria-label={source.name}
                                    className="aspect-video w-full rounded bg-muted bg-cover bg-center"
                                    style={
                                        source.thumbnail
                                            ? {
                                                  backgroundImage: `url(${source.thumbnail})`,
                                              }
                                            : undefined
                                    }
                                />
                                <span className="truncate text-xs text-foreground">
                                    {source.name}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default CaptureSourcePicker;
