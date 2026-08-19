import type { LucideProps } from '@/icons'

export default function RightHand({
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
      <path d="M6 11V6a1.5 1.5 0 0 1 3 0v4" />
      <path d="M9 10V4.5a1.5 1.5 0 0 1 3 0v5.5" />
      <path d="M12 10V5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M15 11V8a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1.5A6.5 6.5 0 0 1 4 14.5V12a1.5 1.5 0 0 1 3 0v-1" />
    </svg>
  )
}
