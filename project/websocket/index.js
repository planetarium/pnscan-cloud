const AWS = require("aws-sdk")
const client = new AWS.DynamoDB.DocumentClient()
const ApiGatewayManagementApi = require('aws-sdk/clients/apigatewaymanagementapi')

function prefix(name) {
  let prefix = process.env.tablePrefix
  if (prefix) {
    return `${prefix}.${name}`
  }
  return name
}

async function connect(id) {
  await client.put({
    TableName: prefix("WebsocketConnection"),
    Item: {
      connectionId: id,
      TTL: parseInt(new Date/1000) + 120
    }
  }).promise()
}

async function disconnect(id) {
  await client.delete({
    TableName: prefix("WebsocketConnection"),
    Key: {
      connectionId: id
    }
  }).promise()
}

async function broadcast(request) {
  let connections = await client.scan({ TableName: prefix("WebsocketConnection"), ProjectionExpression: 'connectionId' }).promise();
  const api = new ApiGatewayManagementApi({
    endpoint: process.env.wsEndpoint,
  });

  const postCalls = connections.Items.map(async ({ connectionId }) => {
    try {
      await api.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(request.data) }).promise();
    } catch(e) {
      if(e.code == "GoneException") {
        await disconnect(connectionId)
      }
    }
  });

  await Promise.all(postCalls);
}

exports.get = async function(event, context, callback) {
  let request = event.requestContext
  if (request && (request.routeKey == "$connect" || request.routeKey == "$default")) {
    await connect(request.connectionId)
  } else if (request && request.routeKey == "$disconnect") {
    await disconnect(request.connectionId)
  } else if (request && request.action == "BROADCAST") {
    await broadcast(request)
  } else if (event.Records) { 
    //from dynamo stream
    event.Records.forEach(async (record) => {
        if (record.eventName == 'INSERT') {
            await broadcast({data: record.dynamodb.NewImage})
        }
    });
  }
  
  callback(null, {
    statusCode: 200,
    body: '{"result":"ok"}',
    headers: {'content-type': 'application/json'}
  })
}