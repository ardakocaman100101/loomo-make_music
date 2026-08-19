import type { LucideProps } from '@/icons'

export default function LeftHand({
  width,
  height,
  size = 24,
  style,
  className,
  onClick,
  color = 'currentColor',
  strokeWidth = 1.75,
}: LucideProps) {
  const w = width ?? size
  const h = height ?? size
  return (
    <svg
      width={w}
      height={h}
      style={style}
      className={className}
      onClick={onClick}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 11V6a1.5 1.5 0 0 0-3 0v4" />
      <path d="M15 10V4.5a1.5 1.5 0 0 0-3 0v5.5" />
      <path d="M12 10V5a1.5 1.5 0 0 0-3 0v6" />
      <path d="M9 11V8a1.5 1.5 0 0 0-3 0v7a6 6 0 0 0 6 6h1.5a6.5 6.5 0 0 0 6.5-6.5V12a1.5 1.5 0 0 0-3 0v-1" />
    </svg>
  )
}
