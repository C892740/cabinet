import { platforms } from "@/lib/demo-data";

export function PlatformMarquee() {
  const row = [...platforms, ...platforms];
  return (
    <section className="border-y border-white/[0.07] bg-white/[0.02] py-7">
      <div className="mask-fade-x overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-14 px-8">
          {row.map((platform, index) => (
            <div key={`${platform.slug}-${index}`} className="flex items-center gap-3 opacity-60">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: platform.colorA }}
              />
              <span className="whitespace-nowrap text-sm font-medium tracking-wide text-white/80">
                {platform.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
