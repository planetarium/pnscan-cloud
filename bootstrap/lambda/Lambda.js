const AWS = require("aws-sdk")
const Log = require("../Log")
const fs = require("fs")

class Lambda {
    constructor(config) {
        this.config = config
        this.lambda = new AWS.Lambda(config)
    }
    async updateEnvValue(lambdaName, data) {
        let {Environment} = await this.lambda.getFunctionConfiguration({
            FunctionName: lambdaName
        }).promise()

        await this.lambda.updateFunctionConfiguration({
            FunctionName: lambdaName,
            Environment: {
                Variables: {
                    ...(Environment && Environment.Variables || {}),
                    ...data
                }

            }
        }).promise()
        console.log(Log.Color.Green, 'SUCCESS : Set lambda environment variable ', data)
    }
    async createTrigger(lambdaName, sourceArn) {
        return this.lambda.createEventSourceMapping({
            FunctionName: lambdaName,
            BatchSize: 10,
            EventSourceArn: sourceArn,
            StartingPosition: "LATEST"
        }).promise()
        console.log(Log.Color.Green, 'SUCCESS : Created Lambda trigger by dynamodb latestBlocks')
    }
    async createFunction(name, options = {}) {
        let {FunctionArn} = await this.lambda.createFunction({
            Code: {
                ZipFile: fs.readFileSync(__dirname + "/sample/sample.zip")
            },
            FunctionName: name,
            Role: this.config.iamRoleArn,
            Handler: "index.get",
            MemorySize: '128',
            Runtime: 'nodejs12.x',
            Timeout: '15',
            ...options
        }).promise()
        this.lambda.addPermission({

        })
        console.log(Log.Color.Green, 'SUCCESS : Created Lambda Function ', name, FunctionArn)
        return {name, arn: FunctionArn}
    }
    async uploadFunction(name, zipPath) {
        let response = await this.lambda.updateFunctionCode({
            FunctionName: name,
            ZipFile: fs.readFileSync(zipPath)
        }).promise()
        console.log(Log.Color.Green, 'SUCCESS : Upload Lambda Function ', response)
    }
}

module.exports = Lambda