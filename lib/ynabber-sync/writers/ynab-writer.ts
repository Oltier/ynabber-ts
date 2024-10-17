import Writer from "./writer";
import { API, NewTransaction } from "ynab";
import type { SaveTransactionsResponse } from "ynab/dist/models";
import { Connection } from "../repositories/connection-repository";
import { Transaction } from "../ynabber/transaction";
import { format, isAfter } from "date-fns";
import { Logger } from "winston";
import { createHash } from "node:crypto";

export const MEMO_MAX_LENGTH = 500;
export const PAYEE_NAME_MAX_LENGTH = 200;
export const PENDING_PREFIX = "PENDING ";

export function getImportId(transaction: Transaction): string {
  const date = format(transaction.date, "yyyy-MM-dd");
  const amountStr = transaction.amount.milliUnits.toString();

  const s: string[] = [
    transaction.account.iban,
    transaction.id,
    date,
    amountStr,
    transaction.state,
  ];
  const hash = createHash("sha256").update(s.join("")).digest("hex");
  return `YBBRTZ:${hash}`.substring(0, 32);
}

export default class YnabWriter
  implements Writer<NewTransaction, SaveTransactionsResponse>
{
  readonly connection: Connection;
  readonly logger: Logger;
  private readonly ynabApiClient: API;

  constructor(
    connection: Connection,
    logger: Logger,
    personalAccessToken: string,
  ) {
    this.connection = connection;
    this.logger = logger;

    this.ynabApiClient = new API(
      connection.auth?.ynab.accessToken || personalAccessToken,
    );

    this.isValidTransaction = this.isValidTransaction.bind(this);
    this.mapTransactionToWriterTransaction =
      this.mapTransactionToWriterTransaction.bind(this);
  }

  isValidTransaction(transaction: Transaction): boolean {
    // YNAB does not allow future transactions on bulk import
    if (isAfter(transaction.date, Date.now())) {
      this.logger.warn("Skipping future transaction", transaction);
      return false;
    }

    // YNAB does not allow transactions for accounts that are not in the budget
    if (!this.connection.target.accountMap[transaction.account.iban]) {
      this.logger.warn("Skipping transaction with unknown account", {
        transaction,
        accountMap: this.connection.target.accountMap,
      });
      return false;
    }

    return true;
  }

  mapTransactionToWriterTransaction(transaction: Transaction): NewTransaction {
    const memo = `${transaction.state === "pending" ? PENDING_PREFIX : ""}${transaction.memo
      .replace(/\s\s+/g, " ")
      .trim()
      .substring(0, MEMO_MAX_LENGTH)}`;
    return {
      account_id: this.connection.target.accountMap[transaction.account.iban],
      date: format(transaction.date, "yyyy-MM-dd"),
      memo,
      payee_name: transaction.payee
        .replace(/\s\s+/g, " ")
        .trim()
        .substring(0, PAYEE_NAME_MAX_LENGTH),
      // TODO better handling for this?
      cleared: transaction.state === "booked" ? "cleared" : "uncleared",
      approved: false,
      amount: transaction.amount.milliUnits,
      import_id: getImportId(transaction),
    };
  }

  bulkWrite(data: Transaction[]): Promise<SaveTransactionsResponse> {
    return this.ynabApiClient.transactions.createTransactions(
      this.connection.target.budgetId,
      {
        transactions: data
          .filter(this.isValidTransaction)
          .map(this.mapTransactionToWriterTransaction),
      },
    );
  }
}
