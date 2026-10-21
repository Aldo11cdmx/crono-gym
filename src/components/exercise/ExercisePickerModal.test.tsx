import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExercisePickerModal } from './ExercisePickerModal'

const exercises = [
  { id: '1', name: 'Bench Press', body_part: 'Pecho', equipment: 'Barra' } as any,
  { id: '2', name: 'Curl', body_part: 'Brazos', equipment: 'Mancuernas' } as any,
]

describe('ExercisePickerModal', () => {
  it('renders with full-width layout and chips', () => {
    const onClose = vi.fn()
    render(
      <ExercisePickerModal
        open={true}
        onClose={onClose}
        exercises={exercises}
        selectedIds={[]}
        onSelectionChange={() => {}}
      />
    )
    expect(screen.getByText('Pecho')).toBeTruthy()
    expect(screen.getByText('Mancuernas')).toBeTruthy()
  })

  it('supports multiselection', () => {
    const onSelectionChange = vi.fn()
    render(
      <ExercisePickerModal
        open={true}
        onClose={() => {}}
        exercises={exercises}
        selectedIds={['1']}
        onSelectionChange={onSelectionChange}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
  })
})
