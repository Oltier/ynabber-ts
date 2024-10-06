import { Construct } from "constructs";
import { SsmLayerProps } from "../ssm/types";
import {
  Architecture,
  ParamsAndSecretsLogLevel,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration } from "aws-cdk-lib";
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

export const FUNCTION = "function";
export const YNABBER_SYNC = "ynabber-sync";
export const LAMBDA_TIMEOUT_SEC = 60;

const defaultSsmLayerProps: SsmLayerProps = {
  PARAMETERS_SECRETS_EXTENSION_CACHE_ENABLED: true,
  PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE: 1000,
  PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: 2773,
  PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL: ParamsAndSecretsLogLevel.DEBUG,
  PARAMETERS_SECRETS_EXTENSION_MAX_CONNECTIONS: 3,
  SECRETS_MANAGER_TIMEOUT_MILLIS: 0,
  SECRETS_MANAGER_TTL: 300,
  SSM_PARAMETER_STORE_TIMEOUT_MILLIS: 0,
  SSM_PARAMETER_STORE_TTL: 300,
};

export class YnabberSync extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // add ssm:GetParameter policy to the lambda
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
      memorySize: 256,
      environment: {
        ...toEnvVars(defaultSsmLayerProps),
      },
      role: lambdaRole,
      logRetention: RetentionDays.ONE_MONTH,
    });

    lambda.addLayers(arm64EuCentral1SsmLayer(this, id));
  }
}
