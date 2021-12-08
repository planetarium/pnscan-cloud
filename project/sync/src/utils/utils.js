const { Semaphore } = require("async-mutex")
const bencodex = require("bencodex")

function parseInspection(inspection) {
    let v;
    try {
        v = inspection.replace(/\,(?!\s*?[\{\[\"\'\w])/g, '').replace(/[\n\r]/gi, '')
                            .replace(/b"([\\x0-9a-fA-F]+?)"/g, function(_, v) { return '"0x' + v.replace(/\\x/g, '') + '"' })
        return JSON.parse(v)
    } catch(e) {
        console.log('parseInspection error', inspection, v)
        throw e
    }
}

function parseRaw(raw) {
    let decoded = bencodex.decode(Buffer.from(raw, 'hex'))
    const parse = (v) => {
        if (v instanceof Array) {
            return parseArray(v)
        } else if (v instanceof Map) {
            return parseMap(v)
        } else if (v instanceof Buffer) {
            return "0x" + v.toString('hex')
        } else {
            return v
        }
    }
    
    const parseMap = (map) => {
        let _map = {}
        map.forEach((v, k) => {
            _map[k] = parse(v)
        })
        return _map
    }
    const parseArray = (arr) => {
        return arr.map(a => {
            return parse(a)
        })
    }
    return parseMap(decoded)
}

exports.parseAction = function parseAction(action) {
    if (action['raw']) {
        try {
            return parseRaw(action['raw'])
        } catch(e) {
            if (action['inspection']) {
                return parseInspection(action['inspection'])
            }
        }
    } else if (action['inspection']) {
        return parseInspection(action['inspection'])
    }
}

exports.forEachSemaphore = async function forEachSemaphore(items, fn, limit) {
    let sem = new Semaphore(limit)
    let promises = []
    for (let item of items) {
        promises.push(sem.runExclusive(async () => {
            return new Promise(async (resolve) => {
                try {
                    await fn(item)
                } catch(e) {
                    console.log(e)
                    throw e
                } finally {
                    resolve()
                }
            })
        }))
    }
    
    await Promise.all(promises)
}

exports.JSONstringify = function JSONstringify(json) {
    return JSON.stringify(json, (key, value) =>
            typeof value === 'bigint'
                ? Number(value.toString())
                : value
        )
}