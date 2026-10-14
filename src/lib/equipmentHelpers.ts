import { equipmentMap } from '@/data/equipmentMap';

export function getEquipmentIdByName(name: string): string | undefined {
  for (const [id, data] of Object.entries(equipmentMap)) {
    if (data.name === name) {
      return id;
    }
  }
  return undefined;
}
