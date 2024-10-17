# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

## Codegen

```shell
npx swagger-typescript-api -p "https://bankaccountdata.gocardless.com/api/v2/swagger.json" -o ./lib/ynabber-sync/generated/gocardless --api-class-name GocardlessApiClient --single-http-client --name gocardless-api-client.generated.ts
```
