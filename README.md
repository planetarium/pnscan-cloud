# pnscan-cloud
pnscan-cloud is the fork of [9cscan-cloud][] from [tx0x][]. 9cscan-cloud is the serverless backend of [9cscan][], most popular block explorer for [Nine Chronicles][]

pnscan and pnscan-cloud's have same purpose (i.e., block explorer for the network built by [Libplanet][]), but it has been elimiated Nine Chronicles specific feature and relies APIs provided by [Libplanet.Explorer][] only, to suggest the reference block explorer implementation for production.

[9cscan-cloud]: https://github.com/tx0x/9cscan-cloud
[9cscan]: https://9cscan.com/
[tx0x]: https://github.com/tx0x
[Nine Chronicles]: https://nine-chronicles.com
[Libplanet]: https://libplanet.io
[Libplanet.Explorer]: https://github.com/planetarium/libplanet/tree/main/Libplanet.Explorer

### API
**[APIGateway] -> [Lambda] -> [Dynamodb]**

Provides a rest API that can inquire blocks and transactions.

### Sync
**[EventBridge] -> [StepFunction] -> [Lambda] -> [Dynamodb]**

Synchronize the Nine Chronicles chain data to dynamodb.

### WS
**[DynamoStream] -> [Lambda] -> [APIGateway]**

When a new block is created, it is broadcast through WebSocket.

## Getting started
### 1. IAM (in the AWS console)
1. Manually create a new IAM policy using `/bootstrap/iam/9cscan-policy.json`
   https://console.aws.amazon.com/iamv2/home#/policies
2. Manually create a new IAM role using `/bootstrap/iam/9cscan-role-trust.json`
   https://console.aws.amazon.com/iamv2/home#/roles
3. Manually create a new IAM user with the policy you created.

### 2. Pull this project to local

```
git clone https://github.com/tx0x/9cscan-cloud
cd 9cscan-cloud
npm install
```

### 3. Create and fill .config file

```
{
  // Required.
  "region": "ap-northeast-2",
  
  // Required. AccessKey of user you created (1.3)
  "credentials": {
    "accessKeyId": "",
    "secretAccessKey": ""
  },
  
  // Required. Arn of role you created (1.2)
  "iamRoleArn": "",

  // Optional. to fetch WNCG price
  "coinMarketCapKeys": {
    "alias": "key" 
  },
  
  //Required. Nine Chronicles graphql endpoints
  "graphqlEndpoints": [
    "http://your-host1/graphql/",
    "http://your-host2/graphql/"
  ],
  
  //Required.
  "namespace": "prod",
  
  //Required.
  "s3WebBucketName": "9cscan-bucket"
}
```


### 4. Create serverless environments

```
npm run create-s3

------------------------------

SUCCESS : https://your-s3-endpoint/index.html

```

Before proceeding, make sure that the endpoint is working.

```
npm run create-db

------------------------------

Dynamodb : create table Prod.Account
SUCCESS : Prod.Account : arn:aws:dynamodb
Dynamodb : create table Prod.AccountTransaction
SUCCESS : Prod.AccountTransaction : arn:aws:dynamodb
Dynamodb : create table Prod.Action
SUCCESS : Prod.Action : arn:aws:dynamodb
Dynamodb : create table Prod.Block
SUCCESS : Prod.Block : arn:aws:dynamodb
Dynamodb : create table Prod.Cache
SUCCESS : Prod.Cache : arn:aws:dynamodb
Dynamodb : create table Prod.LatestBlocks
SUCCESS : Prod.LatestBlocks : arn:aws:dynamodb
Dynamodb : create table Prod.Transaction
SUCCESS : Prod.Transaction : arn:aws:dynamodb
Dynamodb : create table Prod.WebsocketConnection
SUCCESS : Prod.WebsocketConnection : arn:aws:dynamodb

```

```
npm run create-api
npm run create-sync
npm run create-ws
```

### 5. Deploy projects

```
npm run deploy-api
npm run deploy-sync
npm run deploy-ws
```

### 6. Check status

```
npm run check-api

...
GET /blocks api response
...
```

```
npm run check-ws

...
Subscribe new block event
...
```

```
npm run check-s3

...
Get index.html
...
```

### 7. Web Client
For the web client, use the following project:

https://github.com/tx0x/9cscan.com

## License

Apache 2.0
