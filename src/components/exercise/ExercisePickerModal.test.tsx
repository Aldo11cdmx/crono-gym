/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ExercisePickerModal } from './ExercisePickerModal'

afterEach(cleanup)

const exercises = [
  { id: '1', name: 'Bench Press', body_part: 'Pecho', equipment: 'Barra' } as any,
  { id: '2', name: 'Curl', body_part: 'Brazos', equipment: 'Mancuernas' } as any,
  { id: '3', name: 'band wrist curl', body_part: 'Antebrazos', equipment: 'Banda' } as any,
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

  it('shows the Spanish name of a catalog exercise', () => {
    render(
      <ExercisePickerModal
        open={true}
        onClose={() => {}}
        exercises={exercises}
        onSelect={() => {}}
      />
    )
    expect(screen.getAllByText('Curl de muñeca con banda').length).toBeGreaterThan(0)
  })

  it('finds an exercise by the Spanish name shown in the card', () => {
    render(
      <ExercisePickerModal
        open={true}
        onClose={() => {}}
        exercises={exercises}
        onSelect={() => {}}
      />
    )
    const search = screen.getByLabelText('Buscar ejercicio')
    // Accents are optional in the query: "muneca" must find "muñeca".
    fireEvent.change(search, { target: { value: 'muneca' } })

    expect(screen.getAllByText('Curl de muñeca con banda').length).toBeGreaterThan(0)
    expect(screen.queryByText('Bench Press')).toBeNull()
  })
})
