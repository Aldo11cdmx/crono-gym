import { equipmentMap } from "./equipmentMap";
import { equipmentTypes, freeEquipment } from "./availableEquipment";

export type EquipmentCategory =
  | "Polea"
  | "Máquina Selectorizada"
  | "Banco"
  | "Mancuernas"
  | "Barra / Discos"
  | "Peso Corporal"
  | "Accesorio";

interface EquipmentView {
  id: number;
  src: string;
}

export interface EquipmentEntry {
  id: string;
  name: string;
  category: EquipmentCategory;
  views: EquipmentView[];
  exerciseTypes: string[];
}

export interface EquipmentSuggestion {
  primary: EquipmentEntry | null;
  alternatives: EquipmentEntry[];
}

/**
 * Categoría de cada equipo del catálogo maestro.
 * Se infiere del nombre del equipo y de su función en el gimnasio.
 */
const equipmentCategories: Record<string, EquipmentCategory> = {
  "CG-EQP-0001": "Máquina Selectorizada",
  "CG-EQP-0002": "Máquina Selectorizada",
  "CG-EQP-0003": "Máquina Selectorizada",
  "CG-EQP-0004": "Máquina Selectorizada",
  "CG-EQP-0005": "Máquina Selectorizada",
  "CG-EQP-0006": "Máquina Selectorizada",
  "CG-EQP-0007": "Máquina Selectorizada",
  "CG-EQP-0008": "Máquina Selectorizada",
  "CG-EQP-0009": "Máquina Selectorizada",
  "CG-EQP-0010": "Máquina Selectorizada",
  "CG-EQP-0011": "Máquina Selectorizada",
  "CG-EQP-0012": "Polea",
  "CG-EQP-0013": "Máquina Selectorizada",
  "CG-EQP-0014": "Máquina Selectorizada",
  "CG-EQP-0015": "Banco",
  "CG-EQP-0016": "Banco",
  "CG-EQP-0017": "Barra / Discos",
  "CG-EQP-0018": "Polea",
  "CG-EQP-0019": "Máquina Selectorizada",
  "CG-EQP-0020": "Máquina Selectorizada",
  "CG-EQP-0021": "Máquina Selectorizada",
  "CG-EQP-0022": "Polea",
  "CG-EQP-0023": "Banco",
  "CG-EQP-0024": "Máquina Selectorizada",
  "CG-EQP-0025": "Máquina Selectorizada",
  "CG-EQP-0026": "Máquina Selectorizada",
  "CG-EQP-0027": "Máquina Selectorizada",
  "CG-EQP-0028": "Banco",
  "CG-EQP-0029": "Banco",
  "CG-EQP-0030": "Máquina Selectorizada",
  "CG-EQP-0031": "Banco",
  "CG-EQP-0032": "Máquina Selectorizada",
  "CG-EQP-0033": "Máquina Selectorizada",
  "CG-EQP-0034": "Máquina Selectorizada",
  "CG-EQP-0035": "Barra / Discos",
  "CG-EQP-0036": "Mancuernas",
  "CG-EQP-0037": "Barra / Discos",
  "CG-EQP-0038": "Accesorio",
  "CG-EQP-0039": "Barra / Discos",
  "CG-EQP-0040": "Accesorio",
  "CG-EQP-0041": "Barra / Discos",
  "CG-EQP-0042": "Accesorio",
  "CG-EQP-0043": "Barra / Discos",
  "CG-EQP-0044": "Accesorio",
  "CG-EQP-0045": "Accesorio",
  "CG-EQP-0046": "Accesorio",
  "CG-EQP-0047": "Accesorio",
  "CG-EQP-0048": "Accesorio",
  "CG-EQP-0049": "Accesorio",
  "CG-EQP-0050": "Accesorio",
  "CG-EQP-0051": "Peso Corporal",
  "CG-EQP-0052": "Barra / Discos",
  "CG-EQP-0053": "Barra / Discos",
  "CG-EQP-0054": "Barra / Discos",
  "CG-EQP-0055": "Barra / Discos",
  "CG-EQP-0056": "Peso Corporal",
  "CG-EQP-0057": "Barra / Discos",
  "CG-EQP-0059": "Barra / Discos",
  "CG-EQP-0060": "Accesorio",
  "CG-EQP-0061": "Barra / Discos",
  "CG-EQP-0062": "Banco",
  "CG-EQP-0063": "Accesorio",
  "CG-EQP-0064": "Accesorio",
  "CG-EQP-0065": "Máquina Selectorizada",
  "CG-EQP-0066": "Máquina Selectorizada",
  "CG-EQP-0067": "Máquina Selectorizada",
  "CG-EQP-0068": "Máquina Selectorizada",
  "CG-EQP-0069": "Máquina Selectorizada",
  "CG-EQP-0070": "Máquina Selectorizada",
  "CG-EQP-0071": "Máquina Selectorizada",
  "CG-EQP-0072": "Accesorio",
  "CG-EQP-0073": "Máquina Selectorizada",
  "CG-EQP-0074": "Barra / Discos",
};

/**
 * Catálogo unificado de equipamiento: fusiona `equipmentMap` (nombres + vistas de
 * imagen) con `availableEquipment` (slugs de tipo de ejercicio → IDs de equipo).
 *
 * Cada entrada incluye la categoría inferida y los slugs de ejercicio que la
 * usan, para permitir búsquedas rápidas por tipo de ejercicio o por ID de equipo.
 */
export const equipmentCatalog: Record<string, EquipmentEntry> = (() => {
  const catalog: Record<string, EquipmentEntry> = {};

  for (const [id, data] of Object.entries(equipmentMap)) {
    const exerciseTypes = Object.entries(equipmentTypes)
      .filter(([, ids]) => ids.includes(id))
      .map(([slug]) => slug);

    catalog[id] = {
      id,
      name: data.name,
      category: equipmentCategories[id] ?? "Accesorio",
      views: data.views,
      exerciseTypes,
    };
  }

  return catalog;
})();

/**
 * Derives an exercise-type slug from an exercise name for catalog lookup.
 *
 * Normalises "Lat Pulldown" → `lat_pulldown`, "Assisted Parallel Close Grip Pull-up"
 * → `assisted_parallel_close_grip_pull_up`, etc.
 */
export function exerciseNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface EquipmentRule {
  matches: RegExp;
  primary: string;
  alternatives: string[];
}

function buildSuggestion(rule: EquipmentRule): EquipmentSuggestion {
  const primary = equipmentCatalog[rule.primary] ?? null;
  const alternatives: EquipmentEntry[] = [];
  for (const id of rule.alternatives) {
    const entry = equipmentCatalog[id];
    if (!entry) continue;
    if (primary && entry.id === primary.id) continue;
    if (alternatives.some((a) => a.id === entry.id)) continue;
    alternatives.push(entry);
  }
  return { primary, alternatives };
}

/**
 * Reglas que vinculan cada ejercicio del catálogo con una máquina principal y
 * alternativas compatibles del catálogo de equipamiento (CG-EQP-0001 a 0074;
 * CG-EQP-0058 no existe en el catálogo de imágenes y se salta).
 *
 * Se evalúan en orden y gana la primera regla que coincida, de lo más
 * específico a lo más genérico, para que cada uno de los ~1.135 ejercicios
 * disponibles en Cronos Gym reciba un equipo principal y al menos una
 * alternativa. El `/. /` de cierre es el último recurso: nunca deja un
 * ejercicio sin equipo.
 */
export const EQUIPMENT_RULES: EquipmentRule[] = [
  // ---------------- peso corporal / abdomen / piso ----------------
  // Ningún ejercicio con equipment === 'body weight' recibe máquina
  // selectorizada ni de cardio: solo Banco Abdominal (0028) o Plataforma (0060).
  {
    matches: /body.?weight|calistenia|peso corporal|no equipment|sin equipo/,
    primary: "CG-EQP-0028",
    alternatives: ["CG-EQP-0060"],
  },

  // ---------------- cardio ----------------
  { matches: /treadmill|caminadora|correr|running/, primary: "CG-EQP-0067", alternatives: ["CG-EQP-0071", "CG-EQP-0065"] },
  { matches: /bike|bicicleta|spinning|cycle|cycling/, primary: "CG-EQP-0069", alternatives: ["CG-EQP-0065", "CG-EQP-0066", "CG-EQP-0073"] },
  { matches: /rower|remo|rowing/, primary: "CG-EQP-0068", alternatives: ["CG-EQP-0067", "CG-EQP-0065"] },
  { matches: /stairmill|escaladora|stepmill|stairs|stair.?climber|climber/, primary: "CG-EQP-0070", alternatives: ["CG-EQP-0069", "CG-EQP-0067"] },
  { matches: /elliptical|eliptica/, primary: "CG-EQP-0065", alternatives: ["CG-EQP-0066", "CG-EQP-0073"] },
  { matches: /ski.?erg|ergometer|upper.?body.?erg/, primary: "CG-EQP-0068", alternatives: ["CG-EQP-0067", "CG-EQP-0065"] },

  // ---------------- espalda ----------------
  { matches: /assisted.*pull|dominada.*asistida|pull.?up.*assisted|assisted.*chin/, primary: "CG-EQP-0032", alternatives: [] },
  { matches: /pull.?up|dominada|chin.?up/, primary: "CG-EQP-0051", alternatives: ["CG-EQP-0020"] },
  { matches: /pulldown|jalon|lat/, primary: "CG-EQP-0018", alternatives: ["CG-EQP-0022", "CG-EQP-0041"] },
  { matches: /row|remo/, primary: "CG-EQP-0012", alternatives: ["CG-EQP-0010", "CG-EQP-0021"] },
  { matches: /deadlift|peso muerto/, primary: "CG-EQP-0017", alternatives: ["CG-EQP-0055", "CG-EQP-0054"] },
  { matches: /shrug|encogimiento/, primary: "CG-EQP-0017", alternatives: ["CG-EQP-0055", "CG-EQP-0036"] },
  { matches: /pullover/, primary: "CG-EQP-0017", alternatives: ["CG-EQP-0011", "CG-EQP-0015"] },

  // ---------------- pecho ----------------
  { matches: /pec deck|fly|crucero|apertura|aperturas/, primary: "CG-EQP-0013", alternatives: [] },
  { matches: /crossover/, primary: "CG-EQP-0022", alternatives: ["CG-EQP-0040"] },
  { matches: /smith.*press|press.*smith|press de pecho.*smith/, primary: "CG-EQP-0017", alternatives: ["CG-EQP-0034", "CG-EQP-0008"] },
  { matches: /declinado|decline.*press|press.*declinado/, primary: "CG-EQP-0028", alternatives: [] },
  { matches: /bench press|press de banca|chest press|press de pecho/, primary: "CG-EQP-0015", alternatives: ["CG-EQP-0016", "CG-EQP-0052", "CG-EQP-0036"] },
  { matches: /press.*máquina|máquina.*press|press.*maquina|maquina.*press|leverage.*press|press.*leverage/, primary: "CG-EQP-0011", alternatives: [] },
  { matches: /dip|fondos/, primary: "CG-EQP-0020", alternatives: ["CG-EQP-0011", "CG-EQP-0015"] },
  { matches: /push up|flexi[oó]n/, primary: "CG-EQP-0028", alternatives: ["CG-EQP-0015", "CG-EQP-0020"] },

  // ---------------- pierna y glúteo ----------------
  { matches: /leg extension|extensi[oó]n de cu[aá]driceps|cu[aá]driceps|quadriceps|quads/, primary: "CG-EQP-0023", alternatives: [] },
  { matches: /press.*45|prensa.*45|45.*grados/, primary: "CG-EQP-0001", alternatives: ["CG-EQP-0002"] },
  { matches: /press.*90|prensa.*90|90.*grados/, primary: "CG-EQP-0003", alternatives: [] },
  { matches: /hack.*squat|sentadilla.*hack/, primary: "CG-EQP-0004", alternatives: [] },
  { matches: /squat|sentadilla/, primary: "CG-EQP-0005", alternatives: ["CG-EQP-0055", "CG-EQP-0017", "CG-EQP-0019", "CG-EQP-0034"] },
  { matches: /femoral.*sentado|seated.*leg curl/, primary: "CG-EQP-0024", alternatives: ["CG-EQP-0025"] },
  { matches: /femoral.*acostado|lying.*leg curl|curl.*femoral.*acostado/, primary: "CG-EQP-0025", alternatives: ["CG-EQP-0024"] },
  { matches: /pantorrilla|calf|gemelo/, primary: "CG-EQP-0026", alternatives: [] },
  { matches: /abductor|adductor|ductor/, primary: "CG-EQP-0027", alternatives: [] },
  { matches: /glute|gl[úu]teo|kickback|patada/, primary: "CG-EQP-0022", alternatives: ["CG-EQP-0048"] },
  { matches: /lunge|zanca|estocada/, primary: "CG-EQP-0017", alternatives: ["CG-EQP-0036", "CG-EQP-0055", "CG-EQP-0054"] },
  { matches: /step.?up|subida a la banca/, primary: "CG-EQP-0017", alternatives: ["CG-EQP-0031", "CG-EQP-0029", "CG-EQP-0016"] },
  { matches: /hip thrust|empuje de cadera/, primary: "CG-EQP-0001", alternatives: ["CG-EQP-0029", "CG-EQP-0017", "CG-EQP-0036"] },
  { matches: /sissy/, primary: "CG-EQP-0030", alternatives: ["CG-EQP-0005", "CG-EQP-0001", "CG-EQP-0004"] },
  { matches: /pierna|leg|isquiotibial|hamstring/, primary: "CG-EQP-0003", alternatives: ["CG-EQP-0024", "CG-EQP-0025", "CG-EQP-0017"] },

  // ---------------- hombro y brazos ----------------
  { matches: /shoulder press|press de hombro|military press|press militar/, primary: "CG-EQP-0019", alternatives: ["CG-EQP-0017", "CG-EQP-0036"] },
  { matches: /deltoid|deltoides|reverse fly|volantes?/, primary: "CG-EQP-0013", alternatives: [] },
  { matches: /predicador|scott|preacher/, primary: "CG-EQP-0035", alternatives: ["CG-EQP-0053"] },
  { matches: /curl|biceps/, primary: "CG-EQP-0035", alternatives: ["CG-EQP-0053"] },
  { matches: /triceps|extension|pushdown|kickback|patada de tr[íi]ceps/, primary: "CG-EQP-0022", alternatives: ["CG-EQP-0039"] },
  { matches: /skull crusher|aplastamiento de cr[áa]nio/, primary: "CG-EQP-0022", alternatives: ["CG-EQP-0039"] },

  // ---------------- antebrazos ----------------
  { matches: /wrist|muñeca|forearm|antebrazo/, primary: "CG-EQP-0029", alternatives: ["CG-EQP-0016", "CG-EQP-0031"] },

  // ---------------- cuello ----------------
  { matches: /neck|cuello/, primary: "CG-EQP-0047", alternatives: [] },

  // ---------------- default (cualquier ejercicio sin regla previa) ----------------
  { matches: /.*/, primary: "CG-EQP-0022", alternatives: ["CG-EQP-0029", "CG-EQP-0036", "CG-EQP-0019"] },
];

/**
 * Busca equipamiento para un ejercicio con alternativas.
 */
export function getEquipmentSuggestionForExercise(
  exerciseName: string,
  exerciseEquipment?: string | null,
): EquipmentSuggestion {
  const nameLower = exerciseName.toLowerCase();
  const equipLower = (exerciseEquipment ?? "").toLowerCase();
  const allText = `${nameLower} ${equipLower}`;

  for (const rule of EQUIPMENT_RULES) {
    if (rule.matches.test(allText)) {
      return buildSuggestion(rule);
    }
  }

  // Fallback por slug de tipo de ejercicio (catálogo de tipos de ejercicio).
  const slug = exerciseNameToSlug(exerciseName);
  const ids = equipmentTypes[slug];
  if (ids && ids.length > 0) {
    const first = equipmentCatalog[ids[0]];
    if (first) {
      const alternatives: EquipmentEntry[] = [];
      ids.slice(1).forEach((id) => {
        const e = equipmentCatalog[id];
        if (e && !alternatives.some((a) => a.id === e.id) && e.id !== first.id) {
          alternatives.push(e);
        }
      });
      return { primary: first, alternatives };
    }
  }

  // Fallback por el campo de equipo del ejercicio.
  if (exerciseEquipment) {
    const equipSlug = exerciseNameToSlug(exerciseEquipment);
    const equipIds = equipmentTypes[equipSlug];
    if (equipIds && equipIds.length > 0) {
      const first = equipmentCatalog[equipIds[0]];
      if (first) {
        const alternatives: EquipmentEntry[] = [];
        equipIds.slice(1).forEach((id) => {
          const e = equipmentCatalog[id];
          if (e && !alternatives.some((a) => a.id === e.id) && e.id !== first.id) {
            alternatives.push(e);
          }
        });
        return { primary: first, alternatives };
      }
    }
  }

  // Último recurso: torre de poleas, compatible con casi cualquier ejercicio.
  return buildSuggestion(EQUIPMENT_RULES[EQUIPMENT_RULES.length - 1]);
}

/**
 * Equipamiento de peso libre disponible (mancuernas, barras, discos, etc.).
 */
export { freeEquipment };

/**
 * Busca el equipamiento principal asociado a un tipo de ejercicio (slug).
 *
 * Devuelve la entrada completa del catálogo: nombre, categoría, vistas de
 * imagen y los slugs de ejercicio que usan este equipo. Retorna `null` cuando
 * no hay equipo asociado al slug recibido.
 *
 * @param exerciseTypeSlug Slug del tipo de ejercicio (ej. `leg_extension`, `smith_machine`)
 */
export function getEquipmentForExercise(
  exerciseTypeSlug: string,
): EquipmentEntry | null {
  const ids = equipmentTypes[exerciseTypeSlug];
  if (!ids || ids.length === 0) return null;
  return equipmentCatalog[ids[0]] ?? null;
}

/**
 * Busca el equipamiento por su ID CG-EQP-XXXX.
 */
export function getEquipmentById(id: string): EquipmentEntry | undefined {
  return equipmentCatalog[id];
}

/**
 * Lista todos los equipos de una categoría dada.
 */
export function getEquipmentByCategory(
  category: EquipmentCategory,
): EquipmentEntry[] {
  return Object.values(equipmentCatalog).filter((e) => e.category === category);
}
