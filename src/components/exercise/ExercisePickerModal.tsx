import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Exercise } from '@/types/supabase'
import { searchExercises, filterExercises, sortExercises, collectBodyParts, collectEquipment, collectTargets, EMPTY_FILTERS, type PickerFilters } from '@/lib/picker/pickerHelpers'
import { ExercisePickerCard } from './ExercisePickerCard'
import { FilterSheet } from './FilterSheet'

interface ExercisePickerModalProps {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onAdd?: (exercises: Exercise[]) => void
}

const CHIPS = ['Todos', 'Pecho', 'Espalda', 'Brazos', 'Piernas', 'Recientes', 'Cuerpo libre', 'Mancuernas', 'Barra', 'Polea']

export function ExercisePickerModal({
  open,
  onClose,
  exercises,
  selectedIds,
  onSelectionChange,
  onAdd,
}: ExercisePickerModalProps) {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState('Todos')
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_FILTERS)
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false)

  const bodyParts = useMemo(() => collectBodyParts(exercises), [exercises])
  const equipmentOptions = useMemo(() => collectEquipment(exercises), [exercises])
  const targetOptions = useMemo(() => collectTargets(exercises), [exercises])

  const filtered = useMemo(() => {
    let searched = searchExercises(exercises, query)
    searched = filterExercises(searched, filters)
    if (activeChip !== 'Todos' && activeChip !== 'Recientes') {
      const lower = activeChip.toLowerCase()
      if (lower.includes('cuerpo') || lower.includes('mancuer') || lower.includes('barra') || lower.includes('polea')) {
        searched = searched.filter((ex) => {
          const eq = ((ex as any).equipment || '').toLowerCase()
          if (lower === 'cuerpo libre') return eq.includes('body') || eq.includes('none') || eq === ''
          if (lower === 'mancuernas') return eq.includes('dumbbell') || eq.includes('mancuer')
          if (lower === 'barra') return eq.includes('barbell') || eq.includes('barra')
          if (lower === 'polea') return eq.includes('cable') || eq.includes('machine')
          return eq.includes(lower)
        })
      } else {
        searched = searched.filter((ex) => ((ex as any).body_part || '').toLowerCase().includes(lower) || ((ex as any).target || '').toLowerCase().includes(lower))
      }
    }
    return sortExercises(searched, 'name')
  }, [exercises, query, filters, activeChip])

  const isChecked = (id: string) => selectedIds.includes(id)
  const handleToggle = (id: string) => {
    const next = isChecked(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]
    onSelectionChange(next)
  }

  if (!open) return null

  const toAdd = exercises.filter((e) => selectedIds.includes(e.id))

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-4'>
      <div className='flex h-full w-full flex-col bg-neutral-950 sm:h-[90vh] sm:w-[95vw] sm:rounded-xl sm:border sm:border-white/10'>
        <div className='flex items-center gap-2 border-b border-white/10 px-4 py-3'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500' />
            <input
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Buscar ejercicio...'
              className='w-full rounded-lg border border-white/10 bg-neutral-950/60 py-2 pl-9 pr-3 text-sm text-neutral-100'
            />
            {query && (
              <button type='button' onClick={() => setQuery('')} className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500'>
                <X className='h-3.5 w-3.5' />
              </button>
            )}
          </div>
          <button type='button' onClick={onClose} className='rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200'>
            Cerrar
          </button>
        </div>

        <div className='flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-2'>
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type='button'
              onClick={() => setActiveChip(chip)}
              className={activeChip === chip ? 'whitespace-nowrap rounded-full px-3 py-1 text-xs bg-accent text-neutral-950' : 'whitespace-nowrap rounded-full px-3 py-1 text-xs bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className='flex-1 overflow-auto px-4 py-3'>
          <div className='mb-2 text-xs text-neutral-500'>{filtered.length} ejercicios</div>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
            {filtered.map((ex) => (
              <ExercisePickerCard
                key={ex.id}
                exercise={ex}
                selected={isChecked(ex.id)}
                onToggleSelect={handleToggle}
                view='grid'
              />
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && onAdd && (
          <div className='sticky bottom-0 border-t border-white/10 bg-neutral-950/95 p-3 backdrop-blur'>
            <button
              type='button'
              onClick={() => onAdd(toAdd)}
              className='w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-neutral-950 hover:brightness-110'
            >
              Agregar ({selectedIds.length}) ejercicios a la rutina ➔
            </button>
          </div>
        )}
      </div>

      <FilterSheet open={isFilterSheetOpen} onClose={() => setFilterSheetOpen(false)} filters={filters} onChange={setFilters} bodyParts={bodyParts} equipmentOptions={equipmentOptions} targetOptions={targetOptions} />
    </div>
  )
}
