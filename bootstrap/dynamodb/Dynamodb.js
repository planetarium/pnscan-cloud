const AWS = require("aws-sdk")
const Log = require("../Log")
const fs = require("fs")
const path = require("path")

class Dynamodb {
    constructor(config) {
        this.config = config
        this.client = new AWS.DynamoDB(config)
    }
    getPrefix() {
        if (this.config.namespace && this.config.namespace.length > 0) {
            let [a, ...b] = this.config.namespace
            return a.toUpperCase() + b.join('')
        }
        return ''
    }
    prefixName(name) {
        let prefix = this.getPrefix()
        if (prefix) {
            return `${prefix}.${name}`
        }
        return name
    }
    async describeTable(name) {
        name = this.prefixName(name)
        return this.client.describeTable({
            TableName: name
        }).promise()
    }
    async createTable(name) {
        let pName = this.prefixName(name)
        console.log('Dynamodb : create table ' + pName)
        try {
            let table = JSON.parse(fs.readFileSync(`${path.dirname(__filename)}/table/${name}.json`))
            table['TableName'] = pName
            let {TableDescription:result} = await this.client.createTable(table).promise()
            console.log(Log.Color.Green, 'SUCCESS : ' + result['TableName'] + ' : ' + result['TableArn'])
        } catch(e) {
            console.error(Log.Color.Red, 'ERROR : ' + e.message)
        }
    }

    async createTables() {
        await this.createTable('Account')
        await this.createTable('AccountTransaction')
        await this.createTable('Action')
        await this.createTable('Block')
        await this.createTable('Cache')
        await this.createTable('LatestBlocks')
        await this.createTable('Transaction')
        await this.createTable('WebsocketConnection')
    }
}

module.exports = Dynamodb