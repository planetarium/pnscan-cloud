'use strict';
require('./setenv')()

const supertest = require('supertest');
const test = require('unit.js');

const app = require('../src/app.js');
const request = supertest(app);
describe('Dev', function() {
  it('Dev', async function() {
    let {body} = await request.get('/transactions?action=hack_and_slash9')
    console.log(body)
  })
})