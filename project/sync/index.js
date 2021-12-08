const Sync = require("./src/sync")

exports.get = async function(event, context, callback) {
  let response = await Sync.syncAuto()

  let elapsedSec = Math.ceil(response.elapsed/1000)
  let sleepSec = 5
  let iteratorIndex = (event['iterator'] && event['iterator']['index'] || 0) + elapsedSec + sleepSec
  let iteratorCount = (event['iterator'] && event['iterator']['count'] || 1)
  
  callback(null, {
    statusCode: 200,
    body: JSON.stringify(response),
    headers: {'content-type': 'content/json'},
    "index": iteratorIndex,
    "continue": iteratorIndex < iteratorCount,
    "count": iteratorCount
  });
};