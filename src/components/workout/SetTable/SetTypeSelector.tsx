import { Flame, Flag, Layers, TrendingUp } from 'lucide-react'
import { SET_KINDS, type SetKind } from '../../../lib/workout/setKind'
import { RADIUS, GLASS, TEXT } from '../../../design/tokens'

const KIND_ICON: Record<SetKind, typeof Flame> = {
  normal: TrendingUp,
  warmup: Flame,
  failure: Flag,
  drop: Layers,
}

export function SetTypeSelector({ kind, onChange }: { kind: SetKind; onChange: (kind: SetKind) => void }) {
  const Icon = KIND_ICON[kind]
  return (
    <button
      type='button'
      onClick={() => {
        const idx = SET_KINDS.indexOf(kind)
        const next = SET_KINDS[(idx + 1) % SET_KINDS.length]
        onChange(next)
      }}
      title={kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: RADIUS.pill,
        border: '1px solid ' + GLASS.border,
        color: TEXT.primary,
      }}
    >
      <Icon size={16} />
    </button>
  )
}
