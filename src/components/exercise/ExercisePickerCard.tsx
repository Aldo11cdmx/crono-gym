import { useMemo } from 'react'
import type { Exercise } from '@/types/supabase'
import { useMediaSrc } from '@/lib/media/useMediaSrc'
import { getExerciseDisplayName } from '@/utils/exerciseTranslation'

interface ExercisePickerCardProps {
  exercise: Exercise
  selected: boolean
  alreadyAdded?: boolean
  favorite?: boolean
  oneRepMax?: number
  onToggleSelect: (id: string) => void
  onToggleFavorite?: () => void
  onOpenDetail?: () => void
  view: 'grid' | 'list'
}

function getThumbnailSrc(exercise: Exercise): string | undefined {
  const gifUrl = (exercise as any).gif_url || (exercise as any).gifUrl
  if (gifUrl && typeof gifUrl === 'string') {
    if (gifUrl.startsWith('/media/')) return gifUrl
    if (gifUrl.includes('hevy') || gifUrl.includes('symmetry')) {
      const parts = gifUrl.split('/')
      const filename = parts[parts.length - 1]
      if (filename && filename.includes('hevy')) return '/media/hevy/' + filename
      if (filename && filename.includes('symmetry')) return '/media/symmetry/' + filename
      return '/media/' + filename
    }
    if (gifUrl.startsWith('http')) return gifUrl
    const parts = gifUrl.split('/')
    const filename = parts[parts.length - 1]
    if (filename) return '/media/' + filename
  }
  return undefined
}

export function ExercisePickerCard({
  exercise,
  selected,
  alreadyAdded,
  onToggleSelect,
}: ExercisePickerCardProps) {
  const thumbSrc = useMemo(() => getThumbnailSrc(exercise), [exercise])
  const resolvedSrc = thumbSrc ? useMediaSrc(thumbSrc as any) : undefined

  const handleSelect = () => {
    onToggleSelect(exercise.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`relative z-10 flex cursor-pointer pointer-events-auto flex-col rounded-lg border p-3 transition-all active:scale-[0.98] hover:border-red-500/50 ${selected ? 'border-red-500/50 bg-accent/10' : 'border-white/10 bg-neutral-950/40'}`}
      onClick={handleSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect() } }}
    >
      <div className='mb-2 flex items-center justify-between pointer-events-none'>
        <div className='flex items-center gap-2'>
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-red-500 bg-red-500 text-white' : 'border-white/30 bg-neutral-950'}`}
          >
            {selected && <span className='text-[10px]'>✓</span>}
          </span>
          {alreadyAdded && <span className='text-[10px] text-neutral-400'>Añadido</span>}
        </div>
      </div>
      <div className='mb-2 aspect-square overflow-hidden rounded bg-neutral-900/50 pointer-events-none'>
        {resolvedSrc ? (
          <img src={resolvedSrc as any} alt={getExerciseDisplayName(exercise)} className='h-full w-full object-cover pointer-events-none' loading='lazy' />
        ) : (
          <div className='flex h-full w-full items-center justify-center text-xs text-neutral-600'>Sin imagen</div>
        )}
      </div>
      <div className='flex-1 pointer-events-none'>
        <p className='line-clamp-2 text-xs font-medium text-neutral-100'>{getExerciseDisplayName(exercise)}</p>
        <p className='mt-1 text-[10px] text-neutral-400'>
          {(exercise as any).body_part} • {(exercise as any).equipment}
        </p>
        {(exercise as any).target && <p className='text-[10px] text-neutral-500'>{(exercise as any).target}</p>}
      </div>
    </div>
  )
}
