import type { LucideProps } from '@/icons'

export function Midi({
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
      {/* Rigid Opaque Keyboard Chassis */}
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke={color} strokeWidth={strokeWidth} />

      {/* Solid Opaque Black Keycaps */}
      <rect x="5.25" y="5" width="2.5" height="7.5" rx="0.75" fill={color} stroke={color} strokeWidth="0.5" />
      <rect x="9.5" y="5" width="2.5" height="7.5" rx="0.75" fill={color} stroke={color} strokeWidth="0.5" />
      <rect x="14.75" y="5" width="2.5" height="7.5" rx="0.75" fill={color} stroke={color} strokeWidth="0.5" />

      {/* Crisp White Key Separators */}
      <line x1="7.75" y1="12.5" x2="7.75" y2="19" stroke={color} strokeWidth={strokeWidth} />
      <line x1="13" y1="12.5" x2="13" y2="19" stroke={color} strokeWidth={strokeWidth} />
      <line x1="18.25" y1="12.5" x2="18.25" y2="19" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  )
}
