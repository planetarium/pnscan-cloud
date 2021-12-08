const AWS = require("aws-sdk");
const _ = require("underscore");
const {Semaphore} = require("async-mutex");

function prefix(name) {
    let prefix = process.env.tablePrefix
    if (prefix) {
        return `${prefix}.${name}`
    }
    return name
}

async function forEachSemaphore(items, fn, limit) {
    let sem = new Semaphore(limit)
    let promises = []
    for (let item of items) {
        promises.push(sem.runExclusive(async () => {
            return new Promise(async (resolve) => {
                try {
                    await fn(item)
                } catch(e) {
                    console.log(e)
                } finally {
                    resolve()
                }
            })
        }))
    }
    
    await Promise.all(promises)
}


const BLOCK_LIST_ATTRS = ["index", "hash", "difficulty", "miner", "nonce", "stateRootHash", "timestamp", "totalDifficulty", "transactionCount"]
const BLOCK_FULL_ATTRS = [...BLOCK_LIST_ATTRS, "transactions"]
let client
class Fetcher {
    constructor() {
        AWS.config.update({region: process.env.region});
        client = new AWS.DynamoDB.DocumentClient();
    }
    async getBlockByHash(hash) {
        let attrs = ["index", "hash"]
        return new Promise(async (resolve, reject) => { 
            let tryQuery = () => {
                return client.query({TableName: prefix("Block"),
                IndexName: "hash-index",
                KeyConditionExpression: "#hash = :hash",
                ProjectionExpression: attrs.map(a => '#' + a).join(', '),
                ExpressionAttributeNames  : attrs.map(a => {return {['#'+a]: a}}).reduce((a,b) => {return {...a,...b}}), 
                ExpressionAttributeValues: {':hash': hash}}).promise()
            }
            try {
                let data = await tryQuery()
                resolve(this.getBlockByIndexWithTxs(data['Items'][0]['index']))
            } catch(e) {
                //retry
                setTimeout(async () => {
                    try {
                        let data = await tryQuery()
                        resolve(this.getBlockByIndexWithTxs(data['Items'][0]['index']))
                    } catch(e) {
                        reject(e)
                    }
                }, 100)
            }
        
        })
    }
    
    async getBlockByIndexWithTxs(index) {
        return this.getBlockByIndex(index, BLOCK_FULL_ATTRS)
    }
    
    async getBlockByIndex(index, attrs = BLOCK_LIST_ATTRS) {
        return new Promise(async (resolve, reject) => { 
            let tryQuery = () => {
                return client.query({TableName: prefix("Block"),
                KeyConditionExpression: "#index = :index",
                ProjectionExpression: attrs.map(a => '#' + a).join(', '),
                ExpressionAttributeNames  : attrs.map(a => {return {['#'+a]: a}}).reduce((a,b) => {return {...a,...b}}), 
                ExpressionAttributeValues: {':index': index * 1}}).promise()
            }
            
            try {
                let data = await tryQuery()
                resolve(data['Items'][0])
            } catch(e) {
                //retry
                setTimeout(async () => {
                    try {
                        let data = await tryQuery()
                        resolve(data['Items'][0])
                    } catch(e) {
                        reject(e)
                    }
                }, 100)
            }
        
        })
    }
    
    async getBlocksByIndex(indexes) {
        let blocks = []
        
        await forEachSemaphore(indexes, async (index) => {
            let job = this.getBlockByIndex(index)
            blocks.push(job)
            await job
        }, 10)
        
        for (let i = 0; i < blocks.length; i++) {
            blocks[i] = await blocks[i]
        }
        
        return blocks
    }
    
    
    async getTransactionById(id) {
        return new Promise(async (resolve, reject) => { 
            try {
                let data = await client.query({TableName: prefix("Transaction"), KeyConditionExpression: "#id = :id", ExpressionAttributeNames  : {"#id": "id"}, ExpressionAttributeValues: {":id": id}}).promise()
                resolve(data['Items'][0])
            } catch(e) {
                //retry
                setTimeout(async () => {
                    try {
                        let data = await client.query({TableName: prefix("Transaction"), KeyConditionExpression: "#id = :id", ExpressionAttributeNames  : {"#id": "id"}, ExpressionAttributeValues: {":id": id}}).promise()
                        resolve(data['Items'][0])
                    } catch(e) {
                        reject(e)
                    }
                }, 100)
            }
        
        })
    }

    async saveTransaction(tx) {
        await client.put({
            TableName: prefix("Transaction"),
            Item: tx
        }).promise()
    }

    async saveAccount(accounts) {
        await forEachSemaphore(accounts, async (account) => {
            try {
                await client.put({
                    TableName: prefix("Account"),
                    Item: account,
                    ConditionExpression: "attribute_not_exists(refreshBlockIndex) OR refreshBlockIndex < :newIndex",
                    ExpressionAttributeValues: {
                        ":newIndex": account.refreshBlockIndex,
                    }
                }).promise()
            } catch(e) {
                if (e.code == 'ConditionalCheckFailedException') {
                    return
                }
                throw e
            }
        }, 50)
    }

    async getTransactionsByIds(ids) {
        let txs = []
        
        await forEachSemaphore(ids, async (id) => {
            let job = this.getTransactionById(id)
            txs.push(job)
            await job
        }, 10)
        
        for (let i = 0; i < txs.length; i++) {
            txs[i] = await txs[i]
        }
        
        return txs
    }
    
    async getBlocks({after = 0, before, miner, limit = 20}) {
        limit = Math.min(Math.max(limit, 1), 100)
        if (!after) {
            after = 0
        }
        
        console.log('GET BLOCKS')
        console.time('LIST FETCH')
        let param = {}
        
        if (miner) {
            miner = miner.toLowerCase()
            param = {
                TableName: prefix("Block"),
                IndexName: "miner-index",
                KeyConditionExpression: "#miner = :miner",
                ProjectionExpression: "#index",
                ExpressionAttributeNames  : {"#miner": "miner", "#index": "index"},
                ExpressionAttributeValues: {
                    ":miner": miner,
                },
                ScanIndexForward: false,
                Limit: limit
            }
            if (before) {
                param.ExclusiveStartKey = {
                    index: Number(before),
                    miner
                }
            }
        } else {
            param = {
                TableName: prefix("Block"),
                IndexName: "block-index",
                KeyConditionExpression: "#type = :type AND #index > :after",
                ProjectionExpression: "#index",
                ExpressionAttributeNames  : {"#type": "type", "#index": "index"},
                ExpressionAttributeValues: {
                    ":type": 'B',
                    ":after": Number(after)
                },
                ScanIndexForward: false,
                Limit: limit
            }
            
            if (before) {
                param.ExclusiveStartKey = {
                    index: Number(before),
                    type: 'B'
                }
            } else { // fetch from LatestBlocks table if 1 page request
                const attrs = BLOCK_LIST_ATTRS
                let {Items} = await client.query({
                    TableName: prefix("LatestBlocks"),
                    KeyConditionExpression: "#type = :type AND #index > :after",
                    ProjectionExpression: attrs.map(a => '#' + a).join(', '),
                    ExpressionAttributeNames  : {'#type':'type', ...attrs.map(a => {return {['#'+a]: a}}).reduce((a,b) => {return {...a,...b}})}, 
                    ExpressionAttributeValues: {
                        ":type": 'B',
                        ":after": Number(after)
                    },
                    ScanIndexForward: false,
                    Limit: limit
                }).promise()
                
                if (Items.length > 0) {
                    console.timeEnd('LIST FETCH')
                    return {
                        blocks: Items,
                        before: _.last(Items).index
                    }    
                }
            }
        }
        
        let {Items, LastEvaluatedKey} = await client.query(param).promise()
        console.timeEnd('LIST FETCH')
        console.log('LIST FOUND ', Items.length)
        
        console.time('BLOCKS FETCH')
        let blocks = await this.getBlocksByIndex(Items.map(item => item.index))
        console.timeEnd('BLOCKS FETCH')
        
        let response = {blocks}
        if (LastEvaluatedKey) {
            response['before'] = LastEvaluatedKey['index']
        }
        return response;
    }
    
    async getTransactionsByBlock(blockIndex) {
        let {Items} = await client.query({TableName: prefix("Block"),
            ProjectionExpression: 'transactions',
            KeyConditionExpression: "#index = :index", 
            ExpressionAttributeNames  : {"#index": "index"}, 
            ExpressionAttributeValues: {":index": blockIndex * 1}}).promise()
        
        if (Items[0] && Items[0].transactions && Items[0].transactions.length > 0) {
            return _.sortBy(Items[0].transactions, tx => -new Date(tx['timestamp']))
        }
        
        return []
    }
    
    async getLatestBlockIndex() {
        let {Items} = await client.query({
                TableName: prefix("Block"),
                IndexName: "block-index",
                KeyConditionExpression: "#type = :type",
                ProjectionExpression: "#index",
                ExpressionAttributeNames  : {"#type": "type", "#index": "index"},
                ExpressionAttributeValues: {
                    ":type": 'B'
                },
                ScanIndexForward: false,
                Limit: 1
            }).promise()
            
        return Items[0].index
    }
    
    async getTransactionsByActionType({action, before, limit = 20}) {
        let param = {
            TableName: prefix("Action"),
            IndexName: "typeId-index",
            KeyConditionExpression: "#typeId = :typeId",
            ProjectionExpression: "txIdSeq",
            ExpressionAttributeNames  : {"#typeId": "typeId"},
            ExpressionAttributeValues: {
                ":typeId": action
            },
            ScanIndexForward: false,
            Limit: limit
        }
        if (before) {
            let {Items} = await client.query({
                TableName: prefix("Action"),
                KeyConditionExpression: "#txIdSeq = :before",
                ProjectionExpression: "txIdSeq, #timestamp, typeId",
                ExpressionAttributeNames  : {"#txIdSeq": "txIdSeq", "#timestamp": "timestamp"},
                ExpressionAttributeValues: {
                    ":before": before
                }
            }).promise()
            
            if (Items && Items[0]) {
                param.ExclusiveStartKey = Items[0]
            }
        }
        
        let {Items, LastEvaluatedKey} = await client.query(param).promise()
        
        let response = {}
        let txIds = Items.map(item => item.txIdSeq.split('/')[0])
        
        let transactions = await this.getTransactionsByIds(txIds)
        
        response['transactions'] = transactions
        if (LastEvaluatedKey) {
            response['before'] = LastEvaluatedKey['txIdSeq']
        }
        
        return response
    }
    
    async getTransactions({before, limit = 20}) {
        let blockId, skip
        if (before) {
            let split = before.split('/')
            blockId = Number(split[0])
            if (split[1]) {
                skip = Number(split[1])
            } else {
                blockId -= 1
            }
        } else {
            blockId = await this.getLatestBlockIndex()
        }
        
        let transactions = []
        for (let i = 0; i < 20; i++) {
            let txs = await this.getTransactionsByBlock(blockId - i)
            if (i == 0 && skip) {
                txs = txs.slice(skip)
            }
            
            if (transactions.length + txs.length <= limit) {
                transactions.push(...txs)
                
                if (transactions.length == limit) {
                    return {
                        transactions,
                        before: blockId - i
                    }
                }
            } else {
                let _txs = txs.slice(0, limit - transactions.length)
                transactions.push(..._txs)
                if (i == 0 && skip) {
                    skip += _txs.length
                } else {
                    skip = _txs.length
                }
                return {
                    transactions,
                    before: (blockId - i) + '/' + skip
                }
            }
        }
        
        return {transactions, before: blockId - 20}
    }
    
    
    async getInvolvedTransactions({account, action, before, limit=20}) {
        let param = {
            TableName: prefix("AccountTransaction"),
            IndexName: "address-index",
            KeyConditionExpression: "address = :account",
            ExpressionAttributeValues: {
                ":account": account,
            },
            ScanIndexForward: false,
            Limit: limit
        }
        
        if (before) {
            param.ExclusiveStartKey = {
                blockIndex: Number(before.split('/')[0]),
                pk: before.split('/')[1],
                address: account
            }
        }
        
        if (action) {
            param = {
                TableName: prefix("AccountTransaction"),
                IndexName: "action-index",
                KeyConditionExpression: "addressWithType = :key",
                ExpressionAttributeValues: {
                    ":key": account + '#' + action,
                },
                ScanIndexForward: false,
                Limit: limit
            }
            
            if (before) {
                param.ExclusiveStartKey = {
                    blockIndex: Number(before.split('/')[0]),
                    pk: before.split('/')[1],
                    addressWithType: account + '#' + action
                }
            }
        }
        
        console.time('LIST FETCH')
        let {Items, LastEvaluatedKey} = await client.query(param).promise()
        console.timeEnd('LIST FETCH')
        console.log('LIST FOUND ', Items.length, LastEvaluatedKey)
        
        console.time('TXS FETCH')
        let transactions = await this.getTransactionsByIds(Items.map(item => item.txId))
        console.timeEnd('TXS FETCH')
        
        transactions.forEach(tx => {
            let item = Items.find(item => item.txId == tx.id)
            if (item) {
                tx['involved'] = {type: item['type'], updated: item['accountUpdated']}
            }
        })
        
        let response = {transactions}
        if (LastEvaluatedKey) {
            response['before'] = LastEvaluatedKey['blockIndex'] + '/' + LastEvaluatedKey['pk']
        }
        return response
    }
    
    async getAccountStatesByAvatar(avatarAddress) {
        let param = {
            TableName: prefix("Account"),
            IndexName: "avatar-index",
            KeyConditionExpression: "avatarAddress = :address",
            ExpressionAttributeValues: {
                ":address": avatarAddress,
            },
            ScanIndexForward: false,
            Limit: 1
        }
        
        let {Items} = await client.query(param).promise()
        console.log(Items)
        if (Items && Items[0] && Items[0].address) {
            return await this.getAccountStates(Items[0].address)
        }
        return null    
    }
    
    async getAccountStates(address) {
        let param = {
            TableName: prefix("Account"),
            KeyConditionExpression: "address = :address",
            ExpressionAttributeValues: {
                ":address": address,
            },
            ScanIndexForward: false,
            Limit: 100
        }
        
        let {Items} = await client.query(param).promise()
        return Items
    }
    
    async getCache(cacheKey) {
        let {Items} = await client.query({
            TableName: prefix("Cache"),
            KeyConditionExpression: "cacheKey = :cacheKey",
            ExpressionAttributeValues: {
                ":cacheKey": cacheKey,
            },
            Limit: 1
        }).promise()
        
        return Items && Items[0]
    }
    
    async setCache(cacheKey, data) {
        await client.put({
            TableName: prefix("Cache"),
            Item: {
                cacheKey,
                ...data
            }
        }).promise()
    }
}


module.exports = new Fetcher()