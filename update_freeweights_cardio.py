import json

with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

freeweight_rules = [
    # Bancos de Pecho / Multiposición
    {
        'equipment_id': 'CG-EQP-0001',
        'equipment_name': 'Banco Plano / Multiposición',
        'keywords': ['bench press', 'incline bench', 'decline bench', 'dumbbell bench', 'incline press', 'incline fly', 'flat bench'],
        'exclude': ['smith', 'cable', 'leverage', 'machine'],
        'base': '/images/gym-equipment/CG-EQP-0001_banco-plano_vista-',
        'max_views': 2
    },
    # Rack de Mancuernas / Área de Peso Libre
    {
        'equipment_id': 'CG-EQP-0005',
        'equipment_name': 'Rack de Mancuernas y Peso Libre',
        'keywords': ['dumbbell', 'kettlebell'],
        'exclude': ['bench', 'smith', 'cable', 'leverage', 'machine', 'exercise ball'],
        'base': '/images/gym-equipment/CG-EQP-0005_rack-mancuernas_vista-',
        'max_views': 2
    },
    # Rueda Abdominal / Área de Core
    {
        'equipment_id': 'CG-EQP-0040',
        'equipment_name': 'Rueda Abdominal y Tapete de Core',
        'keywords': ['roller', 'ab wheel', 'crunch', 'plank', 'sit-up', 'v-sit', 'mountain climber', 'deadbug', 'russian twist'],
        'exclude': ['cable', 'machine'],
        'base': '/images/gym-equipment/CG-EQP-0040_rueda-abdominal_vista-',
        'max_views': 1
    },
    # Cardio / Caminadora y Ergómetros
    {
        'equipment_id': 'CG-EQP-0060',
        'equipment_name': 'Área de Cardio y Ergómetros',
        'keywords': ['treadmill', 'stationery bike', 'elliptical', 'ski ergometer', 'stairmaster', 'rowing machine', 'hands bike', 'burpee', 'jumping jack'],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0060_cardio_vista-',
        'max_views': 1
    }
]

updated_count = 0

for rule in freeweight_rules:
    image_urls = [f"{rule['base']}{i:02d}.jpg" for i in range(1, rule['max_views'] + 1)]
    for exercise in data:
        # Mapear solo los que no tienen equipment_id todavía
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

print(f'Total de ejercicios mapeados en este lote: {updated_count}')
