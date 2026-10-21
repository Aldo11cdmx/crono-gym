export function SetTargetGhost({ text }: { text?: string | null }) {
  if (!text) return null
  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', paddingLeft: 60 }}>
      {text}
    </div>
  )
}
