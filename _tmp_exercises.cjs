const d = require('./src/data/exercisesCatalog.json');
const a = Array.isArray(d) ? d : (d.exercises || []);
const want = [
  'overhead press', 'shoulder press', 'calf raise', 'leg extension', 'lat pulldown',
  'seated row', 'triceps pushdown', 'face pull', 'hip thrust', 'crunch', 'plank',
  'lunge', 'deadlift', 'rowing', 'dip', 'chest press', 'glute bridge',
  'squat', 'curl', 'press', 'pull', 'raise', 'extension',
];
const out = [];
for (const name of want) {
  const hit = a.find(e => (e.name || '').toLowerCase() === name);
  if (hit) out.push(name + ' => ' + hit.id + ' | ' + hit.body_part + ' | ' + hit.equipment);
}
require('fs').writeFileSync('C:/Users/yayog/crono-gym/.kilo/_tmp_exercises.txt', out.join('\n'));
console.log(out.length);