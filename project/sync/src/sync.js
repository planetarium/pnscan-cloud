const { Semaphore } = require("async-mutex")
const { forEachSemaphore } = require("./utils/utils")
const _ = require("underscore")
const ncc = require("./datasource/ncc")
const dynamo = require("./repository/dynamo")

class Sync {
    async fetchBlocksAsync(endpointIndex, blocks, lastIndex, loopSize) {
        let sem = new Semaphore(8)
        for (let i = 0; i < loopSize; i++) {
            const [value, release] = await sem.acquire();
            try {
                let idx = lastIndex + 1 + i
                console.log('FETCH START', idx)
                blocks[idx] = {fetch: ncc.fetchBlock(idx, endpointIndex), release}
            } catch(e) {}
        }
    }

    async fetchAccounts(endpointIndex, block, containUpdatedAddress = true) {
        let addresses = []
        let accountStates = []
        if (block.miner) {
            addresses.push(block.miner)
        }
        addresses.push(...block.transactions.map(t => t.signer))
        if (containUpdatedAddress) {
            addresses.push(..._.flatten(block.transactions.map(t => t.updatedAddresses)))
        }

        addresses = _.uniq(addresses)
        console.log('fetch Account', addresses.length)
        console.time('fetch Account')
        await forEachSemaphore(addresses, async (addr) => {
            let states = await ncc.getAccountState(addr, endpointIndex)
            if (states) {
                accountStates.push(...states)
            }
        }, 32)
        accountStates.forEach(state => state.refreshBlockIndex = block.index)
        console.timeEnd('fetch Account')
        return accountStates
    }

    async syncBlock(block, endpointIndex = 0, isLatestSync = true) {
        let accounts = await this.fetchAccounts(endpointIndex, block, isLatestSync)
        await dynamo.saveAccount(accounts)
        await dynamo.save(block)
        if (isLatestSync) {
            await dynamo.saveLatestBlock(block)
        }
    }

    async syncAuto() {
        let response = {elapsed: 0, blocks: []}

        let ts = +new Date

        try {
            console.log('\n\nBegin NewBlocks')

            let lastIndex = await dynamo.getLastBlockIndex()
            const {latestIndex, endpointIndex} = await ncc.getLatestBlockIndex(lastIndex)

            if (lastIndex == -1) {
                lastIndex = latestIndex - 1 //first run
            }

            const loopSize = Math.min(latestIndex - lastIndex, 60)

            console.log('latest %d : last %d', latestIndex, lastIndex)
            console.log('NEXT BLOCK INDEX', lastIndex + 1)
            let blocks = {}

            this.fetchBlocksAsync(endpointIndex, blocks, lastIndex, loopSize)
            await new Promise(resolve => setTimeout(resolve, 100))

            for (let i = 0; i < loopSize; i++) {
                let idx = lastIndex + 1 + i
                let block = await blocks[idx].fetch
                if (block) {
                    blocks[idx].release()
                    console.log('START NEW BLOCK', block.index)
                    console.time('NewBlock Elapsed')

                    await this.syncBlock(block, endpointIndex)

                    console.timeEnd('NewBlock Elapsed')

                    if (new Date - ts > 60000) {
                        break;
                    }

                    response.blocks.push({blockIndex: block.index})
                } else {
                    break
                }
            }
        } catch(e) {
            console.log(e)
        }

        response['elapsed'] = new Date - ts
        return response
    }
}

module.exports = new Sync()