import predefinedWorkoutPlans from '@/data/symmetry/predefined_workout_plans_v2.json'
import esData from '@/data/symmetry/es.json'
import substitutionTables from '@/data/symmetry/substitution_tables.json'

export function sanitizeBrandName(text: string): string {
  if (!text) return text
  return text
    .replace(/Symmetry Intelligence/g, 'Cronos Intelligence')
    .replace(/Symmetry/g, 'Cronos')
}

export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeBrandName(obj) as T
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T
  }
  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value)
    }
    return result as T
  }
  return obj
}

export interface Exercise {
  id: string | number
  name: string
  bodyPart?: string
  target?: string
  equipment?: string
  gifUrl?: string
  instructions?: string[]
  [key: string]: any
}

export interface WorkoutPlan {
  planId: string
  name: string
  description?: string
  equipmentCategory?: string
  level?: string
  gender?: string
  trainingSessions?: any[]
  [key: string]: any
}

export type SubstitutionMap = Record<string, string[]>

export const getPredefinedWorkoutPlans = (): WorkoutPlan[] => {
  const sanitized = sanitizeObject(predefinedWorkoutPlans)
  if (Array.isArray(sanitized)) {
    return sanitized as WorkoutPlan[]
  }
  if (sanitized && Array.isArray((sanitized as any).plans)) {
    return (sanitized as any).plans as WorkoutPlan[]
  }
  return []
}

export const getESData = () => sanitizeObject(esData)
export const getSubstitutionTables = () => sanitizeObject(substitutionTables)

export function fuzzySearchExercises(exercises: Exercise[], query: string): Exercise[] {
  if (!query.trim()) return exercises
  const q = query.toLowerCase().trim()
  return exercises.filter((ex) => {
    const name = (ex.name || '').toLowerCase()
    const target = (ex.target || '').toLowerCase()
    const bodyPart = (ex.bodyPart || '').toLowerCase()
    return name.includes(q) || target.includes(q) || bodyPart.includes(q)
  })
}

export function filterByMuscle(exercises: Exercise[], muscle: string): Exercise[] {
  if (!muscle || muscle.toLowerCase() === 'todos') return exercises
  const m = muscle.toLowerCase()
  return exercises.filter((ex) => {
    const bodyPart = (ex.bodyPart || '').toLowerCase()
    const target = (ex.target || '').toLowerCase()
    return bodyPart.includes(m) || target.includes(m)
  })
}

export function filterByEquipment(exercises: Exercise[], equipment: string): Exercise[] {
  if (!equipment || equipment.toLowerCase() === 'todos') return exercises
  const eq = equipment.toLowerCase()
  return exercises.filter((ex) => {
    const eqEx = (ex.equipment || '').toLowerCase()
    if (eq === 'cuerpo libre' || eq === 'bodyweight' || eq === 'body weight') {
      return eqEx.includes('body') || eqEx.includes('none') || eqEx === '' || eqEx.includes('cuerpo')
    }
    if (eq === 'mancuernas') {
      return eqEx.includes('dumbbell') || eqEx.includes('mancuer')
    }
    if (eq === 'barra') {
      return eqEx.includes('barbell') || eqEx.includes('barra')
    }
    if (eq === 'polea') {
      return eqEx.includes('cable') || eqEx.includes('machine') || eqEx.includes('polea')
    }
    return eqEx.includes(eq)
  })
}

export function getSubstitutions(exerciseId: string | number): string[] {
  const tables = getSubstitutionTables() as any
  if (!tables) return []
  if (tables[exerciseId]) return tables[exerciseId]
  if (tables.substitutions && tables.substitutions[exerciseId]) {
    return tables.substitutions[exerciseId]
  }
  return []
}

export function getAllSubstitutions(): SubstitutionMap {
  const tables = getSubstitutionTables() as any
  if (!tables) return {}
  if (tables.substitutions) return tables.substitutions
  const keys = Object.keys(tables)
  if (keys.length > 0 && Array.isArray(tables[keys[0]])) {
    return tables as SubstitutionMap
  }
  return {}
}
