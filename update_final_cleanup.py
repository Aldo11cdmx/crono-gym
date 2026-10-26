import json

with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

cleanup_rules = [
    # 1. Ejercicios con Barra Olímpica, EZ Bar o Trampa
    {
        'equipment_id': 'CG-EQP-0002',
        'equipment_name': 'Máquina Smith y Rack de Sentadillas / Barras',
        'keywords': ['barbell', 'ez bar', 'ez-bar', 'olympic', 'cambered', 'trap bar'],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0002_maquina-smith_vista-',
        'max_views': 2
    },
    # 2. Peso Libre / Mancuernas y Kettlebells restantes
    {
        'equipment_id': 'CG-EQP-0005',
        'equipment_name': 'Rack de Mancuernas y Peso Libre',
        'keywords': ['dumbbell', 'kettlebell', 'weighted', 'medicine ball'],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0005_rack-mancuernas_vista-',
        'max_views': 2
    },
    # 3. Estiramientos, Movilidad, Tapete y Peso Corporal (Calistenia/Core)
    {
        'equipment_id': 'CG-EQP-0040',
        'equipment_name': 'Área de Core, Tapetes y Movilidad',
        'keywords': [
            'stretch', 'mobility', 'body weight', 'bodyweight', 
            'floor', 'kneeling', 'standing', 'assisted', 'pose', 'calisthenics'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0040_rueda-abdominal_vista-',
        'max_views': 1
    },
    # 4. Comodín final para cualquier ejercicio corporal o libre sin mapear
    {
        'equipment_id': 'CG-EQP-0045',
        'equipment_name': 'Estación Libre y Funcional',
        'keywords': [''],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0045_calistenia-bandas_vista-',
        'max_views': 1
    }
]

updated_count = 0

for rule in cleanup_rules:
    image_urls = [f"{rule['base']}{i:02d}.jpg" for i in range(1, rule['max_views'] + 1)]
    for exercise in data:
        if exercise.get('equipment_id'):
            continue

        name_en = str(exercise.get('name', '')).lower()
        name_es = str(exercise.get('name_es', '') or '').lower()
        equipment_type = str(exercise.get('equipment', '') or '').lower()
        full_text = f"{name_en} {name_es} {equipment_type}"

        matches_kw = any(kw in full_text for kw in rule['keywords']) if rule['keywords'] != [''] else True
        matches_ex = any(ex in full_text for ex in rule['exclude']) if rule['exclude'] else False

        if matches_kw and not matches_ex:
            exercise['equipment_id'] = rule['equipment_id']
            exercise['equipment_name'] = rule['equipment_name']
            exercise['image_urls'] = image_urls
            updated_count += 1

with open('src/data/exercisesCatalog.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Ejercicios mapeados en la limpia final: {updated_count}')
