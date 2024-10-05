import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { YNABBER_SYNC, YnabberSync } from "./ynabber-sync/ynabber-sync";

export class YnabberTsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new YnabberSync(this, YNABBER_SYNC);
  }
}
