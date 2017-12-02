'use strict';

const semver = require('semver');
const git = require('simple-git');
const Promise = require('bluebird');

const DEFAULT_NAME = 'git';
const DEFAULT_DEPENDENCIES = ['ENV', 'log'];

const TAGS_REGEXP = /\(([^)]+)\)$/;

module.exports = initGitService;

function initGitService(
  $,
  name = DEFAULT_NAME,
  dependencies = DEFAULT_DEPENDENCIES
) {
  $.service(name, $.depends(dependencies, gitService));
}

function gitService({ log }) {
  return Promise.resolve().then(() => {
    log('debug', 'Git Service initialized.');

    return Promise.resolve({
      getCommits: gitDir =>
        new Promise((resolve, reject) => {
          git(gitDir).log((err, result) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(
              result.all
                .map(({ hash, date, message }) => {
                  const matches = TAGS_REGEXP.exec(message);
                  return {
                    hash,
                    time: new Date(date).getTime(),
                    message,
                    tags: matches
                      ? matches[1]
                          .split(',')
                          .map(s => s.trim())
                          .filter(s => s.startsWith('tag: '))
                          .map(s => s.substr('tag: '.length))
                          .filter(semver.valid)
                      : [],
                  };
                })
                .reduce(
                  (commits, { hash, time, message, tags }) =>
                    commits.concat(
                      tags.map(tag => ({ tag, hash, time, message }))
                    ),
                  []
                )
            );
          });
        }),
    });
  });
}
