$lines = Get-Content src/components/workout/ExerciseActions.tsx
$before = $lines[0..47]   # up to line 48 inclusive (0-index)
$exportLine = 'export type ExerciseActionId = (typeof EXERCISE_ACTIONS)[number]["id"];'
$after = $lines[48..($lines.Length-1)]
$newLines = $before + @($exportLine) + $after
Set-Content src/components/workout/ExerciseActions.tsx $newLines