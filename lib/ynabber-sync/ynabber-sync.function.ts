import { Context, EventBridgeEvent } from "aws-lambda";

type EventDetail = {
  connectionId: string;
};

export const handler = async (
  event: EventBridgeEvent<string, any>,
  context: Context,
): Promise<void> => {
  console.log("event: ", event);
};
