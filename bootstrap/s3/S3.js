const AWS = require("aws-sdk")
const Log = require("../Log")

class S3 {
    constructor(config) {
        this.config = config
        this.s3 = new AWS.S3({apiVersion: '2006-03-01', ...config})
    }

    async createStaticWebBucket(name) {
        await this.s3.createBucket({Bucket: name}).promise()
        await this.s3.putBucketWebsite({
            Bucket: name,
            WebsiteConfiguration: {
                ErrorDocument: {Key: 'index.html'},
                IndexDocument: {Suffix: 'index.html'}
            }
        }).promise()
        await this.s3.putBucketPolicy({
            Bucket: name,
            Policy: JSON.stringify({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "PublicReadGetObject",
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": "s3:GetObject",
                        "Resource": `arn:aws:s3:::${name}/*`
                    }
                ]
            })
        }).promise()
        let result = await this.s3.upload({
            Bucket: name,
            Key: 'index.html',
            Body: '<html><body>Hello S3 Static Web</body></html>',
            ContentType: 'text/html'
        }).promise()
        let webEndpoint = `http://${name}.s3-website.${this.config.region}.amazonaws.com`
        console.log(Log.Color.Green, 'SUCCESS : ' + webEndpoint)
        return {
            webBucketName: name,
            webEndpoint
        }
    }
}

module.exports = S3