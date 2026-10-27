// supabase/functions/coach-assistant/contextSanitizer.ts

export interface AthleteContext {
  availablePlates?: number[];
  goal?: string;
  daysPerWeek?: number;
  [key: string]: any;
}

export function sanitizeContext(rawContext: any): AthleteContext {
  if (!rawContext || typeof rawContext !== 'object') {
    return {};
  }

  const sanitized: AthleteContext = {};

  if (Array.isArray(rawContext.availablePlates)) {
    sanitized.availablePlates = rawContext.availablePlates.filter(
      (plate: any) => typeof plate === 'number' && !isNaN(plate)
    );
  }

  if (typeof rawContext.goal === 'string') {
    sanitized.goal = rawContext.goal.trim();
  }

  if (typeof rawContext.daysPerWeek === 'number' && rawContext.daysPerWeek > 0) {
    sanitized.daysPerWeek = rawContext.daysPerWeek;
  }

  return sanitized;
}

export function sanitizeAssistantContext(context: unknown): unknown {
  return sanitizeContext(context);
}

export function renderContextBlock(context: unknown): string {
  return JSON.stringify(context, null, 2);
}
