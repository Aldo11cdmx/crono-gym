/**
 * @vitest-environment jsdom
 */
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
    const onSelect = vi.fn()
    render(
      <ExercisePickerModal
        open={true}
        onClose={onClose}
        exercises={exercises}
        onSelect={onSelect}
      />
    )
    expect(screen.getAllByText('Pecho').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mancuernas').length).toBeGreaterThan(0)
  })

  it('renders exercise cards with names and muscle badges', () => {
    const onSelect = vi.fn()
    render(
      <ExercisePickerModal
        open={true}
        onClose={() => {}}
        exercises={exercises}
        onSelect={onSelect}
      />
    )
    expect(screen.getAllByText('Bench Press').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Curl').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('exercise-picker-card').length).toBeGreaterThanOrEqual(2)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <ExercisePickerModal
        open={false}
        onClose={() => {}}
        exercises={exercises}
        onSelect={() => {}}
      />
    )
    expect(container.innerHTML).toBe('')
  })
})
