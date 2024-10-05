import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export const FUNCTION = "function";
export const YNABBER_SYNC = "ynabber-sync";

export class YnabberSync extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const ynabberSync = new NodejsFunction(this, FUNCTION);
  }
}
