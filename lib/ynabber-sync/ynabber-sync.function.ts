import { Context, EventBridgeEvent } from "aws-lambda";
import { getSsmParameter } from "../ssm/SsmLayer";

type EventDetail = {
  connectionId: string;
};

type Config = {
  goCardLessSecretId: string;
  goCardLessSecretKey: string;
  ynabToken: string;
};

export const handler = async (
  event: EventBridgeEvent<string, EventDetail>,
  context: Context,
): Promise<void> => {
  const secrets = await getSsmParameter<Config>(
    "ynabber-sync",
    process.env.AWS_SESSION_TOKEN!,
    true,
    process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT,
  );
  console.log("event: ", event);
};
