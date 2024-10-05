#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { YnabberTsStack } from "../lib/ynabber-ts-stack";

const app = new cdk.App();
new YnabberTsStack(app, "YnabberTsStack", {
  env: { account: "307946656297", region: "eu-central-1" },
});
