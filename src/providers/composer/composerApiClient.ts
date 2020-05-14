import {
  DocumentFactory,
  ResponseFactory,
  SuggestionFactory,
  VersionHelpers,
  PackageRequest,
  PackageDocument,
  PackageSourceTypes,
  SemverSpec
} from "core/packages";

import {
  JsonHttpClientRequest,
  ClientResponse,
  HttpRequestMethods
} from "core/clients";

import ComposerConfig from './config';

const jsonRequest = new JsonHttpClientRequest({}, undefined);
const fs = require('fs');

export async function fetchComposerPackage(request: PackageRequest): Promise<PackageDocument> {
  const semverSpec = VersionHelpers.parseSemver(request.package.version);

  return createRemotePackageDocument(request, semverSpec)
    .catch((error: ClientResponse<string>) => {
      if (error.status === 404) {
        return DocumentFactory.createNotFound(
          ComposerConfig.provider,
          request.package,
          null,
          ResponseFactory.createResponseStatus(error.source, error.status)
        );
      }
      return Promise.reject(error);
    });
}

export function createRemotePackageDocument(
  request: PackageRequest,
  semverSpec: SemverSpec
): Promise<PackageDocument> {
  const url = `${ComposerConfig.getApiUrl()}/${request.package.name}.json`;

  return jsonRequest.requestJson(HttpRequestMethods.get, url)
    .then(httpResponse => {
      const packageInfo = httpResponse.data.packages[request.package.name];

      const versionRange = semverSpec.rawVersion;

      const requested = request.package;

      const resolved = {
        name: requested.name,
        version: versionRange,
      };

      const response = {
        source: httpResponse.source,
        status: httpResponse.status,
      };

      const rawVersions = Object.keys(packageInfo);

      // extract semver versions only
      const semverVersions = VersionHelpers.filterSemverVersions(rawVersions);

      // seperate versions to releases and prereleases
      const { releases, prereleases } = VersionHelpers.splitReleasesFromArray(
        VersionHelpers.filterSemverVersions(semverVersions)
      );

      // analyse suggestions
      const suggestions = SuggestionFactory.createSuggestionTags(
        versionRange,
        releases,
        prereleases
      );

      return {
        provider: ComposerConfig.provider,
        source: PackageSourceTypes.registry,
        response,
        type: semverSpec.type,
        requested,
        resolved,
        releases,
        prereleases,
        suggestions,
      };
    });
}

export function readComposerSelections(filePath) {

  return new Promise(function (resolve, reject) {
    if (fs.existsSync(filePath) === false) {
      reject(null);
      return;
    }

    fs.readFile(filePath, "utf-8", (err, data) => {
      if (err) {
        reject(err)
        return;
      }

      const selectionsJson = JSON.parse(data.toString());

      resolve(selectionsJson);
    });

  });

}

