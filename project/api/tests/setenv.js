const fs = require("fs")
const AWS = require("aws-sdk");


function loadRootConfig() {
    let config = {}
    try {
        config = JSON.parse(fs.readFileSync(__dirname + "/../../../.config"))
    } catch(e) {
        console.log(e)
    }
    return config
}

module.exports = function() {
    let config = loadRootConfig()
    AWS.config.update({region: config['region'], credentials: config['credentials']})
    for (let key of Object.keys(config)) {
        if (typeof config[key] == 'string' || typeof config[key] == 'number') {
            process.env[key] = config[key]
        } else {
            process.env[key] = JSON.stringify(config[key])
        }

    }
    process.env.region = config['region']
    if (config['namespace']) {
        let [a, ...b] = config['namespace']
        process.env.tablePrefix = a.toUpperCase() + b.join('')
    }

}