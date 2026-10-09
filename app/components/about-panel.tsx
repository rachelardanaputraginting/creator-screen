"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STORAGE_KEY, DEFAULT_ABOUT, type AboutData } from "@/app/lib/about";

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

    if (editing) {
        return (
            <Card size="sm">
                <CardHeader>
                    <CardTitle>Tentang saya</CardTitle>
                    <CardDescription>
                        Ditampilkan di samping preview.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1" onClick={save}>
                            Simpan
                        </Button>
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
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card size="sm">
            <CardHeader>
                <CardTitle>Tentang saya</CardTitle>
                {!clean && (
                    <CardAction>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(true)}
                        >
                            Edit
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
                <p className="mt-3 text-sm text-muted-foreground">{data.bio}</p>
                {data.link && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                        {data.link}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
