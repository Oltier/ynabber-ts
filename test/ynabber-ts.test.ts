import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { YnabberTsStack } from "../lib/ynabber-ts-stack";
import {
  FUNCTION,
  LAMBDA_TIMEOUT_SEC,
  schedules,
  YNABBER_SYNC,
} from "../lib/ynabber-sync/ynabber-sync";

describe("Ynabber Sync stack", () => {
  const app = new cdk.App();
  // WHEN
  const stackProps = {
    env: { account: "307946656297", region: "eu-central-1" },
  } satisfies StackProps;
  const stack = new YnabberTsStack(app, "MyTestStack", stackProps);
  // THEN
  const template = Template.fromStack(stack);

  describe("ynabber sync lambda function", () => {
    it("should create function", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: "nodejs20.x",
        Layers: [
          "arn:aws:lambda:eu-central-1:187925254637:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:12",
        ],
      });
    });

    it("should have the correct timeout", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: LAMBDA_TIMEOUT_SEC,
      });
    });

    it("should use ARM64 architecture", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Architectures: ["arm64"],
      });
    });

    it("should have the correct memory size", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        MemorySize: 512,
      });
    });

    it("should have the correct environment variables", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            PARAMETERS_SECRETS_EXTENSION_CACHE_ENABLED: "true",
            PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE: "1000",
            PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: "2773",
            PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL: "info",
            PARAMETERS_SECRETS_EXTENSION_MAX_CONNECTIONS: "3",
            SECRETS_MANAGER_TIMEOUT_MILLIS: "0",
            SECRETS_MANAGER_TTL: "300",
            SSM_PARAMETER_STORE_TIMEOUT_MILLIS: "0",
            SSM_PARAMETER_STORE_TTL: "300",
          },
        },
      });
    });

    describe("Lambda permissions", () => {
      it("should have a role with STS assumeRole actions", () => {
        template.hasResourceProperties("AWS::IAM::Role", {
          AssumeRolePolicyDocument: {
            Statement: [
              {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: {
                  Service: "lambda.amazonaws.com",
                },
              },
            ],
          },
        });
      });

      it("should have correct inline policies", () => {
        template.hasResourceProperties("AWS::IAM::Policy", {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: "kms:Decrypt",
                Effect: "Allow",
                Resource: "*",
              }),
              Match.objectLike({
                Action: "ssm:GetParameter",
                Effect: "Allow",
                Resource: "*",
              }),
            ]),
          },
        });
      });

      it("should have correct managed policies attached", () => {
        template.hasResourceProperties("AWS::IAM::Role", {
          ManagedPolicyArns: [
            {
              "Fn::Join": [
                "",
                [
                  "arn:",
                  { Ref: "AWS::Partition" },
                  ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:",
                  { Ref: "AWS::Partition" },
                  ":iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
                ],
              ],
            },
          ],
        });
      });

      it("should grant EventBridge permission to invoke Lambda", () => {
        template.hasResourceProperties("AWS::Lambda::Permission", {
          Action: "lambda:InvokeFunction",
          Principal: "events.amazonaws.com",
          SourceAccount: stackProps.env.account,
        });
      });
    });
  });

  describe("EventBridge Rules", () => {
    it("should create the correct number of EventBridge rules", () => {
      template.resourceCountIs(
        "AWS::Events::Rule",
        Object.keys(schedules).length,
      );
    });

    Object.entries(schedules).forEach(([connectionId, schedule]) => {
      it(`should create a rule for connection ${connectionId} with correct properties`, () => {
        template.hasResourceProperties("AWS::Events::Rule", {
          ScheduleExpression: schedule.expressionString,
          Targets: [
            Match.objectLike({
              Arn: {
                "Fn::GetAtt": [Match.stringLikeRegexp(`${FUNCTION}.*`), "Arn"],
              },
              Id: "Target0",
              Input: Match.serializedJson(
                Match.objectLike({
                  id: Match.stringLikeRegexp(
                    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
                  ),
                  version: "1",
                  account: stack.account,
                  time: Match.stringLikeRegexp(
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
                  ),
                  region: stack.region,
                  resources: [],
                  source: YNABBER_SYNC,
                  "detail-type": "YnabberEventDetail",
                  detail: {
                    connectionId,
                  },
                }),
              ),
            }),
          ],
        });
      });
    });
  });
});
