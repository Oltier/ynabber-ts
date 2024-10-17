import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { YnabberTsStack } from "../lib/ynabber-ts-stack";

describe("Ynabber Sync stack", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new YnabberTsStack(app, "MyTestStack");
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

    it("should have a role with kms and ssm permissions", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: [
            {
              Action: "kms:Decrypt",
              Effect: "Allow",
              Resource: "*",
            },
            {
              Action: "ssm:GetParameter",
              Effect: "Allow",
              Resource: "*",
            },
          ],
        },
      });
    });

    it("should also add default lambda policies", () => {
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
