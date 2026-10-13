"use client";

import { useEffect, useRef, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STORAGE_KEY, DEFAULT_ABOUT, type AboutData } from "@/app/lib/about";
import { Pencil, Upload, X } from "lucide-react";

const PHOTO_MAX_EDGE = 320;

function initialsOf(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export default function AboutPanel({ clean = false }: { clean?: boolean }) {
    const [data, setData] = useState<AboutData>(DEFAULT_ABOUT);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<AboutData>(DEFAULT_ABOUT);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        setPhotoError(null);
        setEditing(true);
    };

    const save = () => {
        setData(draft);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        } catch {
            /* quota penuh — data tetap hidup di memori selama tab terbuka */
        }
        setEditing(false);
    };

    // Resize via canvas supaya foto tidak memenuhi kuota localStorage.
    const handlePhotoFile = (file: File | undefined) => {
        if (!file) return;
        setPhotoError(null);
        if (!file.type.startsWith("image/")) {
            setPhotoError("File harus berupa gambar.");
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const scale = Math.min(
                1,
                PHOTO_MAX_EDGE / Math.max(img.width, img.height),
            );
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                setPhotoError("Gagal memproses gambar.");
                return;
            }
            ctx.drawImage(img, 0, 0, w, h);
            try {
                setDraft((d) => ({
                    ...d,
                    photo: canvas.toDataURL("image/jpeg", 0.85),
                }));
            } catch {
                setPhotoError("Gagal memproses gambar.");
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            setPhotoError("Gambar tidak bisa dibaca.");
        };
        img.src = objectUrl;
    };

    const initials = initialsOf(data.name);

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
                            {data.photo && (
                                <AvatarImage
                                    src={data.photo}
                                    alt={data.name || "Foto profil"}
                                />
                            )}
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
                    if (!open) {
                        setDraft(data);
                        setPhotoError(null);
                    }
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
                            <Label>Foto profil</Label>
                            <div className="flex items-center gap-3">
                                <Avatar size="lg">
                                    {draft.photo && (
                                        <AvatarImage
                                            src={draft.photo}
                                            alt=""
                                        />
                                    )}
                                    <AvatarFallback>
                                        {initialsOf(draft.name) || "-"}
                                    </AvatarFallback>
                                </Avatar>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        handlePhotoFile(
                                            e.target.files?.[0],
                                        );
                                        e.target.value = "";
                                    }}
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    <Upload /> Unggah foto
                                </Button>
                                {draft.photo && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-label="Hapus foto"
                                        title="Hapus foto"
                                        onClick={() =>
                                            setDraft((d) => ({
                                                ...d,
                                                photo: undefined,
                                            }))
                                        }
                                    >
                                        <X />
                                    </Button>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                JPG/PNG — otomatis dikecilkan supaya ringan.
                            </p>
                            {photoError && (
                                <p className="text-xs text-destructive">
                                    {photoError}
                                </p>
                            )}
                        </div>
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
                                setPhotoError(null);
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
