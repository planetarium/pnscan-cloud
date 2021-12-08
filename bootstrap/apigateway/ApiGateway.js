const AWS = require("aws-sdk")
const Log = require("../Log")
const fs = require("fs")
const path = require("path")

class ApiGateway {
    constructor(config) {
        this.config = config
        this.client = new AWS.APIGateway(config)
        this.clientV2 = new AWS.ApiGatewayV2(config)
    }
    async createWebsocket(name, lambdaArn) {
        try {
            let {Items} = await this.clientV2.getApis({}).promise()
            if (Items.find(item => item.Name === name)) {
                console.log(Log.Color.Red, 'Already websocket api exists',name)
                return
            }
        } catch(e) {}

        let created = await this.clientV2.createApi({
            Name: name,
            ProtocolType: "WEBSOCKET",
            RouteSelectionExpression: "$request.body.action",
        }).promise()
        let id = created['ApiId']
        let {IntegrationId} = await this.clientV2.createIntegration({
            ApiId: id,
            IntegrationType: "AWS_PROXY",
            IntegrationMethod: "POST",
            CredentialsArn: this.config.iamRoleArn,
            IntegrationUri: `arn:aws:apigateway:${this.config.region}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,

        }).promise()
        await this.clientV2.createRoute({
            ApiId: id,
            RouteKey: "$connect",
            Target: "integrations/" + IntegrationId
        }).promise()
        await this.clientV2.createRoute({
            ApiId: id,
            RouteKey: "$disconnect",
            Target: "integrations/" + IntegrationId
        }).promise()
        await this.clientV2.createRoute({
            ApiId: id,
            RouteKey: "$default",
            Target: "integrations/" + IntegrationId
        }).promise()
        await this.clientV2.createStage({
            ApiId: id,
            AutoDeploy: true,
            StageName: "production"
        }).promise()

        console.log(Log.Color.Green, `SUCCESS : Created Webscoket`, created)
        return created
    }
    async createGateway(name, lambdaArn) {
        try {
            let {items} = await this.client.getRestApis({}).promise()
            if (items.find(item => item.name === name)) {
                console.log(Log.Color.Red, 'Already rest api exists',name)
                return
            }
        } catch(e) {}

        let created = await this.client.createRestApi({
            name
        }).promise()

        let id = created['id']
        let root = await this.client.getResources({
            restApiId: id
        }).promise()
        let resource = await this.client.createResource({
            parentId: root['items'][0].id,
            pathPart: "{proxy+}",
            restApiId: id
        }).promise()
        await this.client.putMethod({
            resourceId: resource.id,
            httpMethod: "ANY",
            restApiId: id,
            authorizationType: "NONE"
        }).promise()
        await this.client.putIntegration({
            httpMethod: "ANY",
            resourceId: resource.id,
            restApiId: id,
            type: "AWS_PROXY",
            integrationHttpMethod: "POST",
            uri: `arn:aws:apigateway:${this.config.region}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`,
            credentials: this.config.iamRoleArn
        }).promise()
        await this.client.createDeployment({
            restApiId: id,
            stageName: 'Prod'
        }).promise()
        console.log(Log.Color.Green, `SUCCESS API Endpoint : https://${id}.execute-api.${this.config.region}.amazonaws.com/Prod/blocks`)
        return {'endpoint': `https://${id}.execute-api.${this.config.region}.amazonaws.com/Prod`}
    }
}

module.exports = ApiGateway