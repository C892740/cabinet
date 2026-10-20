export { ArrowRightIcon, LockIcon, UnlockIcon } from "../Icons";
import type { IconProps } from "../Icons";

export const KeyIcon = ({ size = 22, ...props }: IconProps) => (
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
    <circle cx="8" cy="14.5" r="4" />
    <path d="m11 11.5 8-8M17 3.5l2.5 2.5M14.5 6l2.5 2.5" />
  </svg>
);
