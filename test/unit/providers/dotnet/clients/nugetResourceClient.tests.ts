import Fixtures from './fixtures/nugetResources'

import { NuGetResourceClient } from 'providers/dotnet/clients/nugetResourceClient';
import { UrlHelpers } from '/core/clients';
import { DotNetConfig } from '/providers/dotnet/config';
import { ConfigurationMock } from 'test/unit/mocks/configurationMock'

const assert = require('assert');
const mock = require('mock-require');

export const NuGetResourceClientTests = {

  //  reset mocks
  afterEach: () => mock.stop('request-light'),

  "fetchResource": {

    "returns the autocomplete resource from a list of resources": async () => {
      const testSource = {
        enabled: true,
        machineWide: false,
        url: 'https://test',
        protocol: UrlHelpers.RegistryProtocols.https
      };

      const mockResponse = {
        status: 200,
        responseText: JSON.stringify(Fixtures.success),
      };

      const expected = 'https://unit-test-usnc.nuget.org/autocomplete';

      mock('request-light', {
        xhr: options => {
          assert.equal(options.url, testSource.url)
          return Promise.resolve(mockResponse)
        }
      })

      // setup test feeds
      const config = new DotNetConfig(new ConfigurationMock())

      const cut = new NuGetResourceClient(config, 0)

      return cut.fetchResource(testSource)
        .then(actualSources => {
          assert.equal(actualSources, expected)
        });
    },

    "returns first feed entry from config when fails to obtain a resource": async () => {

      const testSource = {
        enabled: true,
        machineWide: false,
        url: 'https://test',
        protocol: UrlHelpers.RegistryProtocols.https
      };

      const mockResponse = {
        status: 404,
        responseText: 'an error occurred',
      };

      const expected = 'https://unit-test-fallback.nuget.org/autocomplete';

      mock('request-light', { xhr: () => Promise.reject(mockResponse) })

      // setup test feeds
      const config = new DotNetConfig(new ConfigurationMock({
        get: (k, d) => [expected]
      }))

      const cut = new NuGetResourceClient(config, 0)
      return cut.fetchResource(testSource)
        .then(actualSources => {
          assert.equal(actualSources, expected)
        });
    },

    "throws an error when no resource or feeds can be obtained": async () => {

      const testSource = {
        enabled: true,
        machineWide: false,
        url: 'https://test',
        protocol: UrlHelpers.RegistryProtocols.https
      };

      const mockResponse = {
        status: 404,
        responseText: 'an error occurred',
      };

      const expected = "Could not obtain a nuget resource";

      mock('request-light', { xhr: () => Promise.reject(mockResponse) })

      // setup test feeds
      const config = new DotNetConfig(new ConfigurationMock({
        get: (k, d) => []
      }))

      const cut = new NuGetResourceClient(config, 0)
      return cut.fetchResource(testSource)
        .catch(err => {
          assert.equal(err, expected)
        });
    },

  }

}