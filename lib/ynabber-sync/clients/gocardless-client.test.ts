import {
  GocardlessApiClient,
  HttpClient,
} from "../generated/gocardless/gocardless-api-client.generated";
import {
  AuthTokenSecurity,
  createGocardlessApiClient,
} from "./gocardless-client";

jest.mock("../generated/gocardless/gocardless-api-client.generated");

describe("createGocardlessApiClient", () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockGocardlessApiClient: jest.Mocked<
    GocardlessApiClient<AuthTokenSecurity>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpClient = {
      request: jest.fn(),
    } as any;
    (HttpClient as jest.MockedClass<typeof HttpClient>).mockImplementation(
      () => mockHttpClient,
    );

    mockGocardlessApiClient = {} as any;
    (GocardlessApiClient as jest.MockedClass<typeof GocardlessApiClient>)
      // @ts-ignore
      .mockImplementation(() => mockGocardlessApiClient);
  });

  it("should create a GocardlessApiClient with the correct security configuration", () => {
    const security: AuthTokenSecurity = { authToken: "testToken" };
    const client = createGocardlessApiClient(security);

    expect(HttpClient).toHaveBeenCalledWith(
      expect.objectContaining({
        securityWorker: expect.any(Function),
      }),
    );
    expect(GocardlessApiClient).toHaveBeenCalledWith(mockHttpClient);
    expect(client).toBe(mockGocardlessApiClient);
  });

  it("should set up a security worker that adds the correct Authorization header", () => {
    const security: AuthTokenSecurity = { authToken: "testToken" };
    createGocardlessApiClient(security);

    const securityWorkerFn = (HttpClient as jest.MockedClass<typeof HttpClient>)
      .mock.calls[0][0]!.securityWorker!;
    const result = securityWorkerFn(security);

    expect(result).toEqual({
      headers: {
        Authorization: "Bearer testToken",
      },
    });
  });

  it("should use the token in securityData if provided", () => {
    const security: AuthTokenSecurity = { authToken: "initialToken" };
    createGocardlessApiClient(security);

    const securityWorkerFn = (HttpClient as jest.MockedClass<typeof HttpClient>)
      .mock.calls[0][0]!.securityWorker!;
    const result = securityWorkerFn({ authToken: "newToken" });

    expect(result).toEqual({
      headers: {
        Authorization: "Bearer newToken",
      },
    });
  });

  it("should fall back to the initial token if securityData doesn't contain a token", () => {
    const security: AuthTokenSecurity = { authToken: "initialToken" };
    createGocardlessApiClient(security);

    const securityWorkerFn = (HttpClient as jest.MockedClass<typeof HttpClient>)
      .mock.calls[0][0]!.securityWorker!;
    const result = securityWorkerFn({} as AuthTokenSecurity);

    expect(result).toEqual({
      headers: {
        Authorization: "Bearer initialToken",
      },
    });
  });

  it("should handle null securityData correctly", () => {
    const security: AuthTokenSecurity = { authToken: "initialToken" };
    createGocardlessApiClient(security);

    const securityWorkerFn = (HttpClient as jest.MockedClass<typeof HttpClient>)
      .mock.calls[0][0]!.securityWorker!;
    const result = securityWorkerFn(null);

    expect(result).toEqual({
      headers: {
        Authorization: "Bearer initialToken",
      },
    });
  });
});
