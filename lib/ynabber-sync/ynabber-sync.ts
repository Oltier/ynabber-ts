import { Construct } from "constructs";
import { SsmLayerProps } from "../ssm/types";
import {
  Architecture,
  ParamsAndSecretsLogLevel,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration, StackProps } from "aws-cdk-lib";
import { toEnvVars } from "../utils/object-utils";
import { arm64EuCentral1SsmLayer } from "../ssm/SsmLayer";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Schedule } from "aws-cdk-lib/aws-events";
import { CfnSchedule } from "aws-cdk-lib/aws-scheduler";
import { EventDetail } from "./ynabber-sync.function";

export const FUNCTION = "function";
export const YNABBER_SYNC = "ynabber-sync";
export const LAMBDA_TIMEOUT_SEC = 60;

const defaultSsmLayerProps: SsmLayerProps = {
  PARAMETERS_SECRETS_EXTENSION_CACHE_ENABLED: true,
  PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE: 1000,
  PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: 2773,
  PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL: ParamsAndSecretsLogLevel.INFO,
  PARAMETERS_SECRETS_EXTENSION_MAX_CONNECTIONS: 3,
  SECRETS_MANAGER_TIMEOUT_MILLIS: 0,
  SECRETS_MANAGER_TTL: 300,
  SSM_PARAMETER_STORE_TIMEOUT_MILLIS: 0,
  SSM_PARAMETER_STORE_TTL: 300,
};

// Invocation schedules
const OTP_CALLS_PER_DAY = 10;
const NORDEA_CALLS_PER_DAY = 4;
const INVOKE_OTP_LAMBDA_SCHEDULE_MINUTES = (24 * 60) / (OTP_CALLS_PER_DAY - 1);
const INVOKE_NORDEA_LAMBDA_SCHEDULE_MINUTES =
  (24 * 60) / (NORDEA_CALLS_PER_DAY - 1);

export const schedules: Record<string, Schedule> = {
  "e25d23fc-8332-43f8-9456-bcf679f6d5cc": Schedule.rate(
    Duration.minutes(INVOKE_NORDEA_LAMBDA_SCHEDULE_MINUTES),
  ),
  "4769daee-1021-4605-b971-0ac628808ee1": Schedule.cron({
    hour: "5,11,17,23",
    minute: "0",
  }),
  "38c762d2-5de9-4f44-adfb-71180fbf25ab": Schedule.rate(
    Duration.minutes(INVOKE_OTP_LAMBDA_SCHEDULE_MINUTES),
  ),
};

export class YnabberSync extends Construct {
  constructor(scope: Construct, id: string, stackProps: StackProps) {
    super(scope, id);

    const lambdaRole = new Role(this, `${id}Role`, {
      roleName: `${id}Role`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["kms:Decrypt"],
        // TODO: restrict to specific parameters
        resources: ["*"],
      }),
    );

    lambdaRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        // TODO: restrict to specific parameters
        resources: ["*"],
      }),
    );

    lambdaRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole",
      ),
    );

    lambdaRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole",
      ),
    );

    const lambda = new NodejsFunction(this, FUNCTION, {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      retryAttempts: 0,
      timeout: Duration.seconds(LAMBDA_TIMEOUT_SEC),
      memorySize: 512,
      environment: {
        ...toEnvVars(defaultSsmLayerProps),
      },
      role: lambdaRole,
      logRetention: RetentionDays.ONE_MONTH,
    });

    lambda.addLayers(arm64EuCentral1SsmLayer(this, id));

    const invokeLambdaRole = new Role(this, `${id}InvokeLambdaRole`, {
      roleName: `${id}InvokeLambdaRole`,
      assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
    });

    invokeLambdaRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [lambda.functionArn],
      }),
    );

    Object.entries(schedules).map(
      ([connectionId, schedule]) =>
        new CfnSchedule(this, `InvokeConnection-${connectionId}`, {
          scheduleExpression: schedule.expressionString,
          flexibleTimeWindow: {
            mode: "OFF",
          },
          target: {
            arn: lambda.functionArn,
            roleArn: invokeLambdaRole.roleArn,
            input: JSON.stringify({
              connectionId,
            } satisfies EventDetail),
          },
        }),
    );
  }
}
