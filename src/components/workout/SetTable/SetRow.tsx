import { Check } from 'lucide-react'
import { STATUS, RADIUS, GLASS, TEXT } from '../../../design/tokens'

export function SetRow({
  index,
  completed,
  onToggle,
}: {
  index: number
  completed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type='button'
      onClick={onToggle}
      aria-label={'Marcar serie ' + (index + 1) + ' como completada'}
      style={{
        width: 40,
        height: 40,
        borderRadius: RADIUS.pill,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: completed ? '1px solid ' + STATUS.success.border : '1px solid ' + GLASS.border,
        background: completed ? STATUS.success.muted : 'transparent',
        color: completed ? STATUS.success.text : TEXT.tertiary,
      }}
    >
      <Check size={16} />
    </button>
  )
}
