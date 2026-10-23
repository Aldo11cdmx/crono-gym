import { SET_LOGGER_LABELS } from '../../../lib/i18n'
import { SPACE, TEXT, TYPE } from '../../../design/tokens'

const headerStyle = {
  display: 'grid',
  gridTemplateColumns: '60px 1fr 1fr 44px 44px',
  alignItems: 'center',
  gap: SPACE.sm,
  paddingInline: SPACE.md,
  paddingBlock: SPACE.sm,
}

const cellStyle = {
  fontSize: TYPE.label.size,
  lineHeight: TYPE.label.size,
  color: TEXT.tertiary,
  textAlign: 'center' as const,
}

export function SetTableHeader() {
  return (
    <div style={headerStyle}>
      <span style={cellStyle}>{SET_LOGGER_LABELS.setTypeGroupAriaLabel}</span>
      <span style={cellStyle}>KG</span>
      <span style={cellStyle}>{SET_LOGGER_LABELS.repsLabel}</span>
      <span />
      <span />
    </div>
  )
}
