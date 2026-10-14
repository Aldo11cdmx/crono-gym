$lines = Get-Content src/components/ActiveWorkout.tsx
$startIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].TrimStart().StartsWith('const actionHandlers:')) {
        $startIdx = $i
        break
    }
}
if ($startIdx -eq -1) { throw 'Start not found' }
$endIdx = -1
for ($i = $startIdx; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Trim() -eq '};') {
        $endIdx = $i
        break
    }
}
if ($endIdx -eq -1) { throw 'End not found' }
$newBlock = @'
  const actionHandlers: Partial<Record<ExerciseActionId, () => void>> = {
    avance: advance,
    nota: () => {
      journalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setNotice("Tus notas de la sesión están aquí abajo.");
    },
    cambiar: () => {
      if (!selected) return;
      setBrowsingFor(selected.key);
      setBrowsing(true);
    },
    ajustar: () => setGearOpen(true),
    maquina: () => {
      const equipName = selected?.exercise.equipment ?? "";
      const equipId = getEquipmentIdByName(equipName);
      if (equipId) {
        setSelectedEquipmentId(equipId);
        setEquipmentModalOpen(true);
      } else {
        setNotice("Este ejercicio no tiene equipo asignado.");
      }
    },
    maneral: () => {
      const grip = getGripForExercise(selected?.exercise.id ?? "");
      if (grip) {
        setSelectedGrip(grip);
        setGripPopoverOpen(true);
      } else {
        setNotice("No se tiene información de agarre para este ejercicio.");
      }
    },
  };
'@
$lines = $lines[0..($startIdx-1)] + ($newBlock -split "`n") + $lines[($endIdx+1)..($lines.Length-1)]
Set-Content src/components/ActiveWorkout.tsx $lines