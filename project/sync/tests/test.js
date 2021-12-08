require('./setenv')()

const test = require("unit.js")
const { parseAction, JSONstringify } = require('../src/utils/utils')
const ncc = require("../src/datasource/ncc")
const dynamo = require("../src/repository/dynamo")

describe('Test Remote Access', function() {
    it('Test to work NCC Datasource', async function() {
        let {latestIndex} = await ncc.getLatestBlockIndex()
        test.assert(latestIndex > 0)
    })

    it('Test to work Dynamo repository', async function() {
        let lastIndex = await dynamo.getLastBlockIndex()
        test.assert(lastIndex > 0)
    })
})

describe('Test Utils', function() {
  it('Check parseAction', async function() {
      let data = {
          raw: '6475373a747970655f69647531333a6461696c795f7265776172643675363a76616c7565736475313a6132303abfec64ed042d8e427acbf529b1f33b8787e3853375323a696431363a07a1b52d76cdcc449549a77d1b60d3526565',
          inspection: '{\n' +
            '  "type_id": "daily_reward6",\n' +
            '  "values": {\n' +
            '    "a": b"\\xbf\\xec\\x64\\xed\\x04\\x2d\\x8e\\x42\\x7a\\xcb\\xf5\\x29\\xb1\\xf3\\x3b\\x87\\x87\\xe3\\x85\\x33",\n' +
            '    "id": b"\\x07\\xa1\\xb5\\x2d\\x76\\xcd\\xcc\\x44\\x95\\x49\\xa7\\x7d\\x1b\\x60\\xd3\\x52",\n' +
            '  },\n' +
            '}'
        }
      let {raw, inspection} = data
      test.assert.equal(JSONstringify(parseAction({raw})), JSONstringify(parseAction({inspection})))
  })
})
