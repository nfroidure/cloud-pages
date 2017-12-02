'use strict';

const AWSS3 = require('aws-sdk/clients/s3');
const debug = require('debug')('s3');
const Promise = require('bluebird');

const DEFAULT_NAME = 's3';
const DEFAULT_DEPENDENCIES = ['ENV', 'log'];

module.exports = initS3Service;

function initS3Service(
  $,
  name = DEFAULT_NAME,
  dependencies = DEFAULT_DEPENDENCIES
) {
  $.service(name, $.depends(dependencies, s3Service));
}

function s3Service({ ENV, log }) {
  return Promise.resolve().then(() => {
    const s3 = new AWSS3({
      region: ENV.AWS_S3_REGION || ENV.AWS_REGION,
      accessKeyId: ENV.AWS_S3_ACCESS_KEY_ID || ENV.AWS_ACCESS_KEY_ID,
      secretAccessKey:
        ENV.AWS_S3_SECRET_ACCESS_KEY || ENV.AWS_SECRET_ACCESS_KEY,
      logger: { log: debug },
    });

    log('debug', 'S3 Service initialized.');

    return Promise.resolve({
      listObjectsAsync: (...args) =>
        new Promise((resolve, reject) => {
          s3.listObjectsV2(...args, (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          });
        }),
      deleteObjectsAsync: (...args) =>
        new Promise((resolve, reject) => {
          s3.deleteObjects(...args, (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          });
        }),
      createBucketAsync: (...args) =>
        new Promise((resolve, reject) => {
          s3.createBucket(...args, (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          });
        }),
      putObjectAsync: (...args) =>
        new Promise((resolve, reject) => {
          s3.putObject(...args, (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          });
        }),
      putBucketAclAsync: (...args) =>
        new Promise((resolve, reject) => {
          s3.putBucketAcl(...args, (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          });
        }),
      putBucketWebsiteAsync: (...args) =>
        new Promise((resolve, reject) => {
          s3.putBucketWebsite(...args, (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          });
        }),
    });
  });
}
