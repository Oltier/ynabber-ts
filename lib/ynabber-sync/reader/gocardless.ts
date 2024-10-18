import {
  Account as GoCardlessAccount,
  BankTransaction,
  GocardlessApiClient,
  TransactionSchema,
} from "../generated/gocardless/gocardless-api-client.generated";
import {
  Account,
  Money,
  Transaction,
  TransactionState,
} from "../ynabber/transaction";
import { Mapper } from "./mapper";
import { format, min, parse, sub } from "date-fns";
import {
  Connection,
  ConnectionConfig,
} from "../repositories/connection-repository";
import { randomUUID } from "node:crypto";
import { Logger } from "winston";
import { AuthTokenSecurity } from "../clients/gocardless-client";

export function milliUnitsFromAmount(amount: number): number {
  return amount * 1000;
}

export function parseAmount(transaction: TransactionSchema): Money {
  const amount = Number.parseFloat(transaction.transactionAmount.amount);

  if (Number.isNaN(amount)) {
    throw new Error(
      `Failed to parse amount from transaction ${transaction.transactionId}`,
    );
  }

  return {
    milliUnits: milliUnitsFromAmount(amount),
    currency: transaction.transactionAmount.currency,
  };
}

export function parseDate(transaction: TransactionSchema): Date {
  const valueDate = transaction.valueDate
    ? parse(transaction.valueDate, "yyyy-MM-dd", new Date())
    : null;
  const bookingDate = transaction.bookingDate
    ? parse(transaction.bookingDate, "yyyy-MM-dd", new Date())
    : null;

  const dateExtractorRegex = /\d{4}\.\d{2}\.\d{2}/;

  const remittanceDateString = transaction.remittanceInformationUnstructured
    ? transaction.remittanceInformationUnstructured.match(
        dateExtractorRegex,
      )?.[0]
    : null;

  const remittanceDate = remittanceDateString
    ? parse(remittanceDateString, "yyyy.MM.dd", new Date())
    : null;

  const dates = [valueDate, bookingDate, remittanceDate];
  if (dates.every((date) => date === null)) {
    throw new Error(
      `Failed to parse date from transaction ${transaction.transactionId}`,
    );
  }

  return min(dates.filter((date) => date !== null));
}

// sanitizePayee removes all non-alphanumeric characters from payee
export function sanitizePayee(payee: string): string {
  if (payee.includes("xxxxxx")) {
    return extractPayee(payee).trim();
  }

  const reg = /[^\p{L}]+/gu;
  const sanitized = payee.replace(reg, " ");
  return sanitized.trim();
}

// 516050xxxxxx5888 Purchase/Vásárlás 2024.01.12 11:51:39 Terminal:S0158104 BUDAPEST   SPAR MAGYARORSZAG KFT. Eredeti össz/Orig amt: 2085.00HUF
// Extract SPAR MAGYARORSZAG KFT. from the string above
export function extractPayee(payee: string): string {
  const splits = payee.split("   ");
  if (splits.length > 1) {
    payee = splits[1];
    const furtherSplits = payee.split(" Eredeti");
    payee = furtherSplits[0];
  }
  return payee;
}

export function parsePayee(
  transaction: TransactionSchema,
  money: Money,
  connectionConfig: ConnectionConfig,
): string {
  let payee = "";

  for (const source of connectionConfig.payeeSource) {
    if (payee !== "") break;

    switch (source) {
      case "unstructured":
        payee = sanitizePayee(
          transaction.remittanceInformationUnstructured || "",
        );
        break;

      case "name":
        if (money.milliUnits > 0) {
          payee = transaction.debtorName || transaction.creditorName || "";
        } else {
          payee = transaction.creditorName || transaction.debtorName || "";
        }
        break;

      case "additional":
        payee = transaction.additionalInformation || "";
        break;

      default:
        throw new Error(`Unrecognized PayeeSource: ${source}`);
    }
  }

  return payee;
}

export function mapAccount(account: GoCardlessAccount): Account {
  return {
    id: account.id!,
    name: account.iban!,
    iban: account.iban!,
  };
}

export default class GoCardlessMapper
  implements Mapper<TransactionSchema, GocardlessApiClient<AuthTokenSecurity>>
{
  connection: Connection;
  client: GocardlessApiClient<AuthTokenSecurity>;
  logger: Logger;

  constructor(
    connection: Connection,
    client: GocardlessApiClient<AuthTokenSecurity>,
    logger: Logger,
  ) {
    this.connection = connection;
    this.client = client;
    this.logger = logger;
  }

  mapSourceTransactionToInternal(
    account: Account,
    sourceTransaction: TransactionSchema,
    state: TransactionState,
  ): Transaction {
    const amount = parseAmount(sourceTransaction);
    const date = parseDate(sourceTransaction);
    const payee = parsePayee(sourceTransaction, amount, this.connection.config);
    const transactionId =
      sourceTransaction.transactionId ||
      sourceTransaction.internalTransactionId ||
      randomUUID().toString();

    const memo: string =
      sourceTransaction.remittanceInformationUnstructured ||
      sourceTransaction.remittanceInformationUnstructured ||
      sourceTransaction.additionalInformation ||
      "";

    return {
      account,
      id: transactionId,
      date,
      payee,
      memo,
      amount,
      state,
    };
  }

  async fetchTransactions(): Promise<Transaction[]> {
    const accounts = await Promise.all([
      ...(this.connection.requisition.accounts || []).map(async (accountId) => {
        const accountResponse =
          await this.client.api.retrieveAccountMetadata(accountId);
        return accountResponse.data;
      }),
    ]);
    this.logger.info("accounts: ", accounts);
    accounts
      .filter(
        (account) =>
          account.status === "EXPIRED" || account.status === "SUSPENDED",
      )
      .forEach((account) => {
        this.logger.warn(
          `Account ${account.id} is ${account.status}. Skipping.`,
        );
      });

    const activeAccounts = accounts.filter(
      (account) =>
        account.status !== "EXPIRED" && account.status !== "SUSPENDED",
    );

    return (
      await Promise.all([
        ...activeAccounts.map(async (account) => {
          const res = await this.client.api.retrieveAccountTransactions(
            account.id!,
            {
              date_from: format(sub(Date.now(), { weeks: 2 }), "yyyy-MM-dd"),
              date_to: format(Date.now(), "yyyy-MM-dd"),
            },
          );
          this.logger.info("transaction response data: ", res.data);
          return {
            account,
            transactions: res.data.transactions,
          };
        }),
      ])
    )
      .map(
        ({
          account,
          transactions,
        }: {
          account: GoCardlessAccount;
          transactions: BankTransaction;
        }) => {
          const internalAccount = mapAccount(account);
          return [
            ...transactions.booked.map((sourceTransaction) => {
              return this.mapSourceTransactionToInternal(
                internalAccount,
                sourceTransaction,
                "booked",
              );
            }),
            ...(transactions.pending || []).map((sourceTransaction) => {
              return this.mapSourceTransactionToInternal(
                internalAccount,
                sourceTransaction,
                "pending",
              );
            }),
          ];
        },
      )
      .flat();
  }
}
