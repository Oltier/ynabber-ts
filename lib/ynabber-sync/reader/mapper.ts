import { Account, Transaction, TransactionState } from "../ynabber/transaction";
import { Connection } from "../repositories/connection-repository";

export interface Mapper<TSource, TApi> {
  connection: Connection;
  client: TApi;

  mapSourceTransactionToInternal(
    account: Account,
    sourceTransaction: TSource,
    state: TransactionState,
  ): Transaction;

  fetchTransactions(): Promise<Transaction[]>;
}
