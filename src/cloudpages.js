'use strict';

const YError = require('yerror');
const path = require('path');

/* Architecture Note #1.1: The `last` Option

The `last` option indicates how many versions should be
 kept in the cloud in order to smoothly change frontends
 avoiding users to face 404 errors if they still rely
 on an old frontend.
*/
const DEFAULT_LAST = 4;

/* Architecture Note #1.2: The `delay` Option

You can also specify a `delay` option indicating a delay
 for which versions should be kept anyway (in ms).

It default to a month and should be set to 0 to disable it.
*/
const DEFAULT_DELAY = 30 * 24 * 60 * 60 * 1000;

module.exports = initCloudPages;

/* Architecture Note #1: The `cloudPages` Service

The `cloudPages` service allows to deploy a new frontend version
 to the cloud by managing the number of prior versions to keep
 so that you won't have to manually check which version to keep
 and waste resources by forgoting to remove them.

This service needs some other services. To be able to mock and
 interchange them, we use
 [Knifecycle](https://github.com/nfroidure/knifecycle) for its
 dependency injection and inversion of control feature.

![Dependencies Graph](./DEPENDENCIES.mmd.png)
*/

/**
 * Declare `cloudPages` in the dependency injection system
 * and allow to change its name/dependencies
 * @param  {Knifecycle} $                  The knifecycle instance
 * @param  {String} [name='cloudPages']        The name of the service
 * @param  {Array}  [dependencies=['ENV', 'glob', 'fs', 'log', 's3', 'mime', 'git']]
 * The dependencies to inject
 * @returns {undefined}
 */
function initCloudPages(
  $,
  name = 'cloudPages',
  dependencies = ['ENV', 'glob', 'fs', 'log', 's3', 'mime', 'git', 'time']
) {
  $.service(name,
    $.depends(dependencies,
      services => Promise.resolve(cloudPages.bind(null, services))
    )
  );
}

/**
 * Deploy pages to the cloud and optionnally remove old versions
 * @param {Object}   services        Services (provided by the dependency injector)
 * @param {Object}   services.ENV    Environment service
 * @param {Function} services.glob   Globbing service
 * @param {Object}   services.fs     File system service
 * @param {Function} services.log    Logging service
 * @param {Object}   services.s3     S3 bucket service
 * @param {Object}   services.mime   MIME mapping service
 * @param {Object}   services.git    Repository service
 * @param {Function} services.time   Time service
 * @param {Object}   options         Options (destructured)
 * @param {Number}   options.last    Number of prior versions to keep
 * @param {Number}   options.delay   Delay for keeping prior versions
 * @param {String}   options.dir     Directory that contains assets to deploy
 * @param {String}   options.gitDir  Directory of the git repository to look for versions
 * @param {String}   options.files   Pattern of files to deploy in the directory
 * @param {String}   options.ignore  Pattern of files to ignore in the directory
 * @param {Boolean}  options.remove  Boolean indicating if ld versions should be removed
 * @param {String}   options.version Version for the current deployment
 * @param {String}   options.bucket  Targetted bucket
 * @return {Promise}                 A promise to be resolved when the deployment ended
 */
function cloudPages({
  ENV, glob, fs, log, s3, mime, git, time,
}, {
  delay = DEFAULT_DELAY,
  last = DEFAULT_LAST,
  dir,
  gitDir,
  files = '**/*',
  ignore = '.git/**/*',
  version,
  remove = false,
  bucket,
} = {}) {
  return Promise.resolve()
  .then(() => {
    if('string' !== typeof version) {
      throw new YError('E_VERSION_REQUIRED', typeof version, version);
    }
    if('string' !== typeof dir) {
      throw new YError('E_DIR_REQUIRED', typeof dir, dir);
    }
    bucket = bucket || ENV.AWS_S3_BUCKET;
    if('string' !== typeof bucket) {
      throw new YError('E_BUCKET_REQUIRED', typeof bucket, bucket);
    }
  })
  .then(() => {
    const pattern = path.join(dir, files);

    gitDir = gitDir || dir;

    log('info', 'Deploying ' + version);

    return glob(pattern, {
      dir,
      ignore: path.join(dir, ignore),
      dot: true,
      nodir: true,
      absolute: true,
    })
    .catch((err) => {
      log('error', 'Directory scan failure:', pattern);
      log('stack', 'Stack:', err.stack);
      throw YError.wrap(err, 'E_SCAN_FAILURE', pattern);
    })
    .then((files) => {
      log('debug', 'Succesfully scanned files', pattern);
      log('debug', 'Files:', files);
      if(0 === files.length) {
        throw new YError('E_NO_FILES', pattern);
      }
      return files;
    });
  })
  .then(files => Promise.resolve(files.map(
    (file) => {
      const key = path.join(version, path.relative(dir, file));

      return Promise.resolve()
      .then(() => {

        log('debug', 'Sending file:', file, key);
        return s3.putObjectAsync({
          Bucket: bucket,
          ACL: 'public-read',
          Key: key,
          Body: fs.createReadStream(file),
          ContentType: mime.lookup(file),
        })
        .then(() => {
          log('debug', 'File sent:', file, key);
        });
      })
      .catch((err) => {
        throw YError.wrap(err, 'E_S3_UPLOAD_ERROR', file, key);
      });
    }
  )))
  .then(() => {
    log('debug', 'Setting up the bucket ACLs.');
    return s3.putBucketAclAsync({
      Bucket: bucket,
      ACL: 'public-read',
    })
    .then(() => {
      log('debug', 'Bucket ACLs set.');
    });
  })
  .then(() => {
    log('debug', 'Setting up the website rules.');
    return s3.putBucketWebsiteAsync({
      Bucket: bucket,
      WebsiteConfiguration: {
        ErrorDocument: {
          Key: version + '/index.html',
        },
        IndexDocument: {
          Suffix: 'index.html',
        },
        // Always redirect to the current version
        RoutingRules: [{
          Redirect: {
            ReplaceKeyWith: version + '/index.html',
          },
          Condition: {
            KeyPrefixEquals: '/index.html',
          },
        }],
      },
    })
    .then(() => {
      log('debug', 'Website rules set.');
    });
  })
  .then(() => {
    log('info', 'Successfully deployed ' + version);

    if(!remove) {
      return Promise.resolve();
    }

    log('info', 'Seeking for old versions to remove.');
    const now = time();
    return git.getCommits(gitDir)
    .then((commits) => {
      const versionsToRemove = commits.filter((commit, i) => {
        if(
          version !== commit.tag &&
          i + 1 > last &&
          commit.time < now - delay
        ) {
          return true;
        }
        return false;
      });

      log('debug', 'Found ' + versionsToRemove.length + ' versions to potentially remove.');

      return Promise.all(
        versionsToRemove.map(_recursivelyDeleteVersionObjects.bind(null, { ENV, log, s3 }, bucket))
      );
    });
  });
}

function _recursivelyDeleteVersionObjects({ log, s3 }, bucket, commit, changed = false) {
  log('debug', 'Listing objects for version "' + commit.tag + '"');
  return s3.listObjectsAsync({
    Bucket: bucket,
    Prefix: commit.tag + '/',
  })
  .then((objects) => {
    if(!objects.Contents.length) {
      log('info', 'No objects found for version "' + commit.tag + '"');
      return Promise.resolve();
    }
    log('info', 'Removing objects for version "' + commit.tag + '"');
    log('debug', 'Files ', objects);
    return s3.deleteObjectsAsync({
      Bucket: bucket,
      Delete: {
        Objects: objects.Contents.map(({ Key }) => ({ Key })),
      },
    })
    .then(() => {
      if(objects.MaxKeys === objects.KeyCount) {
        return _recursivelyDeleteVersionObjects({ log, s3 }, bucket, commit, true);
      }
      return Promise.resolve();
    });
  });
}
