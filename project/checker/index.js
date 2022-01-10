const axios = require('axios')

async function notifySlack(text) {
    await axios({
        method: 'POST',
        url: process.env.notifySlackEndpoint,
        data: {text}
    })
}

async function isGapWarning() {
    let {data} = await axios.get('https://api.9cscan.com/status')
    if (data['syncGap'] > 50) {
        return data
    }

    return false
}
async function checkAndNotify() {
    let {data:blocks} = await axios.get('https://api.9cscan.com/blocks?limit=1')
    let delaySecond = (+new Date - new Date(blocks['blocks'][0].timestamp)) / 1000
    if (delaySecond > 600) {
        await notifySlack('9cscan.com blocks sync is delayed: ' + delaySecond + ' sec')
    }

    if (await isGapWarning() && await isGapWarning()) {
        let data = await isGapWarning()
        if (data) {
            await notifySlack(`9cscan.com node is delayed - nodeGap (${data['nodeGap']}) syncGap (${data['syncGap']} - ${delaySecond} sec)`)
        }
    }
}

exports.get = async function(event, context, callback) {
    await checkAndNotify()
    callback(null, {
        statusCode: 200,
        body: '{}',
        headers: {'content-type': 'application/json'}
    })
}

