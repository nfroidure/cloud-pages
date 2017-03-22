#! /usr/bin/env node

/* Architecture Note #2: CLI

The `cloud-pages` CLI tool basically wraps the cloudPages service
to make it usable from the CLI.

To see its options, run:
```
cloudpages -h
```
*/

'use strict';

const Knifecycle = require('knifecycle').default;
const debug = require('debug')('cloudpages');
const fs = require('fs');
const mime = require('mime');
const path = require('path');
const glob = require('glob');
const program = require('commander');
const Promise = require('bluebird');

const initGit = require('../src/git');
const initS3 = require('../src/s3');
const initCloudPages = require('../src/cloudpages');
const packageConf = require(path.join(__dirname, '..', 'package.json'));

const $ = new Knifecycle();

$.constant('ENV', process.env);
$.constant('mime', mime);
$.constant('time', Date.now.bind(Date));
$.constant('fs', Promise.promisifyAll(fs));
$.constant('glob', Promise.promisify(glob));
$.constant('log', (type, ...args) => {
  if('debug' === type || 'stack' === type) {
    debug(...args);
    return;
  }
  console[type](...args); // eslint-disable-line
});

initGit($);
initS3($);
initCloudPages($);

program
  .version(packageConf.version)
  .option('-r, --repository [value]', 'Repository root directory')
  .option('-d, --dir [value]', 'Directory to deploy')
  .option('-b, --bucket [value]', 'Target bucket')
  .option('-rm, --remove', 'Remove old versions')
  .option('-c, --create', 'Create the bucket before deploying')
  .option('-D, --delay [value]', 'Validity delay of old versions')
  .option('-l, --last [value]', 'Number of old versions to maintain')
  .option('-z, --current-version [value]', 'Version to deploy')
  .parse(process.argv);


$.run([
  'log', 'cloudPages',
])
.then(({ log, cloudPages }) => {
  const options = {
    patterns: program.args,
    cwd: process.cwd(),
    dir: program.dir,
    gitDir: program.repository,
    remove: !!program.remove,
    version: program.currentVersion,
    bucket: program.bucket,
  };

  if(program.delay) {
    options.delay = parseInt(program.delay, 10);
  }
  if(program.last) {
    options.last = parseInt(program.last, 10);
  }
  if(process.env.MERMAID_RUN) {
    const CLOUD_PAGES_REG_EXP = /^cloudPages$/;
    const CONFIG_REG_EXP = /^([A-Z0-9_]+)$/;
    const MERMAID_GRAPH_CONFIG = {
      classes: {
        cloudPages: 'fill:#e7cdd2,stroke:#ebd4cb,stroke-width:1px;',
        config: 'fill:#d4cdcc,stroke:#ebd4cb,stroke-width:1px;',
        others: 'fill:#ebd4cb,stroke:#000,stroke-width:1px;',
      },
      styles: [{
        pattern: CLOUD_PAGES_REG_EXP,
        className: 'cloudPages',
      }, {
        pattern: CONFIG_REG_EXP,
        className: 'config',
      }, {
        pattern: /^(.+)$/,
        className: 'others',
      }],
      shapes: [{
        pattern: CLOUD_PAGES_REG_EXP,
        template: '$0(($0))',
      }, {
        pattern: CONFIG_REG_EXP,
        template: '$0{$0}',
      }],
    };
    process.stdout.write($.toMermaidGraph(MERMAID_GRAPH_CONFIG));
    process.exit(0);
  }
  return cloudPages(options);
})
.catch((err) => {
  console.error(err); // eslint-disable-line
  process.exit(1);
});
