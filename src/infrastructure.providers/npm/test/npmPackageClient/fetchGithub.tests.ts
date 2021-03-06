// import { testPath } from 'test/unit/utils';
import { NpmConfig, NpmPackageClient } from 'infrastructure.providers/npm'
import { githubFixtures } from './fetchGithub.fixtures'
import { LoggerMock } from 'infrastructure.testing';
import { VersionLensExtension } from 'presentation.extension';
import { ClientResponseSource } from 'core.clients';
import { PackageSuggestionFlags } from 'core.packages';

const assert = require('assert')
const mock = require('mock-require')

let defaultExtensionMock: VersionLensExtension;
let configMock = null;
let requestLightMock = null

export default {

  beforeAll: () => {
    // mock require modules
    requestLightMock = {}
    mock('request-light', requestLightMock)
  },

  afterAll: () => mock.stopAll(),

  beforeEach: () => {

    configMock = {
      get: (k) => null,
      defrost: () => null
    }

    defaultExtensionMock = new VersionLensExtension(configMock, null);
  },

  'fetchGithubPackage': {

    'returns a #semver:x.x.x. package': async () => {

      const testRequest: any = {
        providerName: 'testnpmprovider',
        package: {
          path: 'packagepath',
          name: 'core.js',
          version: 'github:octokit/core.js#semver:^2',
        }
      };

      requestLightMock.xhr = options => {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify(githubFixtures.tags),
          source: ClientResponseSource.remote
        })
      };

      // setup initial call
      const cut = new NpmPackageClient(
        new NpmConfig(defaultExtensionMock),
        new LoggerMock()
      );

      return cut.fetchPackage(testRequest)
        .then((actual) => {
          assert.equal(actual.source, 'github')
          assert.equal(actual.type, 'range')
          assert.equal(actual.resolved.name, testRequest.package.name)
          assert.deepEqual(actual.requested, testRequest.package)

          assert.deepEqual(
            actual.suggestions,
            [{
              name: 'satisfies',
              version: 'latest',
              flags: PackageSuggestionFlags.status
            }, {
              name: 'latest',
              version: 'v2.5.0',
              flags: PackageSuggestionFlags.release
            }, {
              name: 'rc',
              version: 'v2.6.0-rc.1',
              flags: PackageSuggestionFlags.prerelease
            }, {
              name: 'preview',
              version: 'v2.5.0-preview.1',
              flags: PackageSuggestionFlags.prerelease
            }]
          )
        })
    },

    'returns a #x.x.x': async () => {

      const testRequest: any = {
        providerName: 'testnpmprovider',
        package: {
          path: 'packagepath',
          name: 'core.js',
          version: 'github:octokit/core.js#v2.0.0',
        }
      };

      requestLightMock.xhr = options => {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify(githubFixtures.tags),
          source: ClientResponseSource.remote
        })
      };

      // setup initial call
      const cut = new NpmPackageClient(
        new NpmConfig(defaultExtensionMock),
        new LoggerMock()
      );

      return cut.fetchPackage(testRequest)
        .then((actual) => {
          assert.equal(actual.source, 'github')
          assert.equal(actual.type, 'range')
          assert.equal(actual.providerName, testRequest.providerName)
          assert.equal(actual.resolved.name, testRequest.package.name)
          assert.deepEqual(actual.requested, testRequest.package)

          assert.deepEqual(
            actual.suggestions,
            [{
              name: 'fixed',
              version: 'v2.0.0',
              flags: PackageSuggestionFlags.status
            }, {
              name: 'latest',
              version: 'v2.5.0',
              flags: PackageSuggestionFlags.release
            }, {
              name: 'rc',
              version: 'v2.6.0-rc.1',
              flags: PackageSuggestionFlags.prerelease
            }, {
              name: 'preview',
              version: 'v2.5.0-preview.1',
              flags: PackageSuggestionFlags.prerelease
            }]
          )
        })
    },

    'returns a #sha commit': async () => {

      const testRequest: any = {
        providerName: 'testnpmprovider',
        package: {
          path: 'packagepath',
          name: 'core.js',
          version: 'github:octokit/core.js#166c3497',
        }
      };

      requestLightMock.xhr = options => {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify(githubFixtures.commits),
          source: ClientResponseSource.remote
        })
      };

      // setup initial call
      const cut = new NpmPackageClient(
        new NpmConfig(defaultExtensionMock),
        new LoggerMock()
      );

      return cut.fetchPackage(testRequest)
        .then((actual) => {
          assert.equal(actual.source, 'github')
          assert.equal(actual.type, 'committish')
          assert.equal(actual.providerName, testRequest.providerName)
          assert.equal(actual.resolved.name, testRequest.package.name)
          assert.deepEqual(actual.requested, testRequest.package)

          assert.deepEqual(
            actual.suggestions,
            [{
              name: 'fixed',
              version: '166c3497',
              flags: PackageSuggestionFlags.status
            }, {
              name: 'latest',
              version: 'df4d9435',
              flags: PackageSuggestionFlags.release
            }]
          )
        })
    },

    'sets auth token in headers': async () => {

      const testRequest: any = {
        providerName: 'testnpmprovider',
        package: {
          path: 'packagepath',
          name: 'core.js',
          version: 'github:octokit/core.js#166c3497',
        }
      };

      const testToken = 'testToken';

      configMock.get = k =>
        k === 'npm.github.accessToken' ? testToken : null

      requestLightMock.xhr = options => {
        const actual = options.headers['authorization'];
        assert.equal(actual, 'token ' + testToken)

        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify(githubFixtures.commits),
          source: ClientResponseSource.remote
        })
      };

      // setup initial call
      const cut = new NpmPackageClient(
        new NpmConfig(defaultExtensionMock),
        new LoggerMock()
      );

      return cut.fetchPackage(testRequest);

    }

  }

}