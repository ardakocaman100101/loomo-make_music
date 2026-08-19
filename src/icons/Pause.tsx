import type { LucideProps } from '@/icons'

export function Pause({
  width,
  height,
  size = 24,
  style,
  className,
  onClick,
  color = 'currentColor',
  fill = 'currentColor',
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
      fill={fill}
      {...props}
    >
      <rect x="6" y="4" width="4" height="16" rx="2" />
      <rect x="14" y="4" width="4" height="16" rx="2" />
    </svg>
  )
}

export default Pause
