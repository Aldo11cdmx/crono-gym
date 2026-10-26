import json

with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

remaining_rules = [
    # 1. Smith Machine y Racks de Barra
    {
        'equipment_id': 'CG-EQP-0002',
        'equipment_name': 'Máquina Smith y Rack de Sentadillas',
        'keywords': ['smith', 'barbell', 'squat rack', 'power rack', 'landmine'],
        'exclude': ['dumbbell', 'cable'],
        'base': '/images/gym-equipment/CG-EQP-0002_maquina-smith_vista-',
        'max_views': 2
    },
    # 2. Máquinas de Placas / Palanca (Pecho, Espalda, Hombro)
    {
        'equipment_id': 'CG-EQP-0010',
        'equipment_name': 'Máquinas de Placas y Palanca Guiadas',
        'keywords': [
            'machine', 'lever', 'pec deck', 'butterfly', 'chest press', 
            'shoulder press', 'lat pulldown', 'seated row', 'rear delt fly'
        ],
        'exclude': ['cable', 'assisted', 'smith'],
        'base': '/images/gym-equipment/CG-EQP-0010_maquinas-guiadas_vista-',
        'max_views': 2
    },
    # 3. Banco de Hiperextensión / Silla Romana
    {
        'equipment_id': 'CG-EQP-0030',
        'equipment_name': 'Banco de Hiperextensión / Silla Romana',
        'keywords': ['hyperextension', 'back extension', 'roman chair', 'reverse hyper'],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0030_banco-hiperextension_vista-',
        'max_views': 1
    },
    # 4. Calistenia, Barras de Dominadas y Ligas
    {
        'equipment_id': 'CG-EQP-0045',
        'equipment_name': 'Estación de Calistenia y Bandas de Resistencia',
        'keywords': [
            'push-up', 'pull-up', 'chin-up', 'band', 'resistance band', 
            'inverted row', 'muscle-up', 'bodyweight', 'suspension'
        ],
        'exclude': ['assisted', 'machine'],
        'base': '/images/gym-equipment/CG-EQP-0045_calistenia-bandas_vista-',
        'max_views': 1
    }
]

updated_count = 0

for rule in remaining_rules:
    image_urls = [f"{rule['base']}{i:02d}.jpg" for i in range(1, rule['max_views'] + 1)]
    for exercise in data:
        if exercise.get('equipment_id'):
            continue

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

with open('src/data/exercisesCatalog.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Ejercicios mapeados en este lote: {updated_count}')
