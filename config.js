const fs = require("fs")
let config
try {
    config = JSON.parse(fs.readFileSync(__dirname + "/.config"))
} catch(e) {
    console.log(e)
    throw `Cannot read file .config`
}
exports.config = config

exports.loadDeployResult = function() {
    return JSON.parse(fs.readFileSync(__dirname + "/.deploy"))
}

exports.exportDeployResult = function(key, value) {
    let file = __dirname + "/.deploy"
    let deploy
    if (!fs.existsSync(file)) {
        deploy = {}
    } else {
        deploy = JSON.parse(fs.readFileSync(file))
    }

    deploy[key] = value
    fs.writeFileSync(file, JSON.stringify(deploy, null, 2))
}