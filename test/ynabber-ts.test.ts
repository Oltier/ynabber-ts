import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { YnabberTsStack } from "../lib/ynabber-ts-stack";
import {
  FUNCTION,
  LAMBDA_TIMEOUT_SEC,
  schedules,
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
    });
  });

  describe("AWS Scheduler", () => {
    it("should create the correct number of schedules", () => {
      template.resourceCountIs(
        "AWS::Scheduler::Schedule",
        Object.keys(schedules).length,
      );
    });

    Object.entries(schedules).forEach(([connectionId, schedule]) => {
      it(`should create a schedule for connection ${connectionId} with correct properties`, () => {
        template.hasResourceProperties("AWS::Scheduler::Schedule", {
          ScheduleExpression: schedule.expressionString,
          FlexibleTimeWindow: {
            Mode: "OFF",
          },
          Target: Match.objectLike({
            Arn: {
              "Fn::GetAtt": [Match.stringLikeRegexp(`${FUNCTION}.*`), "Arn"],
            },
            RoleArn: {
              "Fn::GetAtt": [
                Match.stringLikeRegexp(`.*InvokeLambdaRole`),
                "Arn",
              ],
            },
            Input: Match.serializedJson(
              Match.objectLike({
                connectionId,
              }),
            ),
          }),
        });
      });
    });
  });

  describe("Invoke Lambda Role", () => {
    it("should create an IAM role for invoking Lambda", () => {
      template.hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: {
                Service: "scheduler.amazonaws.com",
              },
            },
          ],
        }),
      });
    });

    it("should have correct inline policy to invoke Lambda", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "lambda:InvokeFunction",
              Effect: "Allow",
              Resource: {
                "Fn::GetAtt": [Match.stringLikeRegexp(`${FUNCTION}.*`), "Arn"],
              },
            }),
          ]),
        },
      });
    });
  });
});
