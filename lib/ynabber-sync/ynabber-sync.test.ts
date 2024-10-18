import { Context } from "aws-lambda";
import { MongoClient } from "mongodb";
import GocardlessOauthClient from "./clients/gocardless-oauth-client";
import ConnectionRepository from "./repositories/connection-repository";
import { Config, EventDetail, handler } from "./ynabber-sync.function"; // Replace with actual file name
import * as SsmLayer from "../ssm/SsmLayer";
import YnabWriter from "./writers/ynab-writer";
import GoCardlessMapper from "./reader/gocardless";

// Mock dependencies
jest.mock("mongodb");
jest.mock("./generated/gocardless/gocardless-api-client.generated");
jest.mock("./clients/gocardless-oauth-client");
jest.mock("./repositories/connection-repository");
jest.mock("../ssm/SsmLayer");
jest.mock("./writers/ynab-writer");
jest.mock("./reader/gocardless");

describe("Lambda Function Tests", () => {
  let mockEvent: EventDetail;
  let mockContext: Context;
  let mockConfig: Config;

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();

    // Set up mock event and context
    mockEvent = { connectionId: "test-connection-id" };
    mockContext = { awsRequestId: "test-request-id" } as Context;

    // Set up mock config
    mockConfig = {
      goCardLessSecretId: "mock-secret-id",
      goCardLessSecretKey: "mock-secret-key",
      ynabToken: "mock-ynab-token",
      mongoConnectionString: "mock-mongo-connection-string",
    };

    // Mock SSM parameter retrieval
    (SsmLayer.getSsmParameter as jest.Mock).mockResolvedValue(mockConfig);

    // Mock MongoClient connection
    (MongoClient.connect as jest.Mock).mockResolvedValue({});

    // Mock ConnectionRepository
    (ConnectionRepository.prototype.findOne as jest.Mock).mockResolvedValue({
      id: "test-connection-id",
      // Add other necessary connection properties
    });

    // Mock GocardlessOauthClient
    (
      GocardlessOauthClient.prototype.getAuthToken as jest.Mock
    ).mockResolvedValue("mock-auth-token");

    // Mock GoCardlessMapper
    (
      GoCardlessMapper.prototype.fetchTransactions as jest.Mock
    ).mockResolvedValue([
      // Add mock transactions here
    ]);

    // Mock YnabWriter
    (YnabWriter.prototype.bulkWrite as jest.Mock).mockResolvedValue({
      // Add mock YNAB response here
    });
  });

  it("should process transactions successfully", async () => {
    await handler(mockEvent, mockContext);

    // Add assertions here
    expect(SsmLayer.getSsmParameter).toHaveBeenCalledWith(
      "ynabber-sync",
      process.env.AWS_SESSION_TOKEN,
      true,
      process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT,
    );
    expect(MongoClient.connect).toHaveBeenCalledWith(
      mockConfig.mongoConnectionString,
      expect.any(Object),
    );
    expect(ConnectionRepository.prototype.findOne).toHaveBeenCalledWith({
      id: mockEvent.connectionId,
    });
    expect(GoCardlessMapper.prototype.fetchTransactions).toHaveBeenCalled();
    expect(YnabWriter.prototype.bulkWrite).toHaveBeenCalled();
  });

  it("should handle connection not found", async () => {
    (ConnectionRepository.prototype.findOne as jest.Mock).mockResolvedValue(
      null,
    );

    await handler(mockEvent, mockContext);

    // Add assertions here
    expect(ConnectionRepository.prototype.findOne).toHaveBeenCalledWith({
      id: mockEvent.connectionId,
    });
    expect(GoCardlessMapper.prototype.fetchTransactions).not.toHaveBeenCalled();
    expect(YnabWriter.prototype.bulkWrite).not.toHaveBeenCalled();
  });

  it("should handle error fetching transactions", async () => {
    const err = "Fetch error";
    (
      GoCardlessMapper.prototype.fetchTransactions as jest.Mock
    ).mockRejectedValue(new Error(err));
    (
      GocardlessOauthClient.prototype.isAccessExpired as jest.Mock
    ).mockReturnValue(true);
    (
      GocardlessOauthClient.prototype.refreshAuthToken as jest.Mock
    ).mockResolvedValue({ access: "new-token" });

    await expect(handler(mockEvent, mockContext)).rejects.toThrow(err);

    // Add assertions here
    expect(GoCardlessMapper.prototype.fetchTransactions).toHaveBeenCalledTimes(
      2,
    );
    expect(GocardlessOauthClient.prototype.isAccessExpired).toHaveBeenCalled();
    expect(GocardlessOauthClient.prototype.refreshAuthToken).toHaveBeenCalled();
  });

  it("should handle error writing transactions", async () => {
    (YnabWriter.prototype.bulkWrite as jest.Mock).mockRejectedValue(
      new Error("Write error"),
    );

    await handler(mockEvent, mockContext);

    // Add assertions here
    expect(YnabWriter.prototype.bulkWrite).toHaveBeenCalled();
    // You might want to check if the error is logged properly
  });
});
