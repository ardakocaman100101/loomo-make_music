import type { LucideProps } from '@/icons'
import { cn } from '@/utils'

export default function Logo(props: LucideProps) {
  const { width, height, className, style } = props
  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden rounded-2xl p-0', className)}
      style={{ width, height, ...style }}
    >
      <img
        src="/loomo_logo.png?v=9"
        className="h-full w-full object-contain"
        style={{ imageRendering: 'auto' }}
        alt="loomo logo"
      />
    </div>
  )
}
