const AWS = require("aws-sdk")
const Log = require("../Log")
const fs = require("fs")
const path = require("path")

function last(arr) {
    return arr[arr.length - 1]
}

class EventBridge {
    constructor(config) {
        this.config = config
        this.client = new AWS.EventBridge(config)
    }

    async createEventRule(name, targetArn, schedule="rate(1 minute)") {
        let rule = await this.client.putRule({
            Name: name,
            State: "ENABLED",
            ScheduleExpression: schedule
        }).promise()

        let target = {
            Id: last(targetArn.split(':')),
            Arn: targetArn
        }
        if (targetArn.indexOf(':lambda:') == -1) {
            target['RoleArn'] =  this.config.iamRoleArn
        }

        await this.client.putTargets({
            Rule: name,
            Targets: [target]
        }).promise()
        console.log(Log.Color.Green, 'SUCCESS : Created Event Bridge ', rule)
    }
}

module.exports = EventBridge