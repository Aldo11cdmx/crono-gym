$lines = Get-Content src/components/ActiveWorkout.tsx
$oldBlockLines = $lines[583..595]   # lines 584-596 inclusive (0-index)
$oldBlock = $oldBlockLines -join "`n"
$newBlockLines = @(
  '  const actionHandlers: Partial<Record<ExerciseActionId, () => void>> = {',
  '    avance: advance,',
  '    nota: () => {',
  '      journalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });',
  '      setNotice("Tus notas de la sesión están aquí abajo.");',
  '    },',
  '    cambiar: () => {',
  '      if (!selected) return;',
  '      setBrowsingFor(selected.key);',
  '      setBrowsing(true);',
  '    },',
  '    ajustar: () => setGearOpen(true),',
  '    maquina: () => {',
  '      const equipName = selected?.exercise.equipment ?? "";',
  '      const equipId = getEquipmentIdByName(equipName);',
  '      if (equipId) {',
  '        setSelectedEquipmentId(equipId);',
  '        setEquipmentModalOpen(true);',
  '      } else {',
  '        setNotice("Este ejercicio no tiene equipo asignado.");',
  '      }',
  '    },',
  '    maneral: () => {',
  '      const grip = getGripForExercise(selected?.exercise.id ?? "");',
  '      if (grip) {',
  '        setSelectedGrip(grip);',
  '        setGripPopoverOpen(true);',
  '      } else {',
  '        setNotice("No se tiene información de agarre para este ejercicio.");',
  '      }',
  '    },'
  '  };'
)
$newBlock = $newBlockLines -join "`n"
$content = $lines -join "`n"
$newContent = $content -replace [regex]::Escape($oldBlock), $newBlock
Set-Content src/components/ActiveWorkout.tsx ($newContent -split "`n")