export function toEnvVars(
  obj: Record<string, boolean | string | number | null | undefined>,
): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value ? value.toString() : `${value}`;
      return acc;
    },
    {},
  );
}
