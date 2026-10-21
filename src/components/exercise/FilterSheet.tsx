import type { PickerFilters } from '@/lib/picker/pickerHelpers'

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  filters: PickerFilters
  onChange: (filters: PickerFilters) => void
  bodyParts: string[]
  equipmentOptions: string[]
  targetOptions: string[]
}

export function FilterSheet({ open, onClose }: FilterSheetProps) {
  if (!open) return null
  return (
    <div className='fixed inset-0 z-60 bg-black/70' onClick={onClose}>
      <div className='absolute right-0 h-full w-80 bg-neutral-950 p-4' onClick={(e) => e.stopPropagation()}>
        <div className='flex justify-end'>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
