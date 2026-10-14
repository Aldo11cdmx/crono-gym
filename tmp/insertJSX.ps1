$lines = Get-Content src/components/ActiveWorkout.tsx
$before = $lines[0..880]   # up to line 881 inclusive (0-index)
$jsxLines = @(
  '      {equipmentModalOpen && <EquipmentModal equipmentId={selectedEquipmentId} onClose={() => setEquipmentModalOpen(false)} triggerEl={document.activeElement as HTMLElement | null} />}',
  '      {gripPopoverOpen && <GripPopover grip={selectedGrip} anchorEl={document.activeElement} onClose={() => setGripPopoverOpen(false)} />}'
)
$after = $lines[881..($lines.Length-1)]
$newLines = $before + $jsxLines + $after
Set-Content src/components/ActiveWorkout.tsx $newLines