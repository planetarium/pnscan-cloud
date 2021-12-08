exports.handler = function(event, context, callback) {
    callback(null, {
        statusCode: 200,
        body: '{"result":"ok"}',
        headers: {'content-type': 'application/json'}
    })
}

exports.get = function(event, context, callback) {
    let iteratorIndex = (event['iterator'] && event['iterator']['index'] || 0) + 5
    let iteratorCount = (event['iterator'] && event['iterator']['count'] || 1)

    callback(null, {
        statusCode: 200,
        body: '{"result":"ok"}',
        headers: {'content-type': 'application/json'},
        "index": iteratorIndex,
        "continue": iteratorIndex < iteratorCount,
        "count": iteratorCount
    })
}