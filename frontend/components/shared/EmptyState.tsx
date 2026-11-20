import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
      <Icon className="h-8 w-8" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs">{description}</p>}
    </div>
  )
}
