import { Skeleton } from '@/components/ui/skeleton'

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="space-y-3 rounded-lg border p-4" style={{ height }}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-[calc(100%-2rem)] w-full" />
    </div>
  )
}

export function ChartSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <ChartSkeleton key={i} />
      ))}
    </div>
  )
}
