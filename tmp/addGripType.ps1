$lines = Get-Content src/components/ActiveWorkout.tsx
$before = $lines[0..68]
$importLine = 'import type { Grip } from "@/data/gripMap";'
$after = $lines[69..($lines.Length-1)]
$newLines = $before + @($importLine) + $after
Set-Content src/components/ActiveWorkout.tsx $newLines