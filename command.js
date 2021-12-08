const WebSocket = require('websocket').client
const axios = require('axios')
const Dynamodb = require('./bootstrap/dynamodb/Dynamodb')
const S3 = require('./bootstrap/s3/S3')
const Lambda = require('./bootstrap/lambda/Lambda')
const ApiGateway = require('./bootstrap/apigateway/ApiGateway')
const StepFunction = require('./bootstrap/stepfunction/StepFunction')
const EventBridge = require('./bootstrap/eventbridge/EventBridge')
const {zipDirectory} = require('./lib/zipDir')
const {config, loadDeployResult, exportDeployResult} = require("./config")

let namespaced = (name) => config.namespace ? `${name}-${config.namespace}` :  name

class Command {
    constructor() {
        this.s3 = new S3(config)
        this.dynamo = new Dynamodb(config)
        this.lambda = new Lambda(config)
        this.apiGateway = new ApiGateway(config)
        this.stepFunction = new StepFunction(config)
        this.eventBridge = new EventBridge(config)

        this.apiName = namespaced('9cscan-api')
        this.syncName = namespaced('9cscan-sync')
        this.wsName = namespaced('9cscan-ws')
        this.checkerName = namespaced('9cscan-checker')
    }

    async createDB() {
        await this.dynamo.createTables()
    }

    /**
     * [S3 : static web]
     */
    async createS3() {
        let {webBucketName, webEndpoint} = await this.s3.createStaticWebBucket(config['s3WebBucketName'])
        exportDeployResult('webBucketName', webBucketName)
        exportDeployResult('webEndpoint', webEndpoint)
    }

    /**
     * [APIGateway : api endpoint] -> [Lambda]
     */
    async createAPI() {
        let {arn} = await this.lambda.createFunction(this.apiName, {Handler: "index.handler"})
        let {endpoint} = await this.apiGateway.createGateway(this.apiName, arn)
        await this.lambda.updateEnvValue(this.apiName, {
            'region': config['region'],
            'tablePrefix': this.dynamo.getPrefix(),
            'graphqlEndpoints': JSON.stringify(config['graphqlEndpoints']),
            'CMC_KEYS': JSON.stringify(config['coinMarketCapKeys']),
            'NODE_ENV': "production"
        })
        exportDeployResult('apiEndpoint', endpoint)
    }

    /**
     * [EventBridge : call every 1m] -> [StepFunction : call every 5s] -> [Lambda]
     */
    async createSync() {
        let {arn} = await this.lambda.createFunction(this.syncName, {Timeout: '90'})
        let {stateMachineArn} = await this.stepFunction.createCronEvery5Seconds('cronEvery5Sec-' + this.syncName, arn)
        await this.lambda.updateEnvValue(this.syncName, {
            'region': config['region'],
            'tablePrefix': this.dynamo.getPrefix(),
            'graphqlEndpoints': JSON.stringify(config['graphqlEndpoints'])
        })
        await this.eventBridge.createEventRule(this.syncName, stateMachineArn)
    }

    /**
     * [APIGateway(Websocket) : subscribe] -> [Lambda] <- [Dynamodb Stream]
     */
    async createWebsocket() {
        let {arn} = await this.lambda.createFunction(this.wsName)
        let ws = await this.apiGateway.createWebsocket(this.wsName, arn)
        let {Table: {LatestStreamArn}} = await this.dynamo.describeTable("LatestBlocks")
        await this.lambda.createTrigger(this.wsName, LatestStreamArn)
        let wsEndpoint = ws.ApiEndpoint.replace('wss', 'https') + '/production/'
        await this.lambda.updateEnvValue(this.wsName, {
            'region': config['region'],
            'wsEndpoint': wsEndpoint,
            'tablePrefix': this.dynamo.getPrefix()
        })
        exportDeployResult('wsEndpoint', ws.ApiEndpoint + '/production')
    }

    /**
     * [EventBridge : call every 1m] -> [Lambda]
     */
    async createChecker() {
        let {arn} = await this.lambda.createFunction(this.checkerName)
        await this.lambda.updateEnvValue(this.checkerName, {
            'region': config['region'],
            'tablePrefix': this.dynamo.getPrefix(),
            'notifySlackEndpoint': config['notifySlackEndpoint']
        })
        await this.eventBridge.createEventRule(this.checkerName, arn)
    }

    async deploySync() {
        let zipPath = __dirname + '/project/sync.zip'
        await zipDirectory(__dirname + '/project/sync', zipPath)
        await this.lambda.uploadFunction(this.syncName, zipPath)
    }
    async deployAPI() {
        let zipPath = __dirname + '/project/api.zip'
        await zipDirectory(__dirname + '/project/api', zipPath)
        await this.lambda.uploadFunction(this.apiName, zipPath)
    }
    async deployWS() {
        let zipPath = __dirname + '/project/websocket.zip'
        await zipDirectory(__dirname + '/project/websocket', zipPath)
        await this.lambda.uploadFunction(this.wsName, zipPath)
    }
    async deployChecker() {
        let zipPath = __dirname + '/project/checker.zip'
        await zipDirectory(__dirname + '/project/checker', zipPath)
        await this.lambda.uploadFunction(this.checkerName, zipPath)
    }

    async checkDeployedAPI() {
        let {apiEndpoint} = loadDeployResult()
        let {data} = await axios.get(apiEndpoint + '/blocks')
        console.log(JSON.stringify(data, null, 2))
    }
    async checkDeployedWS() {
        let {wsEndpoint} = loadDeployResult()

        console.log('trying to connect...', wsEndpoint)

        await new Promise(resolve => {
            let ws = new WebSocket()
            ws.on('connectFailed', () => {
                console.log('connect failed')
                resolve()
            })
            ws.on('connect', conn => {
                console.log('connected')
                conn.on('error', () => {
                    resolve()
                })
                conn.on('close', () => {
                    resolve()
                })
                conn.on('message', console.log)
            })
            ws.connect(wsEndpoint)
        })
    }
    async checkDeployedS3() {
        let {webEndpoint} = loadDeployResult()
        let {data:html} = await axios.get(webEndpoint)
        console.log(html)
    }
}

;(async () => {
    let action = process.argv[2]
    let command = new Command()
    if (command[action]) {
        await command[action]()
    }
})()
