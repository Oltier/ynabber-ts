import { LayerVersion } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { request } from "undici";

export const arm64EuCentral1SsmLayer = (scope: Construct, namePrefix: string) =>
  LayerVersion.fromLayerVersionArn(
    scope,
    `${namePrefix}-ssm`,
    "arn:aws:lambda:eu-central-1:187925254637:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:12",
  );

export const getSsmParameter = async <
  T extends Record<string, string> | string,
>(
  parameterPath: string,
  sessionToken: string,
  decrypt: boolean = false,
  ssmPort?: string,
): Promise<T> => {
  const path = encodeURIComponent(`${parameterPath}`);
  const { statusCode, headers, trailers, body } = await request(
    `http://localhost:${ssmPort || "2773"}/systemsmanager/parameters/get?name=${path}${decrypt ? "&withDecryption=true" : ""}`,
    {
      method: "GET",
      headers: {
        "X-Aws-Parameters-Secrets-Token": sessionToken,
      },
    },
  );

  if (statusCode !== 200) {
    console.error("res", {
      headers,
      trailers,
      statusCode,
    });
    try {
      const errorJson = await body.json();
      console.error("errorJson: ", errorJson);
    } catch (e) {
      try {
        console.error("Error parsing error response as json", e);
        const errorText = await body.text();
        console.error("errorText: ", errorText);
      } catch (e) {
        console.error("Error parsing error response as text", e);
      }
    }
    throw new Error("Error getting parameter from SSM");
  }

  const res = await body.json();
  if (
    typeof res === "object" &&
    res !== null &&
    "Parameter" in res &&
    typeof res.Parameter === "object" &&
    res.Parameter !== null &&
    "Value" in res.Parameter
  ) {
    try {
      return JSON.parse(res.Parameter.Value as string);
    } catch (e) {
      return res.Parameter.Value as T;
    }
  }
  console.error("Unexpected response from SSM", res);
  throw new Error("Unexpected response from SSM");
};
