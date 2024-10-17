import { Context, EventBridgeEvent } from "aws-lambda";
import { getSsmParameter } from "../ssm/SsmLayer";
import { MongoClient } from "mongodb";
import ConnectionRepository from "./repositories/connection-repository";
import { createLogger, format, transports } from "winston";
import GoCardlessMapper from "./reader/gocardless";
import { GocardlessApiClient } from "./generated/gocardless/gocardless-api-client.generated";
import {
  AuthTokenSecurity,
  createGocardlessApiClient,
} from "./clients/gocardless-client";
import GocardlessOauthClient from "./clients/gocardless-oauth-client";
import { Transaction } from "./ynabber/transaction";
import YnabWriter from "./writers/ynab-writer";

type EventDetail = {
  connectionId: string;
};

type Config = {
  goCardLessSecretId: string;
  goCardLessSecretKey: string;
  ynabToken: string;
  mongoConnectionString: string;
};

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.json(),
  transports: [new transports.Console()],
});

let mongoClient: MongoClient;
let connectionRepository: ConnectionRepository;
let gocardlessOauthClient: GocardlessOauthClient;
let gocardlessApiClient: GocardlessApiClient<AuthTokenSecurity>;

export const handler = async (
  event: EventBridgeEvent<string, EventDetail>,
  context: Context,
): Promise<void> => {
  logger.defaultMeta = { requestId: context.awsRequestId };
  const secrets = await getSsmParameter<Config>(
    "ynabber-sync",
    process.env.AWS_SESSION_TOKEN!,
    true,
    process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT,
  );

  if (!mongoClient) {
    mongoClient = await MongoClient.connect(secrets.mongoConnectionString, {
      connectTimeoutMS: 5000,
      maxIdleTimeMS: 60000,
    });
    connectionRepository = new ConnectionRepository(mongoClient);
  }

  if (!gocardlessOauthClient) {
    gocardlessOauthClient = new GocardlessOauthClient({
      secretId: secrets.goCardLessSecretId,
      secretKey: secrets.goCardLessSecretKey,
    });
  }

  if (!gocardlessApiClient) {
    gocardlessApiClient = createGocardlessApiClient({
      authToken: await gocardlessOauthClient.getAuthToken(),
    });
  }

  // Fetch connection config
  const connectionId = event.detail.connectionId;
  const connection = await connectionRepository.findOne({ id: connectionId });

  if (!connection) {
    logger.info(`Connection not found for id: ${connectionId}`);
    // TODO clean up connection
    return;
  }

  const ynabWriter = new YnabWriter(connection, logger, secrets.ynabToken);

  logger.info("connection: ", connection);

  let transactions: Transaction[] = [];
  try {
    transactions = await new GoCardlessMapper(
      connection,
      gocardlessApiClient,
      logger,
    ).fetchTransactions();
  } catch (e) {
    logger.error("Error fetching transactions: ", e);
    if (gocardlessOauthClient.isAccessExpired()) {
      logger.info("access seems to be expired, try fetching new token");
      gocardlessApiClient = createGocardlessApiClient({
        authToken: (await gocardlessOauthClient.refreshAuthToken()).access,
      });
      transactions = await new GoCardlessMapper(
        connection,
        gocardlessApiClient,
        logger,
      ).fetchTransactions();
    }
  }

  logger.info("transactions: ", transactions);

  try {
    const ynabResponse = await ynabWriter.bulkWrite(transactions);
    logger.info("ynabResponse: ", ynabResponse);
  } catch (e) {
    logger.error("Error writing transactions: ", e);
  }
};
