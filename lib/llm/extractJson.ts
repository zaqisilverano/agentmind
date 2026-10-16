export function extractJson(text: string): unknown {
  const s = text.replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON object in model output');
  return JSON.parse(s.slice(a, b + 1));
}
