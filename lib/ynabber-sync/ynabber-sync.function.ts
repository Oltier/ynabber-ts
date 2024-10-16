import { Context, EventBridgeEvent } from "aws-lambda";
import { getSsmParameter } from "../ssm/SsmLayer";
import { MongoClient } from "mongodb";
import ConnectionRepository from "./repositories/connection-repository";
import { createLogger, format, transports } from "winston";

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

let client: MongoClient;
let connectionRepository: ConnectionRepository;

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

  if (!client) {
    client = await MongoClient.connect(secrets.mongoConnectionString, {
      connectTimeoutMS: 5000,
      maxIdleTimeMS: 60000,
    });
    connectionRepository = new ConnectionRepository(client);
  }

  // Fetch connection config
  const connectionId = event.detail.connectionId;
  const connection = await connectionRepository.findOne({ id: connectionId });

  if (!connection) {
    console.info(`Connection not found for id: ${connectionId}`);
    // TODO clean up connection
    return;
  }

  console.log("connection: ", connection);
};
