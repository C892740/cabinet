import type { IconProps } from "../Icons";

export const MonitorIcon = ({ size = 22, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2.5" y="4.5" width="19" height="12.5" rx="2.5" />
    <path d="M8 20.5h8M12 17v3.5" />
  </svg>
);
