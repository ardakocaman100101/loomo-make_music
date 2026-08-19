import type { LucideProps } from '@/icons'

export function Play({
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
      <path d="M7.05 3.69A2.25 2.25 0 0 0 3.5 5.56v12.88c0 1.76 1.95 2.84 3.55 1.87l10.82-6.44a2.25 2.25 0 0 0 0-3.74L7.05 3.69Z" />
    </svg>
  )
}

export default Play
