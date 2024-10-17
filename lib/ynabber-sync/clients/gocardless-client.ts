import {
  GocardlessApiClient,
  HttpClient,
} from "../generated/gocardless/gocardless-api-client.generated";

export type AuthTokenSecurity = {
  authToken: string;
};

export const createGocardlessApiClient = (
  security: AuthTokenSecurity,
): GocardlessApiClient<AuthTokenSecurity> => {
  const httpClient = new HttpClient({
    securityWorker: (securityData: AuthTokenSecurity | null) => {
      return {
        headers: {
          Authorization: `Bearer ${securityData?.authToken || security.authToken}`,
        },
      };
    },
  });
  return new GocardlessApiClient(httpClient);
};
