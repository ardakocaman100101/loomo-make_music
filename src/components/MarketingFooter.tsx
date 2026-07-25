import { cn } from '@/utils'
import React, { PropsWithChildren } from 'react'
import { Link } from 'react-router'

function FooterHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-900 uppercase dark:text-white">
      {children}
    </h3>
  )
}

function FooterCol({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3', className)}>{children}</div>
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isExternal = href.startsWith('http')
  const Component = isExternal ? 'a' : Link
  const props = isExternal ? { href, target: '_blank', rel: 'noreferrer' } : { to: href }

  return (
    // @ts-ignore
    <Component
      {...props}
      className="text-sm text-gray-500 transition-colors hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
    >
      {children}
    </Component>
  )
}

export function MarketingFooter() {
  return (
    <footer className="bg-[#131313] py-12 dark:bg-[#131313]">
      <div className="mx-auto max-w-(--breakpoint-lg) px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-xs text-gray-400">loomo by Arda</span>
        </div>
      </div>
    </footer>
  )
}
