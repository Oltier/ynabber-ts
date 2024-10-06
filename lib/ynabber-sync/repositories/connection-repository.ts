import { MongoClient } from "mongodb";
import Repository from "./repository";

export type PayeeSource = "name" | "unstructured" | "additional";

export type ConnectionConfig = {
  payeeSource: Set<PayeeSource>;
  payeeStrip: Set<string>;
};

export type YnabAuth = {
  accessToken: string;
  token_type: "bearer";
  expires_at: number;
  refresh_token: string;
};

export type GoCardlessConnection = {
  id: string;
};

export type YnabConnection = {
  budgetId: string;
};

export type Connection = {
  id: string;
  userId: string;
  auth?: {
    ynab: YnabAuth;
  };
  config: ConnectionConfig;
  source: GoCardlessConnection;
  target: YnabConnection;
};

export const DB_NAME = "ynabber";
export const COLLECTION_NAME = "connections";

export default class ConnectionRepository extends Repository<Connection> {
  constructor(client: MongoClient) {
    super(DB_NAME, COLLECTION_NAME, client);
  }
}
