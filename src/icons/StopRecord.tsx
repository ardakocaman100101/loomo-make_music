import type { LucideProps } from '@/icons'

export function StopRecord({
  width,
  height,
  size = 24,
  style,
  className,
  onClick,
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
      <rect x="4" y="4" width="16" height="16" rx="4" className="hover:fill-purple-hover fill-red-500" />
    </svg>
  )
}

export default StopRecord
