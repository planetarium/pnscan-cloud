'use strict';
require('./setenv')()

const supertest = require('supertest');
const test = require('unit.js');
const app = require('../src/app.js');

const request = supertest(app);

describe('Blocks', function() {
  it('After', async function() {
    let {body:body1, status} = await request.get('/blocks?limit=5')
    let {body:body2} = await request.get('/blocks?limit=5&after='+body1.before)
    test.assert.equal(body1.blocks.length - 1, body2.blocks.length)
  });
  
  it('Latest & Paging', async function() {
    let before = ''
    for (let i = 0; i < 3; i++) {
      let limit = 20 + 10 * i
      let {body, status} = await request.get('/blocks?limit=' + limit + '&before=' + before)  
      test.assert.equal(body.blocks.length, limit)
      console.log(body.blocks.length, body.before)
      before = body.before
    }
  });
  
  it('Miner Latest & Paging', async function() {
    const miner = '0x3217f757064cd91caba40a8ef3851f4a9e5b4985'
    let before = ''
    for (let i = 0; i < 3; i++) {
      let limit = 20 + 10 * i
      let {body, status} = await request.get(`/blocks?miner=${miner}&limit=${limit}&before=${before}`)  
      console.log(body.blocks.length, body.before)
      test.assert.equal(body.blocks.length, limit)
      before = body.before
    }
  });
  
  it('Get Block', async function() {
    let {body:{blocks}, status} = await request.get('/blocks?limit=1')
    let block = blocks[0]
    console.time('READ BLOCK')
    let {body} = await request.get('/blocks/' + block.index)
    console.timeEnd('READ BLOCK')
    console.log('read block ', block.index)
    test.assert.equal(block.index, body.index)
  });
});


describe('Transactions', function() {
  it('Latest & Paging', async function() {
    let before = ''
    for (let i = 0; i < 3; i++) {
      let limit = 20 + 10 * i
      let {body, status} = await request.get('/transactions?limit=' + limit + '&before=' + before)  
      test.assert.equal(body.transactions.length, limit)
      console.log(body.transactions.length, body.before)
      before = body.before
      
      let tx = body.transactions[0]
      let {body: tx2} = await request.get('/transactions/' + tx.id)
      test.assert.equal(tx.id, tx2.id)
    }
  })

  it('Get Transactions by blockIndex', async function() {
    let {body:{blocks}, status} = await request.get('/blocks?limit=1')
    let block = blocks[0]
    console.log('Read txs', block.index, block.transactionCount)
    console.time('READ TXS')
    let {body} = await request.get('/blocks/' + block.index + '/transactions')
    test.assert.equal(block.transactionCount, body.length)
    console.timeEnd('READ TXS')
    
    let tx = body[0]
    
    for (let account of tx.updatedAddresses) {
      console.time('Involved Txs')
      let {body} = await request.get('/accounts/' + tx.signer + '/transactions')
      console.timeEnd('Involved Txs')
      console.log(body)
      console.log(body.length)
    }
  });
  
  it('Get Involved Transactions Paging', async function() {
    console.time('Involved Txs')
    let {body} = await request.get('/accounts/0x3217f757064cd91caba40a8ef3851f4a9e5b4985/transactions')
    console.timeEnd('Involved Txs')
    console.log(body)
    let {body:body2} = await request.get('/accounts/0x3217f757064cd91caba40a8ef3851f4a9e5b4985/transactions?before=' + body.before)
    console.log(body2)
  })
});


describe('Get Account', function() {
  it('Get Account', async function() {
    console.time('Account')
    let {body} = await request.get('/account?address=0xf34e121863614dd2ec5b0ae1bc03746921622b68')
    for (let account of body) {
      test.assert(account.avatarAddress)
    }
    let {body:body2} = await request.get('/account?address=0xf34e121863614dd2ec5b0ae1bc03746921622b61')
    console.timeEnd('Account')
    
    let avatarAddress = body[0].avatarAddress
    let {body: body3} = await request.get('/account?avatar=' + avatarAddress)
    test.assert.equal(body[0].address, body3[0].address)
    test.assert.equal(body[0].avatarAddress, body3[0].avatarAddress)
  })

  it('Refresh Account', async function() {
    let {body} = await request.post('/account/refresh?address=0xf34e121863614dd2ec5b0ae1bc03746921622b68')
    console.log(body)
  })
})

describe('Get Status', function() {
  it('Get Status', async function() {
    let {body} = await request.get('/status')
    console.log(body)
  })
})

describe('Get Price', function() {
  it('Get Price', async function() {
    let {body} = await request.get('/price')
    console.log(body)
  })
})