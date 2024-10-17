export type Account = {
  id: string;
  name: string;
  iban: string;
};

export type Money = {
  // TODO handle other currencies?
  milliUnits: number;
  currency: string;
};

export type TransactionState = "booked" | "pending";

export type Transaction = {
  account: Account;
  id: string;
  date: Date;
  payee: string;
  memo: string;
  amount: Money;
  state: TransactionState;
};
