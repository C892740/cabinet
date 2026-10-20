import { GamepadIcon } from "./Icons";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="accent-gradient inline-flex items-center justify-center rounded-[28%] shadow-glow"
      style={{ width: size, height: size }}
    >
      <GamepadIcon size={size * 0.62} strokeWidth={1.9} className="text-white" />
    </span>
  );
}

export function Logo({ size = 34, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {withWordmark && (
        <span
          className="font-semibold tracking-tight text-white"
          style={{ fontSize: size * 0.55 }}
        >
          Cabinet
        </span>
      )}
    </span>
  );
}
