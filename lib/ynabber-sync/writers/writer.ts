import { Connection } from "../repositories/connection-repository";
import { Transaction } from "../ynabber/transaction";
import { Logger } from "winston";

export default interface Writer<In, Out> {
  readonly connection: Connection;
  readonly logger: Logger;

  isValidTransaction(transaction: Transaction): boolean;

  mapTransactionToWriterTransaction(internalTransaction: Transaction): In;

  bulkWrite(data: Transaction[]): Promise<Out>;
}
