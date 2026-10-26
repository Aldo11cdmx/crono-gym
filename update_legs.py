import json

# Cargar catálogo principal (respetando UTF-8 con o sin BOM)
with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

# Reglas de mapeo para pierna y glúteo
leg_rules = [
    {
        'equipment_id': 'CG-EQP-0010',
        'equipment_name': 'Prensa de Piernas / Leg Press',
        'keywords': [
            'leg press', '45 degree leg press', 'horizontal leg press', 
            'incline leg press', 'leg press machine'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0010_prensa-piernas-leg-press_vista-',
        'max_views': 3
    },
    {
        'equipment_id': 'CG-EQP-0011',
        'equipment_name': 'Extensión de Piernas / Leg Extension',
        'keywords': [
            'leg extension', 'leg extensions'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0011_extension-piernas-leg-extension_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0012',
        'equipment_name': 'Curl Femoral / Leg Curl',
        'keywords': [
            'leg curl', 'lying leg curl', 'seated leg curl', 'standing leg curl',
            'hamstring curl', 'leg curl machine'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0012_curl-femoral-leg-curl_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0020',
        'equipment_name': 'Máquina Hack Squat',
        'keywords': [
            'hack squat', 'hack machine'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0020_maquina-hack-squat_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0025',
        'equipment_name': 'Máquina Smith / Multipower',
        'keywords': [
            'smith machine', 'smith squat', 'smith lunge'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0025_maquina-smith-multipower_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0040',
        'equipment_name': 'Máquina de Abductores/Adductores',
        'keywords': [
            'abductor', 'adductor', 'hip abduction', 'hip adduction',
            'thigh abductor', 'thigh adductor'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0040_maquina-abductores-aductores_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0035',
        'equipment_name': 'Máquina Glúteos',
        'keywords': [
            'glute kickback', 'glute machine', 'hip thrust machine',
            'butt blaster'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0035_maquina-gluteos_vista-',
        'max_views': 2
    }
]

updated_count = 0

for rule in leg_rules:
    image_urls = [f"{rule['base']}{i:02d}.jpg" for i in range(1, rule['max_views'] + 1)]
    for exercise in data:
        name_en = str(exercise.get('name', '')).lower()
        name_es = str(exercise.get('name_es', '') or '').lower()
        full_text = f"{name_en} {name_es}"

        matches_kw = any(kw in full_text for kw in rule['keywords'])
        matches_ex = any(ex in full_text for ex in rule['exclude'])

        if matches_kw and not matches_ex:
            exercise['equipment_id'] = rule['equipment_id']
            exercise['equipment_name'] = rule['equipment_name']
            exercise['image_urls'] = image_urls
            updated_count += 1

# Guardar el catálogo actualizado en UTF-8 sin BOM
with open('src/data/exercisesCatalog.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Total de ejercicios de Pierna/Glúteo vinculados a equipo: {updated_count}')
