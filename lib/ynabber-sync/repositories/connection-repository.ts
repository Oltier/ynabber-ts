import { MongoClient } from "mongodb";
import Repository from "./repository";
import { Requisition } from "../generated/gocardless/Api";

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

export type YnabConnection = {
  budgetId: string;
  accountMap: Record<string, string>;
};

export type Connection = {
  id: string;
  userId: string;
  auth?: {
    ynab: YnabAuth;
  };
  config: ConnectionConfig;
  requisition: Requisition;
  target: YnabConnection;
};

export const DB_NAME = "ynabber";
export const COLLECTION_NAME = "connections";

export default class ConnectionRepository extends Repository<Connection> {
  constructor(client: MongoClient) {
    super(DB_NAME, COLLECTION_NAME, client);
  }
}
