module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test", "<rootDir>/lib/ynabber-sync"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
