import type { LucideProps } from '@/icons'

export function Sparkles({
  width,
  height,
  size = 24,
  style,
  className,
  onClick,
  color = 'currentColor',
  strokeWidth = 1.75,
  ...props
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
      {...props}
    >
      <path d="M2 12c2.5-6 5.5-6 8 0s5.5 6 8 0" strokeWidth="2.2" />
      <path d="M19 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={color} />
    </svg>
  )
}

export default Sparkles
