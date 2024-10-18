import { toEnvVars } from "./object-utils"; // Adjust the import path as needed

describe("toEnvVars", () => {
  it("should convert string values correctly", () => {
    const input = { KEY1: "value1", KEY2: "value2" };
    const result = toEnvVars(input);
    expect(result).toEqual({ KEY1: "value1", KEY2: "value2" });
  });

  it("should convert number values to strings", () => {
    const input = { PORT: 3000, VERSION: 1.5 };
    const result = toEnvVars(input);
    expect(result).toEqual({ PORT: "3000", VERSION: "1.5" });
  });

  it("should convert boolean values to strings", () => {
    const input = { DEBUG: true, PRODUCTION: false };
    const result = toEnvVars(input);
    expect(result).toEqual({ DEBUG: "true", PRODUCTION: "false" });
  });

  it("should handle mixed value types", () => {
    const input = { STRING: "value", NUMBER: 42, BOOLEAN: true };
    const result = toEnvVars(input);
    expect(result).toEqual({ STRING: "value", NUMBER: "42", BOOLEAN: "true" });
  });

  it("should return an empty object for an empty input", () => {
    const input = {};
    const result = toEnvVars(input);
    expect(result).toEqual({});
  });

  it("should handle keys with empty string values", () => {
    const input = { EMPTY: "" };
    const result = toEnvVars(input);
    expect(result).toEqual({ EMPTY: "" });
  });

  it("should handle keys with undefined values", () => {
    const input = { UNDEFINED: undefined as any };
    const result = toEnvVars(input);
    expect(result).toEqual({ UNDEFINED: "undefined" });
  });

  it("should handle keys with null values", () => {
    const input = { NULL: null as any };
    const result = toEnvVars(input);
    expect(result).toEqual({ NULL: "null" });
  });
});
