import type { LucideProps } from '@/icons'
import { cn } from '@/utils'

export default function Logo({
  width,
  height,
  size,
  className,
  style,
  onClick,
}: LucideProps) {
  return (
    <div
      className={cn('inline-flex items-center justify-center shrink-0 select-none', className)}
      style={{
        width: width ?? size ?? undefined,
        height: height ?? size ?? undefined,
        ...style,
      }}
      onClick={onClick as any}
    >
      {/* Light Theme Logo: Authentic Image with Black Border on Transparent Background */}
      <img
        src="/images/logo_light.png"
        alt="loomou logo"
        className="h-full w-full object-contain dark:hidden"
        draggable={false}
      />
      {/* Dark Theme Logo: Authentic Image with White Keys on Transparent Background */}
      <img
        src="/images/logo_dark.png"
        alt="loomou logo"
        className="hidden h-full w-full object-contain dark:inline-block"
        draggable={false}
      />
    </div>
  )
}

