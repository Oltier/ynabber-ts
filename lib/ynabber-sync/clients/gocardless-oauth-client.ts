import {
  GocardlessApiClient,
  HttpClient,
} from "../generated/gocardless/gocardless-api-client.generated";
import { add, isAfter } from "date-fns";

export type ClientSecretSecurity = {
  secretId: string;
  secretKey: string;
};

type AuthTokens = {
  access: string;
  refresh: string;
  accessExpiresAt: Date;
};

export default class GocardlessOauthClient {
  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly gocardlessApiClient: GocardlessApiClient<ClientSecretSecurity>;
  private authTokens: AuthTokens | null = null;

  constructor(params: ClientSecretSecurity) {
    this.secretId = params.secretId;
    this.secretKey = params.secretKey;
    const httpClient = new HttpClient<ClientSecretSecurity>();
    this.gocardlessApiClient = new GocardlessApiClient(httpClient);
  }

  async getAuthToken(): Promise<string> {
    if (this.authTokens && !this.isAccessExpired()) {
      return this.authTokens.access;
    }

    return (await this.refreshAuthToken()).access;
  }

  private isAccessExpired(): boolean {
    if (!this.authTokens) {
      return true;
    }
    return isAfter(Date.now(), this.authTokens.accessExpiresAt);
  }

  async refreshAuthToken(): Promise<AuthTokens> {
    const res =
      await this.gocardlessApiClient.api.obtainNewAccessRefreshTokenPair({
        secret_id: this.secretId,
        secret_key: this.secretKey,
      });
    const authTokens = {
      access: res.data.access!,
      refresh: res.data.refresh!,
      accessExpiresAt: add(Date.now(), { seconds: res.data.access_expires }),
    };
    this.authTokens = authTokens;
    return authTokens;
  }
}
