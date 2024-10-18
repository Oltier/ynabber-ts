import { Logger } from "winston";
import {
  Account as GoCardlessAccount,
  BankTransaction,
  BankTransactions,
  GocardlessApiClient,
  HttpResponse,
  TransactionSchema,
} from "../generated/gocardless/gocardless-api-client.generated";
import {
  Connection,
  ConnectionConfig,
} from "../repositories/connection-repository";
import GoCardlessMapper, {
  milliUnitsFromAmount,
  parseAmount,
  parseDate,
  parsePayee,
  sanitizePayee,
} from "./gocardless";
import { ErrorResponse } from "ynab";
import { Account } from "../ynabber/transaction";
import { parse } from "date-fns";

// Mock the imported modules
jest.mock("node:crypto");
jest.mock("winston");
jest.mock("../generated/gocardless/gocardless-api-client.generated");

type MockGocardlessApiClient = {
  api: {
    retrieveAccountMetadata: jest.MockedFunction<
      (id: string) => Promise<HttpResponse<GoCardlessAccount, ErrorResponse>>
    >;
    retrieveAccountTransactions: jest.MockedFunction<
      (
        id: string,
        query?: { date_from?: string; date_to?: string },
      ) => Promise<HttpResponse<BankTransactions, ErrorResponse>>
    >;
  };
};

describe("GoCardlessMapper and Utility Functions", () => {
  describe("Utility Functions", () => {
    describe("milliUnitsFromAmount", () => {
      it("should convert amount to milli units", () => {
        const amount = 10.5;
        expect(milliUnitsFromAmount(amount)).toBe(10500);
      });
    });

    describe("parseAmount", () => {
      it("should parse amount from transaction", () => {
        const transaction = {
          transactionAmount: { amount: "10.5", currency: "USD" },
        } as TransactionSchema;
        const result = parseAmount(transaction);
        expect(result).toEqual({ milliUnits: 10500, currency: "USD" });
      });

      it("should throw error for invalid amount", () => {
        const transaction = {
          transactionAmount: { amount: "invalid", currency: "USD" },
          transactionId: "123",
        } as TransactionSchema;
        expect(() => parseAmount(transaction)).toThrow(
          "Failed to parse amount from transaction 123",
        );
      });
    });

    describe("parseDate", () => {
      it("should return the earliest valid date", () => {
        const transaction = {
          valueDate: "2023-01-01",
          bookingDate: "2023-01-02",
          remittanceInformationUnstructured: "Payment on 2023.01.03",
        } as TransactionSchema;
        const result = parseDate(transaction);
        expect(result).toEqual(parse("2023-01-01", "yyyy-MM-dd", Date.now()));
      });

      it("should throw error if no valid date found", () => {
        const transaction = {
          transactionId: "123",
        } as TransactionSchema;
        expect(() => parseDate(transaction)).toThrow(
          "Failed to parse date from transaction 123",
        );
      });
    });

    describe("sanitizePayee", () => {
      it("should sanitize payee string", () => {
        expect(sanitizePayee("Test  Payee 123")).toBe("Test Payee");
      });

      it("should extract payee from complex string", () => {
        expect(
          sanitizePayee(
            "516050xxxxxx5888 Purchase/Vásárlás 2024.01.12 11:51:39 Terminal:S0158104 BUDAPEST   SPAR MAGYARORSZAG KFT. Eredeti össz/Orig amt: 2085.00HUF",
          ),
        ).toBe("SPAR MAGYARORSZAG KFT.");
      });
    });

    describe("parsePayee", () => {
      it("should parse payee based on connection config", () => {
        const transaction = {
          remittanceInformationUnstructured: "Payment from John Doe",
          debtorName: "John Doe",
          creditorName: "Jane Smith",
        } as TransactionSchema;
        const money = { milliUnits: 10000, currency: "USD" };
        const connectionConfig = {
          payeeSource: new Set(["unstructured", "name"]),
        } as ConnectionConfig;

        expect(parsePayee(transaction, money, connectionConfig)).toBe(
          "Payment from John Doe",
        );
      });
    });
  });

  describe("GoCardlessMapper", () => {
    let mapper: GoCardlessMapper;
    let mockConnection: Connection;
    let mockClient: MockGocardlessApiClient;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
      mockConnection = {
        requisition: { accounts: ["acc1", "acc2", "acc3"] },
        config: { payeeSource: new Set(["unstructured"]) },
      } as unknown as Connection;
      mockClient = {
        api: {
          retrieveAccountMetadata: jest.fn(),
          retrieveAccountTransactions: jest.fn(),
        },
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
      } as unknown as jest.Mocked<Logger>;

      mapper = new GoCardlessMapper(
        mockConnection,
        mockClient as unknown as GocardlessApiClient<any>,
        mockLogger,
      );
    });

    describe("constructor", () => {
      it("should initialize with correct properties", () => {
        expect(mapper.connection).toBe(mockConnection);
        expect(mapper.client).toBe(mockClient);
        expect(mapper.logger).toBe(mockLogger);
      });
    });

    describe("mapSourceTransactionToInternal", () => {
      it("should map source transaction to internal transaction", () => {
        const account: Account = {
          id: "acc1",
          name: "Test Account",
          iban: "DE123",
        };
        const sourceTransaction: TransactionSchema = {
          transactionId: "tx1",
          transactionAmount: { amount: "100.50", currency: "EUR" },
          valueDate: "2023-01-01",
          remittanceInformationUnstructured: "Test payment",
        };
        const state = "booked";

        const result = mapper.mapSourceTransactionToInternal(
          account,
          sourceTransaction,
          state,
        );

        expect(result).toMatchObject({
          account,
          id: "tx1",
          date: expect.any(Date),
          payee: "Test payment",
          memo: "Test payment",
          amount: { milliUnits: 100500, currency: "EUR" },
          state: "booked",
        });
      });
    });

    describe("fetchTransactions", () => {
      it("should fetch and map transactions", async () => {
        const mockAccount = { id: "acc1", status: "READY", iban: "DE123" };
        const mockTransactions: BankTransaction = {
          booked: [
            {
              transactionId: "tx1",
              transactionAmount: { amount: "100.00", currency: "HUF" },
              valueDate: "2023-01-01",
            },
            {
              transactionId: "tx2",
              transactionAmount: { amount: "200.00", currency: "HUF" },
              valueDate: "2023-01-01",
            },
          ],
          pending: [
            {
              transactionId: "tx3",
              transactionAmount: { amount: "300.00", currency: "HUF" },
              valueDate: "2023-01-01",
            },
          ],
        };

        mockClient.api.retrieveAccountMetadata.mockResolvedValue({
          data: mockAccount,
        } as HttpResponse<GoCardlessAccount, ErrorResponse>);
        mockClient.api.retrieveAccountTransactions.mockResolvedValue({
          data: { transactions: mockTransactions },
        } as HttpResponse<BankTransactions, ErrorResponse>);

        const result = await mapper.fetchTransactions();

        expect(result).toHaveLength(9);
        expect(mockClient.api.retrieveAccountTransactions).toHaveBeenCalledWith(
          "acc1",
          expect.any(Object),
        );
        expect(
          mockClient.api.retrieveAccountTransactions,
        ).toHaveBeenCalledTimes(3);
      });

      it("should skip expired or suspended accounts", async () => {
        const mockAccounts = [
          { id: "acc1", status: "READY", iban: "DE123" },
          { id: "acc2", status: "EXPIRED", iban: "DE456" },
          { id: "acc3", status: "SUSPENDED", iban: "DE789" },
        ];

        const mockTransactions: BankTransaction = {
          booked: [
            {
              transactionId: "tx1",
              transactionAmount: { amount: "100.00", currency: "HUF" },
              valueDate: "2023-01-01",
            },
            {
              transactionId: "tx2",
              transactionAmount: { amount: "200.00", currency: "HUF" },
              valueDate: "2023-01-01",
            },
          ],
          pending: [
            {
              transactionId: "tx3",
              transactionAmount: { amount: "300.00", currency: "HUF" },
              valueDate: "2023-01-01",
            },
          ],
        };

        mockClient.api.retrieveAccountMetadata.mockImplementation(
          (accountId: string) =>
            Promise.resolve({
              data: mockAccounts.find((acc) => acc.id === accountId),
            } as HttpResponse<GoCardlessAccount, ErrorResponse>),
        );

        mockClient.api.retrieveAccountTransactions.mockResolvedValue({
          data: { transactions: mockTransactions },
        } as HttpResponse<BankTransactions, ErrorResponse>);

        await mapper.fetchTransactions();

        expect(
          mockClient.api.retrieveAccountTransactions,
        ).toHaveBeenCalledTimes(1);
        expect(mockClient.api.retrieveAccountTransactions).toHaveBeenCalledWith(
          "acc1",
          expect.any(Object),
        );
      });
    });
  });
});
