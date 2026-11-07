"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@/stores/canvas-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    ArrowDown,
    ArrowUp,
    Plus,
    RotateCcw,
    Settings2,
    X,
} from "lucide-react";

export const DEFAULT_TECH_ITEMS: string[] = [
    "Next.js",
    "React",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "Zustand",
    "MediaRecorder",
    "1080p HD",
];

function ItemsSpan({ items }: { items: string[] }): React.JSX.Element {
    return (
        <div className="flex w-max shrink-0 items-center">
            {items.map((item, i) => (
                <span key={i} className="flex items-center">
                    <span className="px-4 text-sm text-muted-foreground whitespace-nowrap">
                        {item}
                    </span>
                    <span className="size-1 rounded-full bg-muted-foreground/40" />
                </span>
            ))}
        </div>
    );
}

export default function TechMarquee({
    editable = false,
}: {
    editable?: boolean;
}): React.JSX.Element {
    const storedItems = useStore((s) => s.marqueeItems);
    const duration = useStore((s) => s.marqueeDurationSec);
    const setMarqueeItems = useStore((s) => s.setMarqueeItems);
    const setMarqueeDurationSec = useStore((s) => s.setMarqueeDurationSec);
    const items =
        storedItems && storedItems.length > 0 ? storedItems : DEFAULT_TECH_ITEMS;

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const probeRef = useRef<HTMLDivElement | null>(null);
    // Satu baris harus selebar minimal wadah supaya sambungan antar loop
    // tidak meninggalkan celah kosong.
    const [copies, setCopies] = useState(2);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");

    useLayoutEffect(() => {
        const wrap = wrapRef.current;
        const probe = probeRef.current;
        if (!wrap || !probe) return;
        const update = () => {
            const rowWidth = probe.scrollWidth;
            const containerWidth = wrap.clientWidth;
            if (rowWidth <= 0) return;
            const next = Math.max(1, Math.ceil(containerWidth / rowWidth));
            setCopies((c) => (c === next ? c : next));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(probe);
        ro.observe(wrap);
        return () => ro.disconnect();
    }, [items]);

    const addItem = () => {
        const value = draft.trim();
        if (!value) return;
        const next = [...items, value];
        setMarqueeItems(next);
        setDraft("");
    };

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        setMarqueeItems(next);
    };

    return (
        <Card size="sm">
            <CardContent className="flex items-center gap-1 p-0 overflow-hidden">
                <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden">
                    <div
                        ref={probeRef}
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0"
                    >
                        <ItemsSpan items={items} />
                    </div>
                    <div
                        className="animate-tech-marquee flex w-max"
                        style={{ animationDuration: `${duration}s` }}
                    >
                        <div className="flex w-max shrink-0">
                            {Array.from({ length: copies }, (_, c) => (
                                <ItemsSpan key={`a${c}`} items={items} />
                            ))}
                        </div>
                        <div className="flex w-max shrink-0" aria-hidden>
                            {Array.from({ length: copies }, (_, c) => (
                                <ItemsSpan key={`b${c}`} items={items} />
                            ))}
                        </div>
                    </div>
                </div>
                {editable && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger
                            render={
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 shrink-0"
                                    aria-label="Kelola marquee"
                                />
                            }
                        >
                            <Settings2 className="size-4" />
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Kelola marquee</DialogTitle>
                                <DialogDescription>
                                    Daftar berjalan di bawah preview. Ganti,
                                    atur urutan, atau atur kecepatannya.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-wrap gap-1.5">
                                {items.map((item, i) => (
                                    <Badge
                                        key={`${item}-${i}`}
                                        variant="secondary"
                                        className="gap-1 pr-1"
                                    >
                                        {item}
                                        <button
                                            type="button"
                                            aria-label={`Turunkan ${item}`}
                                            className="rounded-sm opacity-60 hover:opacity-100"
                                            onClick={() => move(i, 1)}
                                        >
                                            <ArrowDown className="size-3" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Naikkan ${item}`}
                                            className="rounded-sm opacity-60 hover:opacity-100"
                                            onClick={() => move(i, -1)}
                                        >
                                            <ArrowUp className="size-3" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Hapus ${item}`}
                                            className="rounded-sm opacity-60 hover:opacity-100"
                                            onClick={() =>
                                                setMarqueeItems(
                                                    items.filter(
                                                        (_, j) => j !== i,
                                                    ),
                                                )
                                            }
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="Mis. OBS, Rust…"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") addItem();
                                    }}
                                />
                                <Button size="sm" onClick={addItem}>
                                    <Plus /> Tambah
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="marquee-speed">
                                    Durasi loop (detik)
                                </Label>
                                <Input
                                    id="marquee-speed"
                                    type="number"
                                    min={8}
                                    max={120}
                                    className="w-24"
                                    value={duration}
                                    onChange={(e) =>
                                        setMarqueeDurationSec(
                                            Number(e.target.value),
                                        )
                                    }
                                />
                            </div>
                            <div className="flex justify-between">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                        setMarqueeItems(
                                            DEFAULT_TECH_ITEMS,
                                        )
                                    }
                                >
                                    <RotateCcw /> Bawaan
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setOpen(false)}
                                >
                                    Selesai
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </CardContent>
        </Card>
    );
}
