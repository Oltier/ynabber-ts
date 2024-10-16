import { TransactionSchema } from "../generated/gocardless/Api";
import {
  Account,
  TransactionState,
  Transaction,
  Money,
} from "../ynabber/transaction";
import { Mapper } from "./mapper";
import { min, parse } from "date-fns";
import { ConnectionConfig } from "../repositories/connection-repository";
import { randomUUID } from "node:crypto";

function parseAmount(transaction: TransactionSchema): Money {
  const amount = Number.parseFloat(transaction.transactionAmount.amount);

  if (Number.isNaN(amount)) {
    throw new Error(
      `Failed to parse amount from transaction ${transaction.transactionId}`,
    );
  }

  return {
    value: amount,
    currency: transaction.transactionAmount.currency,
  };
}

function parseDate(transaction: TransactionSchema): Date {
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
function sanitizePayee(payee: string): string {
  if (payee.includes("xxxxxx")) {
    return extractPayee(payee).trim();
  }

  const reg = /[^\p{L}]+/gu;
  const sanitized = payee.replace(reg, " ");
  return sanitized.trim();
}

// 516050xxxxxx5888 Purchase/Vásárlás 2024.01.12 11:51:39 Terminal:S0158104 BUDAPEST   SPAR MAGYARORSZAG KFT. Eredeti össz/Orig amt: 2085.00HUF
// Extract SPAR MAGYARORSZAG KFT. from the string above
function extractPayee(payee: string): string {
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
  connectionConfig.payeeSource.forEach((source) => {
    switch (source) {
      case "name":
        if (money.value > 0) {
          if (transaction.debtorName && transaction.debtorName !== "") {
            return transaction.debtorName;
          } else {
            return transaction.creditorName || "";
          }
        } else {
          if (transaction.creditorName && transaction.creditorName !== "") {
            return transaction.creditorName;
          } else {
            return transaction.debtorName || "";
          }
        }
      case "unstructured":
        return sanitizePayee(
          transaction.remittanceInformationUnstructured || "",
        );
      case "additional":
        return transaction.additionalInformation || "";
      default:
        throw new Error(`Unknown payee source: ${source}`);
    }
  });

  return "";
}

export default class GoCardlessMapper implements Mapper<TransactionSchema> {
  mapSourceToTransaction(
    account: Account,
    connectionConfig: ConnectionConfig,
    sourceTransaction: TransactionSchema,
    state: TransactionState,
  ): Transaction {
    const amount = parseAmount(sourceTransaction);
    const date = parseDate(sourceTransaction);
    const payee = parsePayee(sourceTransaction, amount, connectionConfig);
    const transactionId =
      sourceTransaction.transactionId ||
      sourceTransaction.internalTransactionId ||
      randomUUID().toString();

    const pendingPrefix = state === "pending" ? "PENDING " : "";
    const memo = `${pendingPrefix}${sourceTransaction.remittanceInformationUnstructured || sourceTransaction.remittanceInformationUnstructured}`;

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
}
