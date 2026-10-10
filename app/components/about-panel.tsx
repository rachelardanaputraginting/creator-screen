"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STORAGE_KEY, DEFAULT_ABOUT, type AboutData } from "@/app/lib/about";
import { Pencil } from "lucide-react";

export default function AboutPanel({ clean = false }: { clean?: boolean }) {
    const [data, setData] = useState<AboutData>(DEFAULT_ABOUT);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<AboutData>(DEFAULT_ABOUT);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as AboutData;
                setData({ ...DEFAULT_ABOUT, ...parsed });
                setDraft({ ...DEFAULT_ABOUT, ...parsed });
            }
        } catch {
            /* keep defaults */
        }
    }, []);

    const openEditor = () => {
        setDraft(data);
        setEditing(true);
    };

    const save = () => {
        setData(draft);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        } catch {
            /* noop */
        }
        setEditing(false);
    };

    const initials = data.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <>
            <Card size="sm">
                <CardHeader>
                    <CardTitle>Tentang saya</CardTitle>
                    {!clean && (
                        <CardAction>
                            <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Edit tentang saya"
                                onClick={openEditor}
                            >
                                <Pencil />
                            </Button>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <Avatar size="lg">
                            <AvatarFallback>{initials || "-"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {data.name}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                                {data.role}
                            </p>
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        {data.bio}
                    </p>
                    {data.link && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                            {data.link}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={editing}
                onOpenChange={(open) => {
                    if (!open) setDraft(data);
                    setEditing(open);
                }}
            >
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit tentang saya</DialogTitle>
                        <DialogDescription>
                            Ditampilkan di samping preview.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="about-name">Nama</Label>
                            <Input
                                id="about-name"
                                value={draft.name}
                                onChange={(e) =>
                                    setDraft({ ...draft, name: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="about-role">Role</Label>
                            <Input
                                id="about-role"
                                value={draft.role}
                                onChange={(e) =>
                                    setDraft({ ...draft, role: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="about-bio">Bio singkat</Label>
                            <Input
                                id="about-bio"
                                value={draft.bio}
                                onChange={(e) =>
                                    setDraft({ ...draft, bio: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="about-link">Sosmed / link</Label>
                            <Input
                                id="about-link"
                                value={draft.link}
                                onChange={(e) =>
                                    setDraft({ ...draft, link: e.target.value })
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                setDraft(data);
                                setEditing(false);
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={save}
                        >
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
