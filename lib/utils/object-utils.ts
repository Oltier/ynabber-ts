export function toEnvVars(
  obj: Record<string, boolean | string | number>,
): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    },
    {},
  );
}
