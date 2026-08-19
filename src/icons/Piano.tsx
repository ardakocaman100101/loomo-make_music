import type { LucideProps } from '@/icons'

export function Piano({
  width,
  height,
  size = 24,
  style,
  className,
  onClick,
  color = 'currentColor',
  strokeWidth = 2,
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
      <line x1="4" y1="9" x2="4" y2="15" />
      <line x1="8.5" y1="5" x2="8.5" y2="19" strokeWidth="2.5" />
      <line x1="13" y1="8" x2="13" y2="16" />
      <line x1="17.5" y1="3" x2="17.5" y2="21" strokeWidth="2.5" />
      <line x1="22" y1="10" x2="22" y2="14" />
    </svg>
  )
}

export default Piano
