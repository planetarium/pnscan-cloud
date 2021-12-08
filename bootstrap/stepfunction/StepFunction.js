const AWS = require("aws-sdk")
const Log = require("../Log")
const fs = require("fs")
const path = require("path")

class StepFunction {
    constructor(config) {
        this.config = config
        this.client = new AWS.StepFunctions(config)
    }

    async createCronEvery5Seconds(name, lambdaArn) {
        let response = await this.client.createStateMachine({
            name: name,
            roleArn: this.config.iamRoleArn,
            definition: JSON.stringify({
                "Comment": "Invoke Lambda every 5 seconds",
                "StartAt": "ConfigureCount",
                "States": {
                    "ConfigureCount": {
                        "Type": "Pass",
                        "Result": {
                            "index": 0,
                            "count": 60
                        },
                        "ResultPath": "$.iterator",
                        "Next": "Iterator"
                    },
                    "Iterator": {
                        "Type": "Task",
                        "Resource": lambdaArn,
                        "ResultPath": "$.iterator",
                        "Next": "IsCountReached"
                    },
                    "IsCountReached": {
                        "Type": "Choice",
                        "Choices": [
                            {
                                "Variable": "$.iterator.continue",
                                "BooleanEquals": true,
                                "Next": "Wait"
                            }
                        ],
                        "Default": "Done"
                    },
                    "Wait": {
                        "Type": "Wait",
                        "Seconds": 5,
                        "Next": "Iterator"
                    },
                    "Done": {
                        "Type": "Pass",
                        "End": true
                    }
                }
            })
        }).promise()

        console.log(Log.Color.Green, 'SUCCESS : Created Step Functions State Machine ', response)
        return response
    }
}

module.exports = StepFunction