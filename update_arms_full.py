import json

# Cargar catálogo principal (respetando UTF-8 con o sin BOM)
with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

# Reglas de mapeo optimizadas para el lote de 761 ejercicios de brazos
arm_rules = [
    {
        'equipment_id': 'CG-EQP-0022',
        'equipment_name': 'Torre de Poleas / Crossover',
        'keywords': [
            'cable curl', 'cable bicep', 'cable triceps', 'cable pushdown', 
            'cable rope', 'cable overhead', 'cable hammer curl', 'cable wrist curl', 
            'cable kickback', 'cable extension', 'cable drag curl', 'cable high pulley'
        ],
        'exclude': ['lat pulldown', 'seated row', 'chest press', 'fly'],
        'base': '/images/gym-equipment/CG-EQP-0022_torre-poleas_vista-',
        'max_views': 3
    },
    {
        'equipment_id': 'CG-EQP-0013',
        'equipment_name': 'Banco Predicador Scott',
        'keywords': [
            'preacher curl', 'scott curl', 'preacher'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0013_banco-predicador-scott_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0032',
        'equipment_name': 'Máquina Dominadas y Fondos Asistidos',
        'keywords': [
            'assisted triceps dip', 'assisted chest dip', 'assisted dip', 
            'lever triceps dip', 'assisted pull-up', 'assisted chin-up', 'lever assisted'
        ],
        'exclude': [],
        'base': '/images/gym-equipment/CG-EQP-0032_maquina-dominadas-y-fondos-asistidos_vista-',
        'max_views': 2
    },
    {
        'equipment_id': 'CG-EQP-0052',
        'equipment_name': 'Estación de Fondos / Paralelas',
        'keywords': [
            'triceps dip', 'bench dip', 'dip on parallel bars', 'chest dip', 
            'parallel bars', 'elbow dips', 'impossible dips', 'korean dips', 'dips'
        ],
        'exclude': ['assisted', 'ring', 'leverage', 'machine'],
        'base': '/images/gym-equipment/CG-EQP-0052_estacion-fondos-paralelas_vista-',
        'max_views': 1
    }
]

updated_count = 0

for rule in arm_rules:
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

print(f'Total de ejercicios de Brazos vinculados a equipo: {updated_count}')
