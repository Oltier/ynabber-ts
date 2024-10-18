import { getSsmParameter } from "./SsmLayer"; // Adjust the import path as needed
import { request } from "undici";

jest.mock("undici", () => ({
  request: jest.fn(),
}));

describe("getSsmParameter", () => {
  const mockSessionToken = "mock-session-token";
  const mockParameterPath = "/test/parameter";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should make a request with correct URL and headers", async () => {
    (request as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          Parameter: { Value: JSON.stringify({ key: "value" }) },
        }),
      },
    });

    await getSsmParameter(mockParameterPath, mockSessionToken);

    expect(request).toHaveBeenCalledWith(
      "http://localhost:2773/systemsmanager/parameters/get?name=%2Ftest%2Fparameter",
      {
        method: "GET",
        headers: {
          "X-Aws-Parameters-Secrets-Token": mockSessionToken,
        },
      },
    );
  });

  it("should use custom port when provided", async () => {
    (request as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          Parameter: { Value: JSON.stringify({ key: "value" }) },
        }),
      },
    });

    await getSsmParameter(mockParameterPath, mockSessionToken, false, "3000");

    expect(request).toHaveBeenCalledWith(
      "http://localhost:3000/systemsmanager/parameters/get?name=%2Ftest%2Fparameter",
      expect.any(Object),
    );
  });

  it("should add withDecryption parameter when decrypt is true", async () => {
    (request as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          Parameter: { Value: JSON.stringify({ key: "value" }) },
        }),
      },
    });

    await getSsmParameter(mockParameterPath, mockSessionToken, true);

    expect(request).toHaveBeenCalledWith(
      "http://localhost:2773/systemsmanager/parameters/get?name=%2Ftest%2Fparameter&withDecryption=true",
      expect.any(Object),
    );
  });

  it("should parse JSON response correctly", async () => {
    const mockResponse = { key: "value" };
    (request as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          Parameter: { Value: JSON.stringify(mockResponse) },
        }),
      },
    });

    const result = await getSsmParameter(mockParameterPath, mockSessionToken);

    expect(result).toEqual(mockResponse);
  });

  it("should return string value when response is not JSON", async () => {
    const mockResponse = "string-value";
    (request as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          Parameter: { Value: mockResponse },
        }),
      },
    });

    const result = await getSsmParameter(mockParameterPath, mockSessionToken);

    expect(result).toBe(mockResponse);
  });

  it("should throw an error for non-200 status code", async () => {
    (request as jest.Mock).mockResolvedValue({
      statusCode: 400,
      headers: {},
      trailers: {},
      body: {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        text: jest.fn().mockResolvedValue("Error message"),
      },
    });

    await expect(
      getSsmParameter(mockParameterPath, mockSessionToken),
    ).rejects.toThrow("Error getting parameter from SSM");
  });

  it("should throw an error for unexpected response format", async () => {
    (request as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({ unexpectedFormat: true }),
      },
    });

    await expect(
      getSsmParameter(mockParameterPath, mockSessionToken),
    ).rejects.toThrow("Unexpected response from SSM");
  });
});
