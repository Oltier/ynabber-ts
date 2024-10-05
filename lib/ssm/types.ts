import { ParamsAndSecretsLogLevel } from "aws-cdk-lib/aws-lambda";

export type SsmLayerProps = {
  PARAMETERS_SECRETS_EXTENSION_CACHE_ENABLED: boolean;
  PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE: number;
  PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: number;
  PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL: ParamsAndSecretsLogLevel;
  PARAMETERS_SECRETS_EXTENSION_MAX_CONNECTIONS: number;
  SECRETS_MANAGER_TIMEOUT_MILLIS: number;
  SECRETS_MANAGER_TTL: number;
  SSM_PARAMETER_STORE_TIMEOUT_MILLIS: number;
  SSM_PARAMETER_STORE_TTL: number;
};

export type LambdaWithSsmProps = {
  functionName: string;
  lambdaTimeoutSec?: number;
  ssmLayerProps?: SsmLayerProps;
};
