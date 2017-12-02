'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Knifecycle = require('knifecycle').default;
const initCloudPages = require('./cloudpages');
const YError = require('yerror');

describe('cloudPages', () => {
  const TEST_BASE_TIME = new Date('2010-03-06T00:00:00Z').getTime();
  let $;

  beforeEach(() => {
    $ = new Knifecycle();
    $.constant('ENV', {});
    $.constant('glob', sinon.stub());
    $.constant('time', sinon.stub().returns(TEST_BASE_TIME));
    $.constant('fs', {
      createReadStream: sinon.stub(),
    });
    $.constant('mime', {
      lookup: sinon.stub(),
    });
    $.constant('git', {
      getCommits: sinon.stub(),
    });
    $.constant('s3', {
      putObjectAsync: sinon.stub(),
      putBucketWebsiteAsync: sinon.stub(),
      putBucketAclAsync: sinon.stub(),
    });
    $.constant('log', sinon.stub());
    initCloudPages($);
  });

  it('should init well', () =>
    $.run(['cloudPages']).then(({ cloudPages }) => {
      assert.equal(typeof cloudPages, 'function');
    }));

  it('should fail with no version', () =>
    $.run(['ENV', 'cloudPages']).then(({ ENV, cloudPages }) => {
      ENV.AWS_S3_BUCKET = 'lol';
      return cloudPages()
        .then(() => {
          throw new YError('E_NOT_SUPPOSED_TO_BE_HERE');
        })
        .catch(err => {
          assert.equal(err.code, 'E_VERSION_REQUIRED');
        });
    }));

  it('should fail with no dir', () =>
    $.run(['ENV', 'cloudPages']).then(({ ENV, cloudPages }) => {
      ENV.AWS_S3_BUCKET = 'lol';
      return cloudPages({
        version: '1.0.0',
      })
        .then(() => {
          throw new YError('E_NOT_SUPPOSED_TO_BE_HERE');
        })
        .catch(err => {
          assert.equal(err.code, 'E_DIR_REQUIRED');
        });
    }));

  it('should fail with no files found', () =>
    $.run(['ENV', 'cloudPages', 'glob']).then(({ ENV, cloudPages, glob }) => {
      ENV.AWS_S3_BUCKET = 'lol';
      glob.returns(Promise.resolve([]));
      return cloudPages({
        version: '1.0.0',
        dir: '../www',
      })
        .then(() => {
          throw new YError('E_NOT_SUPPOSED_TO_BE_HERE');
        })
        .catch(err => {
          assert.equal(err.code, 'E_NO_FILES');
        })
        .then(() => {
          assert.deepEqual(glob.args, [
            [
              '../www/**/*',
              {
                absolute: true,
                dir: '../www',
                dot: true,
                ignore: '../www/.git/**/*',
                nodir: true,
              },
            ],
          ]);
        });
    }));

  it('should work with a file found', () =>
    $.run(['ENV', 'cloudPages', 'glob', 'git', 's3', 'fs', 'mime']).then(
      ({ ENV, cloudPages, glob, git, s3, fs, mime }) => {
        const SIX_DAYS = 6 * 24 * 60 * 60 * 1000;

        ENV.AWS_S3_BUCKET = 'lol';
        glob.returns(Promise.resolve(['./index.html']));
        s3.putObjectAsync.returns(Promise.resolve());
        s3.putBucketAclAsync.returns(Promise.resolve());
        s3.putBucketWebsiteAsync.returns(Promise.resolve());
        fs.createReadStream.returns('read-stream');
        mime.lookup.returns('text/plain');
        git.getCommits.returns(
          Promise.resolve([
            {
              tag: 'v3.0.1',
              hash: '1fb2cd74a2f3957263d57de06962d19045769890',
              time: TEST_BASE_TIME - SIX_DAYS / 4,
              message: '3.0.0 (tag: v3.0.0)',
            },
            {
              tag: 'v3.0.0',
              hash: '1fb2cd74a2f3957263d57de06962d19045769890',
              time: TEST_BASE_TIME - SIX_DAYS / 3,
              message: '3.0.0 (tag: v3.0.0)',
            },
            {
              tag: 'v2.0.0',
              hash: '1fb2cd74a2f3957263d57de06962d19045769890',
              time: TEST_BASE_TIME - SIX_DAYS / 2,
              message: '3.0.0 (tag: v3.0.0)',
            },
            {
              tag: 'v2.0.0',
              hash: '1fb2cd74a2f3957263d57de06962d19045769890',
              time: TEST_BASE_TIME - SIX_DAYS * 2,
              message: '3.0.0 (tag: v3.0.0)',
            },
          ])
        );
        return cloudPages({
          keep: {
            last: 1,
            delay: SIX_DAYS,
          },
          dir: './dist',
          gitDir: '.',
          files: '**/*',
          ignore: 'node_modules/**/*',
          version: '1.0.0',
        }).then(() => {
          assert.deepEqual(glob.args, [
            [
              'dist/**/*',
              {
                absolute: true,
                dir: './dist',
                dot: true,
                ignore: 'dist/node_modules/**/*',
                nodir: true,
              },
            ],
          ]);
          assert.deepEqual(s3.putObjectAsync.args, [
            [
              {
                ACL: 'public-read',
                Body: 'read-stream',
                Bucket: 'lol',
                ContentType: 'text/plain',
                Key: 'index.html',
              },
            ],
          ]);
          assert.deepEqual(s3.putBucketAclAsync.args, [
            [
              {
                ACL: 'public-read',
                Bucket: 'lol',
              },
            ],
          ]);
          assert.deepEqual(s3.putBucketWebsiteAsync.args, [
            [
              {
                Bucket: 'lol',
                WebsiteConfiguration: {
                  ErrorDocument: {
                    Key: '1.0.0/index.html',
                  },
                  IndexDocument: {
                    Suffix: 'index.html',
                  },
                  RoutingRules: [
                    {
                      Condition: {
                        KeyPrefixEquals: '/index.html',
                      },
                      Redirect: {
                        ReplaceKeyWith: '1.0.0/index.html',
                      },
                    },
                  ],
                },
              },
            ],
          ]);
        });
      }
    ));
});
