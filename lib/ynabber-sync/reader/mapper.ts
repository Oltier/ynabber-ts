import { Account, Transaction, TransactionState } from "../ynabber/transaction";
import { TransactionSchema } from "../generated/gocardless/Api";
import { ConnectionConfig } from "../repositories/connection-repository";

export interface Mapper<TSource> {
  mapSourceToTransaction(
    account: Account,
    connectionConfig: ConnectionConfig,
    sourceTransaction: TSource,
    state: TransactionState,
  ): Transaction;
}
