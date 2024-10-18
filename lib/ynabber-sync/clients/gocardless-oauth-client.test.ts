import { GocardlessApiClient } from "../generated/gocardless/gocardless-api-client.generated";
import GocardlessOauthClient from "./gocardless-oauth-client";
import { add, sub } from "date-fns";

jest.mock("../generated/gocardless/gocardless-api-client.generated");

describe("GocardlessOauthClient", () => {
  let client: GocardlessOauthClient;
  let mockGocardlessApiClient: jest.Mocked<GocardlessApiClient<any>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGocardlessApiClient = {
      api: {
        obtainNewAccessRefreshTokenPair: jest.fn(),
      },
    } as any;
    (
      GocardlessApiClient as jest.MockedClass<typeof GocardlessApiClient>
    ).mockImplementation(() => mockGocardlessApiClient);

    client = new GocardlessOauthClient({
      secretId: "testId",
      secretKey: "testKey",
    });
  });

  describe("getAuthToken", () => {
    it("should return existing token if not expired", async () => {
      const mockToken = "mockAccessToken";
      (client as any).authTokens = {
        access: mockToken,
        refresh: "mockRefreshToken",
        accessExpiresAt: add(Date.now(), { hours: 1 }),
      };

      const result = await client.getAuthToken();
      expect(result).toBe(mockToken);
      expect(
        mockGocardlessApiClient.api.obtainNewAccessRefreshTokenPair,
      ).not.toHaveBeenCalled();
    });

    it("should refresh token if expired", async () => {
      const mockNewToken = "newMockAccessToken";
      // @ts-ignore
      mockGocardlessApiClient.api.obtainNewAccessRefreshTokenPair.mockResolvedValue(
        {
          data: {
            access: mockNewToken,
            refresh: "newMockRefreshToken",
            access_expires: 3600,
          },
        } as any,
      );

      (client as any).authTokens = {
        access: "oldMockAccessToken",
        refresh: "oldMockRefreshToken",
        accessExpiresAt: sub(Date.now(), { hours: 1 }),
      };

      const result = await client.getAuthToken();
      expect(result).toBe(mockNewToken);
      expect(
        mockGocardlessApiClient.api.obtainNewAccessRefreshTokenPair,
      ).toHaveBeenCalledTimes(1);
    });

    it("should obtain new token if no token exists", async () => {
      const mockNewToken = "newMockAccessToken";
      // @ts-ignore
      mockGocardlessApiClient.api.obtainNewAccessRefreshTokenPair.mockResolvedValue(
        {
          data: {
            access: mockNewToken,
            refresh: "newMockRefreshToken",
            access_expires: 3600,
          },
        } as any,
      );

      const result = await client.getAuthToken();
      expect(result).toBe(mockNewToken);
      expect(
        mockGocardlessApiClient.api.obtainNewAccessRefreshTokenPair,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("isAccessExpired", () => {
    it("should return true if no token exists", () => {
      expect(client.isAccessExpired()).toBe(true);
    });

    it("should return false if token is not expired", () => {
      (client as any).authTokens = {
        access: "mockAccessToken",
        refresh: "mockRefreshToken",
        accessExpiresAt: add(Date.now(), { hours: 1 }),
      };
      expect(client.isAccessExpired()).toBe(false);
    });

    it("should return true if token is expired", () => {
      (client as any).authTokens = {
        access: "mockAccessToken",
        refresh: "mockRefreshToken",
        accessExpiresAt: sub(Date.now(), { hours: 1 }),
      };
      expect(client.isAccessExpired()).toBe(true);
    });
  });

  describe("refreshAuthToken", () => {
    it("should obtain new tokens and update internal state", async () => {
      const mockNewToken = "newMockAccessToken";
      // @ts-ignore
      mockGocardlessApiClient.api.obtainNewAccessRefreshTokenPair.mockResolvedValue(
        {
          data: {
            access: mockNewToken,
            refresh: "newMockRefreshToken",
            access_expires: 3600,
          },
        } as any,
      );

      const result = await client.refreshAuthToken();
      expect(result.access).toBe(mockNewToken);
      expect(result.refresh).toBe("newMockRefreshToken");
      expect(result.accessExpiresAt).toBeInstanceOf(Date);
      expect((client as any).authTokens).toEqual(result);
    });
  });
});
