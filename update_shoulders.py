import json

# Cargar catálogo principal (respetando UTF-8 con o sin BOM)
with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

# Reglas de mapeo para hombros y espalda
shoulder_back_rules = [
    {
        'equipment_id': 'CG-EQP-0022',
        'equipment_name': 'Torre de Poleas / Crossover',
        'keywords': [
            'cable row', 'low row cable', 'cable pullover', 'cable rear lateral',
            'cable lateral raise', 'cable face pull', 'cable upright row'
        ],
        'exclude': ['lat pulldown', 'chest fly', 'cable curl', 'cable triceps'],
        'base': '/images/gym-equipment/CG-EQP-0022_torre-poleas_vista-',
        'max_views': 3
    },
    {
        'equipment_id': 'CG-EQP-0015',
        'equipment_name': 'Jalón / Lat Pulldown',
        'keywords': [
            'lat pulldown', 'wide grip pulldown', 'close grip pulldown',
            'neutral grip pulldown', 'pulldown'
        ],
        'exclude': ['low row', 'seated row'],
        'base': '/images/gym-equipment/CG-EQP-0015_jalon-lat-pulldown_vista-',
        'max_views': 3
    },
    {
        'equipment_id': 'CG-EQP-0016',
        'equipment_name': 'Remo en Máquina / Low Row',
        'keywords': [
            'low row', 'seated row', 'cable seated row', 'machine row',
            'low pulley row'
        ],
        'exclude': ['t-bar', 'barbell row'],
        'base': '/images/gym-equipment/CG-EQP-0016_remo-maquina-low-row_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0027',
        'equipment_name': 'Máquina Peck Deck / Pectoral Fly',
        'keywords': [
            'peck deck', 'pec fly machine', 'rear delt machine',
            'reverse pec fly', 'rear lateral raise machine'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0027_maquina-peck-deck-pectoral-fly_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0028',
        'equipment_name': 'Press de Hombro en Máquina / Shoulder Press',
        'keywords': [
            'shoulder press machine', 'machine shoulder press',
            'deltoid press machine', 'leverage shoulder press'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0028_press-hombro-maquina-shoulder-press_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0038',
        'equipment_name': 'Máquina Elevaciones Laterales / Lateral Raise',
        'keywords': [
            'lateral raise machine', 'machine lateral raise',
            'deltoid raise machine'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0038_maquina-elevaciones-laterales_vista-',
        'max_views': 2
    }
]

updated_count = 0

for rule in shoulder_back_rules:
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

print(f'Total de ejercicios de Hombro/Espalda vinculados a equipo: {updated_count}')
