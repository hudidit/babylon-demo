/** Strict, engine-free validation for the one local duty slot. */
export type SaveReader = (value: unknown) => any;
export const saveNumber = (min = 0, max = 1000000, integer = false): SaveReader => value => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) throw new Error("Invalid saved number");
  return value;
};
export const saveHour: SaveReader = value => {const n = saveNumber(0, 24)(value); if (n === 24) throw new Error("Invalid saved hour"); return n;};
export const saveBoolean: SaveReader = value => {if (typeof value !== "boolean") throw new Error("Invalid saved boolean"); return value;};
export const saveText = (max = 512): SaveReader => value => {if (typeof value !== "string" || value.length > max) throw new Error("Invalid saved text"); return value;};
export const saveEnum = (...values: (string | number)[]): SaveReader => value => {if (!values.includes(value as string)) throw new Error("Invalid saved enum"); return value;};
export const saveOptional = (read: SaveReader): SaveReader => value => value === undefined ? undefined : read(value);
export const saveArray = (read: SaveReader, max = 4096): SaveReader => value => {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid saved list"); return Object.freeze(value.map(read));
};
export const saveObject = (schema: Record<string, SaveReader>): SaveReader => value => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !Object.prototype.hasOwnProperty.call(schema, key))) throw new Error("Invalid saved fields");
  const result: Record<string, any> = {};
  for (const key of Object.keys(schema)) result[key] = schema[key]((value as Record<string, unknown>)[key]);
  return Object.freeze(result);
};
/** Export only named state, never engine objects or in-flight transactions. */
export function saveFields(source: object, names: readonly string[]) {
  const result: Record<string, unknown> = {};
  names.forEach(name => result[name] = (source as Record<string, unknown>)[name]); return result;
}
export function savedEventOrder(events: readonly {id: number}[]) {
  if (events.some((event, index) => index > 0 && event.id <= events[index - 1].id)) throw new Error("Invalid saved event order");
  return (events[events.length - 1]?.id || 0) + 1;
}
export const saveDay = saveNumber(1, 1000000, true), saveRevision = saveNumber(0, 1000000, true);
