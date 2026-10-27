/**
 * Inventario oficial del gimnasio de CronoGym.
 *
 * Fuente única para el prompt del coach y para la herramienta `getGymEquipment`.
 * Los IDs CG-EQP son internos: se usan en código y pruebas, pero el coach no los
 * muestra al atleta.
 */

export interface EquipmentItem {
  readonly name: string;
  readonly ids: readonly string[];
}

export interface InventorySection {
  readonly title: string;
  readonly items: readonly EquipmentItem[];
}

export const GYM_INVENTORY: readonly InventorySection[] = [
  {
    title: "Máquinas y poleas",
    items: [
      { name: "Extensión de cuádriceps", ids: ["CG-EQP-0001"] },
      { name: "Curl femoral sentado", ids: ["CG-EQP-0002"] },
      { name: "Curl femoral acostado", ids: ["CG-EQP-0003"] },
      { name: "Prensa de 45°", ids: ["CG-EQP-0004"] },
      { name: "Prensa vertical", ids: ["CG-EQP-0011"] },
      { name: "Abductores y aductores", ids: ["CG-EQP-0005"] },
      { name: "Hack squat", ids: ["CG-EQP-0006"] },
      { name: "Máquina de patada de glúteo", ids: ["CG-EQP-0007"] },
      { name: "Peck deck", ids: ["CG-EQP-0009"] },
      { name: "Remo sentado en máquina", ids: ["CG-EQP-0010"] },
      { name: "Remo en polea baja", ids: ["CG-EQP-0012"] },
      { name: "Curl de bíceps predicador en máquina", ids: ["CG-EQP-0013"] },
      { name: "Crunch abdominal en máquina", ids: ["CG-EQP-0014"] },
      { name: "Pantorrilla sentado", ids: ["CG-EQP-0027"] },
      { name: "Dominadas y fondos asistidos (máquina)", ids: ["CG-EQP-0032"] },
      { name: "Press de pecho horizontal en máquina", ids: ["CG-EQP-0033"] },
      { name: "Máquina Smith", ids: ["CG-EQP-0019", "CG-EQP-0025", "CG-EQP-0034"] },
      { name: "Torre de poleas y estaciones", ids: ["CG-EQP-0022"] },
      { name: "Press de hombro sentado en máquina", ids: ["CG-EQP-0024"] },
    ],
  },
  {
    title: "Pesas libres y barras",
    items: [
      { name: "Mancuernas (2 a 50 kg, de 2 en 2)", ids: ["CG-EQP-0036"] },
      { name: "Pesas rusas (kettlebells)", ids: ["CG-EQP-0035"] },
      { name: "Barra olímpica", ids: ["CG-EQP-0055"] },
      { name: "Barra Z", ids: ["CG-EQP-0052"] },
      { name: "Barra Z olímpica", ids: ["CG-EQP-0059"] },
      { name: "Barra hexagonal", ids: ["CG-EQP-0054"] },
      { name: "Barra romana", ids: ["CG-EQP-0053"] },
      { name: "Barra de dominadas", ids: ["CG-EQP-0051"] },
      { name: "Soporte landmine", ids: ["CG-EQP-0074"] },
      { name: "Discos de 2.5, 5, 10, 15 y 20 kg", ids: [] },
    ],
  },
  {
    title: "Bancos y accesorios",
    items: [
      { name: "Banco multiposición", ids: ["CG-EQP-0062"] },
      {
        name: "Bancos planos, inclinados y declinados (libres y con soporte)",
        ids: ["CG-EQP-0016", "CG-EQP-0023", "CG-EQP-0028", "CG-EQP-0029", "CG-EQP-0031"],
      },
      { name: "Banco de hiperextensiones lumbares", ids: ["CG-EQP-0015"] },
      { name: "Máquina de remo T", ids: ["CG-EQP-0021"] },
      {
        name: "Manerales de polea (cuerdas, barra recta, estribos, agarres V, cerrados y metálicos)",
        ids: ["CG-EQP-0037 a CG-EQP-0049"],
      },
      { name: "Cinturones de lastre y tobilleras", ids: ["CG-EQP-0045", "CG-EQP-0048"] },
    ],
  },
  {
    title: "Cardio",
    items: [
      {
        name: "Elípticas, caminadoras, remadora de aire, bicicletas de spinning y escaladora infinita",
        ids: ["CG-EQP-0065 a CG-EQP-0073"],
      },
    ],
  },
];

export const GYM_EQUIPMENT_TAGS = [
  "leverage machine",
  "smith machine",
  "barbell",
  "olympic barbell",
  "ez barbell",
  "cable",
  "assisted",
  "body weight",
  "dumbbell",
  "kettlebell",
  "weighted",
] as const;

export function renderInventoryForPrompt(): string {
  return GYM_INVENTORY.map(
    (section) => `- ${section.title}: ${section.items.map((item) => item.name).join("; ")}.`,
  ).join("\n");
}
