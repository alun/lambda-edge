#!/usr/bin/env node

/**
 * Sets lambda association for AWS CloudFront edge events
 *
 * Environment variables:
 * AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION - aws credentials
 * LE_DISTRIBUTION_ID - cloud front distribution id
 * LE_EVENT_TYPE - labmda edge event, default viewer-request
                   see http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/eligible-cloudfront-events.html
 * LE_LAMBDA_ARN - ARN of a lambda function to set a handler
 */

const AWS = require('aws-sdk')
const child_process = require('child_process')

const cloudFront = new AWS.CloudFront()

const Id = process.env.LE_DISTRIBUTION_ID
const LambdaFunctionARN = process.env.LE_LAMBDA_ARN
const EventType = process.env.LE_EVENT_TYPE || 'viewer-request'

if (!Id) {
  console.error(`LE_DISTRIBUTION_ID env varibalbe must be specified`)
  process.exit(1)
}
if (!LambdaFunctionARN) {
  console.error(`LE_LAMBDA_ARN env varibalbe must be specified`)
  process.exit(1)
}

console.log(`Updating distribution ${Id}`)

const configPromise = new Promise((resolve, reject) => {
  cloudFront.getDistribution({Id}, (err, res) => {
    if (err) {
      reject(err)
    }
    else {
      const {ETag, Distribution} = res
      const {DistributionConfig} = Distribution
      resolve({ETag, DistributionConfig})
    }
  })
})

const updatePromise = configPromise.then(
  ({ETag, DistributionConfig}) => {
    const assocs = DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations
    const definition = assocs.Items.find((item) => item.EventType == EventType) || {}
    console.log('Current assocs: ' + JSON.stringify(assocs))
    Object.assign(definition, {
      LambdaFunctionARN,
    })
    if (!definition.EventType) {
      Object.assign(definition, {
        EventType,
      })
      assocs.Quantity += 1
      assocs.Items.push(definition)
    }
    console.log('New assocs: ' + JSON.stringify(assocs))
    return new Promise((resolve, reject) => {
      cloudFront.updateDistribution({
        Id,
        DistributionConfig,
        IfMatch: ETag,
      }, (err, res) => {
        if (err) {
          reject(err)
        }
        else {
          resolve()
        }
      })
    })
  }
)

updatePromise.then(() => {
  console.log(`Distribution ${Id} ${EventType} handler is set to ${LambdaFunctionARN}`)
}, (err) => {
  console.error(err);
})
