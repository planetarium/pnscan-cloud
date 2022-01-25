// AWS Lambda do not support ESM
require("./tests/setenv")()
const ncc = require("./src/datasource/ncc")
const Sync = require("./src/sync")
const {Semaphore} = require("async-mutex")
const fs = require("fs")
const {fail} = require("unit.js/src/helpers");

let startIndex = 3155972
const endIndex = 4252276
const FILENAME = '.manually.json'
try {
    let data = JSON.parse(fs.readFileSync(FILENAME, 'utf8'))
    if (data['lastIndex']) {
        startIndex = data['lastIndex']
    }
} catch(e) {}

;(async () => {
    let endpointIndex = 0
    let ts = +new Date
    let i = startIndex
    let failedCount = 0
    while(i < endIndex) {
        try {
            console.clear()
            let block = await ncc.fetchBlock(i, endpointIndex)
            if (block.index) {
                let elapsed = new Date - ts
                let msPerBlock = i > startIndex ? elapsed / (i - startIndex) : 0

                console.log(`sync block ${block.index}`, `${msPerBlock.toFixed()}ms/block`, `${(msPerBlock * (endIndex - i)).toFixed()} ms left`)
                await Sync.syncBlock(block, endpointIndex, true)
                fs.writeFileSync(FILENAME, `{"lastIndex":${block.index}}`)
                i += 1
                failedCount = 0
            } else {
                throw 'error'
            }
        } catch(e) {
            console.log(e)
            failedCount += 1
            await new Promise(resolve => setTimeout(resolve, 1000 * failedCount * failedCount))
        }
    }
})()