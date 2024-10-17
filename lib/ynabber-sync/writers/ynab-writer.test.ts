import { API } from "ynab";
import YnabWriter, {
  getImportId,
  MEMO_MAX_LENGTH,
  PAYEE_NAME_MAX_LENGTH,
  PENDING_PREFIX,
} from "./ynab-writer";
import { Connection } from "../repositories/connection-repository";
import { Transaction } from "../ynabber/transaction";
import { Logger } from "winston";
import { SaveTransactionsResponse } from "ynab/dist/models";
import { parseISO } from "date-fns";

// Mock dependencies
jest.mock("ynab");
jest.mock("winston");

describe("YnabWriter", () => {
  let writer: YnabWriter;
  let mockConnection: Connection;
  let mockLogger: jest.Mocked<Logger>;
  let mockYnabApi: jest.Mocked<API>;
  let mockCreateTransactions: jest.Mock;

  beforeEach(() => {
    mockConnection = {
      id: "mock-connection-id",
      userId: "mock-user-id",
      auth: {
        ynab: {
          accessToken: "mock-token",
          token_type: "bearer",
          refresh_token: "mock-refresh-token",
          expires_at: Date.parse("2024-01-01"),
        },
      },
      target: {
        budgetId: "mock-budget-id",
        accountMap: { "mock-iban": "mock-account-id" },
      },
      config: {
        payeeSource: new Set(["name"]),
        payeeStrip: new Set([]),
      },
      requisition: {} as any,
    };
    mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockCreateTransactions = jest.fn();
    mockYnabApi = {
      transactions: {
        createTransactions: mockCreateTransactions,
      },
    } as unknown as jest.Mocked<API>;

    (API as jest.MockedClass<typeof API>).mockImplementation(() => mockYnabApi);

    writer = new YnabWriter(mockConnection, mockLogger, "mock-personal-token");
  });

  describe("isValidTransaction", () => {
    it("should return false for future transactions", () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const futureTransaction: Transaction = {
        account: { id: "1", name: "Test Account", iban: "mock-iban" },
        id: "tx1",
        date: futureDate,
        payee: "Test Payee",
        memo: "Test Memo",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      expect(writer.isValidTransaction(futureTransaction)).toBe(false);
    });

    it("should return false for transactions with unknown accounts", () => {
      const transaction: Transaction = {
        account: { id: "1", name: "Unknown Account", iban: "unknown-iban" },
        id: "tx1",
        date: new Date(),
        payee: "Test Payee",
        memo: "Test Memo",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      expect(writer.isValidTransaction(transaction)).toBe(false);
    });

    it("should return true for valid transactions", () => {
      const transaction: Transaction = {
        account: { id: "1", name: "Test Account", iban: "mock-iban" },
        id: "tx1",
        date: new Date(),
        payee: "Test Payee",
        memo: "Test Memo",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      expect(writer.isValidTransaction(transaction)).toBe(true);
    });
  });

  describe("mapTransactionToWriterTransaction", () => {
    it("should map a transaction correctly", () => {
      const transaction: Transaction = {
        account: { id: "1", name: "Test Account", iban: "mock-iban" },
        id: "tx1",
        date: new Date("2023-01-01"),
        payee: "Test Payee",
        memo: "Test Memo",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      const result = writer.mapTransactionToWriterTransaction(transaction);

      expect(result).toEqual({
        account_id: "mock-account-id",
        date: "2023-01-01",
        memo: "Test Memo",
        payee_name: "Test Payee",
        cleared: "cleared",
        approved: false,
        amount: 1000,
        import_id: expect.any(String),
      });
    });

    it("should handle pending transactions", () => {
      const transaction: Transaction = {
        account: { id: "1", name: "Test Account", iban: "mock-iban" },
        id: "tx1",
        date: new Date("2023-01-01"),
        payee: "Test Payee",
        memo: "Test Memo",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "pending",
      };

      const result = writer.mapTransactionToWriterTransaction(transaction);

      expect(result.memo).toBe(`${PENDING_PREFIX}Test Memo`);
      expect(result.cleared).toBe("uncleared");
    });

    it("should truncate memo and payee name if too long", () => {
      const longMemo = "a".repeat(MEMO_MAX_LENGTH + 10);
      const longPayee = "b".repeat(PAYEE_NAME_MAX_LENGTH + 10);
      const transaction: Transaction = {
        account: { id: "1", name: "Test Account", iban: "mock-iban" },
        id: "tx1",
        date: new Date("2023-01-01"),
        payee: longPayee,
        memo: longMemo,
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      const result = writer.mapTransactionToWriterTransaction(transaction);

      expect(result.memo?.length).toBeLessThanOrEqual(MEMO_MAX_LENGTH);
      expect(result.payee_name?.length).toBeLessThanOrEqual(
        PAYEE_NAME_MAX_LENGTH,
      );
    });
  });

  describe("bulkWrite", () => {
    it("should filter valid transactions and call YNAB API", async () => {
      mockCreateTransactions.mockResolvedValue({} as SaveTransactionsResponse);

      const transactions: Transaction[] = [
        {
          account: { id: "1", name: "Valid Account", iban: "mock-iban" },
          id: "tx1",
          date: new Date(),
          payee: "Valid Payee",
          memo: "Valid Memo",
          amount: { milliUnits: 1000, currency: "EUR" },
          state: "booked",
        },
        {
          account: { id: "2", name: "Invalid Account", iban: "invalid-iban" },
          id: "tx2",
          date: new Date(),
          payee: "Invalid Payee",
          memo: "Invalid Memo",
          amount: { milliUnits: 2000, currency: "EUR" },
          state: "booked",
        },
      ];

      await writer.bulkWrite(transactions);

      expect(mockCreateTransactions).toHaveBeenCalledWith("mock-budget-id", {
        transactions: [expect.objectContaining({ amount: 1000 })],
      });
      expect(mockCreateTransactions).toHaveBeenCalledTimes(1);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("API Error");
      mockCreateTransactions.mockRejectedValue(mockError);

      const transactions: Transaction[] = [
        {
          account: { id: "1", name: "Valid Account", iban: "mock-iban" },
          id: "tx1",
          date: new Date(),
          payee: "Valid Payee",
          memo: "Valid Memo",
          amount: { milliUnits: 1000, currency: "EUR" },
          state: "booked",
        },
      ];

      await expect(writer.bulkWrite(transactions)).rejects.toThrow("API Error");
    });
  });

  describe("getImportId", () => {
    it("should generate a valid import ID", () => {
      const mockTransaction: Transaction = {
        account: { id: "1", name: "Test Account", iban: "mock-iban" },
        id: "mock-id",
        date: new Date("2023-01-01"),
        payee: "Test Payee",
        memo: "Test Memo",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      const importId = getImportId(mockTransaction);

      expect(importId).toMatch(/^YBBRTZ:[a-f0-9]{25}$/);
      expect(importId.length).toBe(32);
    });

    it("should generate different IDs for different transactions", () => {
      const transaction1: Transaction = {
        account: { id: "1", name: "Account 1", iban: "iban1" },
        id: "id1",
        date: new Date("2023-01-01"),
        payee: "Payee 1",
        memo: "Memo 1",
        amount: { milliUnits: 1000, currency: "EUR" },
        state: "booked",
      };

      const transaction2: Transaction = {
        account: { id: "2", name: "Account 2", iban: "iban2" },
        id: "id2",
        date: new Date("2023-01-02"),
        payee: "Payee 2",
        memo: "Memo 2",
        amount: { milliUnits: 2000, currency: "EUR" },
        state: "pending",
      };

      const importId1 = getImportId(transaction1);
      const importId2 = getImportId(transaction2);

      expect(importId1).not.toBe(importId2);
    });

    it("should conserve import id for a real transaction", () => {
      const transaction: Transaction = {
        account: {
          iban: "HU03116000060000000198359928",
          id: "eb29cf9b-4d89-4680-8fa9-b319603f0452",
          name: "HU03116000060000000198359928",
        },
        amount: {
          currency: "HUF",
          milliUnits: -1368000,
        },
        date: parseISO("2024-10-12T00:00:00.000Z"),
        id: "4881314565",
        memo: "ROSSMANN 254. 1 368 HUF",
        payee: "ROSSMANN 254.",
        state: "booked",
      };

      const importId = getImportId(transaction);

      expect(importId).toBe("YBBRTZ:45604995ce9f923f40210e33e");
    });
  });
});
