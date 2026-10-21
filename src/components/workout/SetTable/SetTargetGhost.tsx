import { TEXT, TYPE } from '../../../design/tokens'

export function SetTargetGhost({ text }: { text?: string | null }) {
  if (!text) return null
  return (
    <div style={{ fontSize: TYPE.label.size, color: TEXT.tertiary, paddingLeft: 60 }}>
      {text}
    </div>
  )
}
