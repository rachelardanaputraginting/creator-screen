import { Card, CardContent } from "@/components/ui/card";

export const TECH_ITEMS: string[] = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Zustand",
  "MediaRecorder",
  "1080p HD",
];

function MarqueeRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="flex w-max shrink-0 items-center" aria-hidden={hidden || undefined}>
      {TECH_ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="px-4 text-sm text-muted-foreground">{item}</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
        </span>
      ))}
    </div>
  );
}

export default function TechMarquee(): React.JSX.Element {
  return (
    <Card size="sm">
      <CardContent className="overflow-hidden">
        <div className="animate-tech-marquee flex w-max">
          <MarqueeRow />
          <MarqueeRow hidden />
        </div>
      </CardContent>
    </Card>
  );
}
