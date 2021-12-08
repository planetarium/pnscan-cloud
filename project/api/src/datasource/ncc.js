const axios = require("axios")

class NccDatasource {
  constructor() {
    this.endpoints = JSON.parse(process.env.graphqlEndpoints)
  }
  async getAccountState(address, endpointIndex=0) {
    let endpoint = this.endpoints[endpointIndex]
    try {
      let {data} = await axios.create({timeout: 10000})({
        method: 'POST',
        url: endpoint,
        data: {
          "variables":{"address": address},
          "query":`
          query getAgent($address: Address!) {
            goldBalance(address: $address)
            stateQuery {
              agent(address: $address) {
                avatarStates {
                  actionPoint,
                  address,
                  blockIndex,
                  characterId,
                  dailyRewardReceivedIndex,
                  ear,
                  exp
                  hair
                  lens
                  level
                  name
                  rankingMapAddress
                  tail
                  updatedAt
                }
              }
            }
          }
          `
        }
      })

      let goldBalance = data['data']['goldBalance']
      let agent = data['data']['stateQuery']['agent']
      let rows = []
      if (agent) {
        for (let avatar of agent['avatarStates']) {
          rows.push({
            address: address.toLowerCase(),
            avatarAddress: avatar && avatar.address && avatar.address.toLowerCase(),
            avatar,
            goldBalance,
          })
        }
      } else {
        //no avatar address
        rows.push({
          address: address.toLocaleLowerCase(),
          avatarAddress: 'NOAVATAR',
          goldBalance
        })
      }

      return rows
    } catch(e) {
    }
  }

  async getLatestEndpointIndex(lastBlockIndex = 0) {
    let response = {}
    for (let endpointIndex = 0; endpointIndex < this.endpoints.length; endpointIndex++) {
      try {
        let latestIndex = await this.getLatestBlockIndex(endpointIndex)
        if (latestIndex) {
          response = {latestIndex, endpointIndex}
          if (lastBlockIndex < latestIndex || (endpointIndex + 1) == this.endpoints.length) {
            return response
          }
        }
      } catch (e) {
        console.log(e)
      }
    }

    return response
  }
  async getLatestBlockIndex(endpointIndex = 0, timeout = 10000) {
    let endpoint = this.endpoints[endpointIndex]
    try {
      let {data} = await axios.create({timeout})({
        method: 'POST',
        url: endpoint,
        data: {
          "variables":{"offset": 0},
          "query":`
        query getBlock($offset: Int!) {
          chainQuery {
            blockQuery {
              blocks(offset: $offset, limit: 1, desc:true) {
                index
              }
            }
          }
        }
        `
        }
      })
      let latestIndex = data['data']['chainQuery']['blockQuery']['blocks'][0]['index']
      return latestIndex
    } catch (e) {
      console.log(e)
    }

    return null
  }

  async fetchBlock(index, endpointIndex = 0) {
    try {
      let endpoint = this.endpoints[endpointIndex]
      console.time('Fetch Block ' + index)
      let {data} = await axios({
        method: 'POST',
        url: endpoint,
        data: {
          "variables":{"index":index},
          "query":`
        query getBlock($index: ID!) {
          chainQuery {
            blockQuery {
              block(index:$index) {
                difficulty
                index
                hash
                miner
                nonce
                stateRootHash
                timestamp
                totalDifficulty
                transactions {
                  actions {
                    raw
                    inspection
                  }
                  id
                  nonce
                  publicKey
                  signature
                  signer
                  timestamp
                  updatedAddresses
                }
              }
            }
          }
        }
        `
        }
      })

      console.timeEnd('Fetch Block ' + index)
      return data['data']['chainQuery']['blockQuery']['block']
    } catch(e) {
      console.log(e)
    }
    return null
  }

  async getTxStatus(txId, endpointIndex = 0) {
    try {
      let endpoint = this.endpoints[endpointIndex]
      let {data} = await axios({
        method: 'POST',
        url: endpoint,
        data: {
          "variables":{"txId":txId},
          "query":`
            query query($txId: TxId!) {
              transaction {
                transactionResult(txId: $txId) {
                  txStatus
                }
              }
            }`
        }
      })
      return data['data']['transaction']['transactionResult']['txStatus']
    } catch(e) {
      console.log(e)
    }
    return null
  }
}

module.exports = new NccDatasource()