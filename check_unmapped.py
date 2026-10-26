import json
from collections import Counter

# Cargar catálogo principal
with open('src/data/exercisesCatalog.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

unmapped = []
for ex in data:
    if not ex.get('equipment_id'):
        unmapped.append(ex)

print(f'Total ejercicios sin equipment_id: {len(unmapped)}\n')

# Desglose por equipment original
print('=== Por equipment original ===')
eq_counter = Counter()
for ex in unmapped:
    eq = ex.get('equipment') or 'sin_equipment'
    eq_counter[eq] += 1

for eq, count in eq_counter.most_common():
    print(f'  {eq}: {count}')

print('\n=== Por grupo muscular (target) ===')
target_counter = Counter()
for ex in unmapped:
    target = ex.get('target') or ex.get('primary_muscle') or ex.get('muscle_group') or 'sin_target'
    target_counter[target] += 1

for target, count in target_counter.most_common():
    print(f'  {target}: {count}')
