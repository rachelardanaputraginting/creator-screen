"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Monitor, AppWindow, Grid } from "lucide-react";
import type { CaptureSource } from "@/types/bridge";

/**
 * Source picker shown when the desktop shell asks the renderer to choose a
 * screen or window for getDisplayMedia. Renders nothing in a normal browser
 * (the bridge is absent).
 */
export function CaptureSourcePicker() {
    const [sources, setSources] = useState<CaptureSource[]>([]);
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"screen" | "window" | "all">("screen");

    useEffect(() => {
        const bridge = window.creatorScreen;
        if (!bridge) return;
        return bridge.onPickerRequest((next) => {
            setSources(next);
            // Default to "screen" if full screens are available, else "all"
            const hasScreen = next.some((s) => s.kind === "screen");
            setActiveTab(hasScreen ? "screen" : "all");
            setOpen(true);
        });
    }, []);

    const choose = (id: string) => {
        setOpen(false);
        window.creatorScreen?.selectSource(id);
    };

    if (!open) return null;

    const screenSources = sources.filter((s) => s.kind === "screen");
    const windowSources = sources.filter((s) => s.kind === "window");

    const filteredSources =
        activeTab === "screen"
            ? screenSources
            : activeTab === "window"
              ? windowSources
              : sources;

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) choose("");
            }}
        >
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="flex items-center gap-2">
                            <Monitor className="size-5 text-primary" />
                            Pilih Sumber Tangkapan Layar
                        </DialogTitle>
                        <DialogDescription>
                            Pilih layar penuh (Entire Screen) untuk hasil terbaik atau jendela aplikasi tertentu.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as "screen" | "window" | "all")}
                    >
                        <TabsList>
                            <TabsTrigger value="screen" className="flex items-center gap-1.5">
                                <Monitor className="size-4" />
                                Layar Penuh ({screenSources.length})
                            </TabsTrigger>
                            <TabsTrigger value="window" className="flex items-center gap-1.5">
                                <AppWindow className="size-4" />
                                Jendela Aplikasi ({windowSources.length})
                            </TabsTrigger>
                            <TabsTrigger value="all" className="flex items-center gap-1.5">
                                <Grid className="size-4" />
                                Semua ({sources.length})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {filteredSources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                            Tidak ada sumber {activeTab === "screen" ? "layar penuh" : activeTab === "window" ? "jendela" : ""} yang tersedia.
                        </p>
                        {activeTab !== "all" && sources.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("all")}
                                className="mt-2 text-xs text-primary underline"
                            >
                                Tampilkan semua sumber ({sources.length})
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                        {filteredSources.map((source) => {
                            const isScreen = source.kind === "screen";
                            return (
                                <button
                                    key={source.id}
                                    type="button"
                                    onClick={() => choose(source.id)}
                                    className="group relative flex flex-col gap-2 rounded-lg border border-border p-2.5 text-left transition-all hover:border-primary hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                                >
                                    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                                        {source.thumbnail ? (
                                            <span
                                                role="img"
                                                aria-label={source.name}
                                                className="absolute inset-0 bg-cover bg-center transition-transform duration-200 group-hover:scale-105"
                                                style={{
                                                    backgroundImage: `url(${source.thumbnail})`,
                                                }}
                                            />
                                        ) : (
                                            <div className="flex size-full items-center justify-center text-muted-foreground">
                                                {isScreen ? (
                                                    <Monitor className="size-8" />
                                                ) : (
                                                    <AppWindow className="size-8" />
                                                )}
                                            </div>
                                        )}
                                        <Badge
                                            variant={isScreen ? "default" : "secondary"}
                                            className="absolute top-1.5 left-1.5 text-[10px] shadow-xs"
                                        >
                                            {isScreen ? "Layar Penuh" : "Jendela"}
                                        </Badge>
                                    </div>
                                    <div className="flex min-w-0 flex-col">
                                        <span
                                            className="truncate text-xs font-medium text-foreground group-hover:text-primary"
                                            title={source.name}
                                        >
                                            {source.name}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {isScreen ? "Entire Display" : "Application Window"}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default CaptureSourcePicker;
