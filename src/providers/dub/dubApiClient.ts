import {
  DocumentFactory,
  ResponseFactory,
  SuggestionFactory,
  VersionHelpers,
  PackageSourceTypes,
  PackageDocument,
  SemverSpec,
  PackageRequest
} from "core/packages";
import {
  JsonHttpClientRequest,
  ClientResponse,
  HttpRequestMethods
} from "core/clients";
import DubConfig from './config';

const fs = require('fs');

const jsonRequest = new JsonHttpClientRequest({}, 0);

export async function fetchDubPackage(request: PackageRequest): Promise<PackageDocument> {
  const semverSpec = VersionHelpers.parseSemver(request.package.version);

  return createRemotePackageDocument(request, semverSpec)
    .catch((error: ClientResponse<string>) => {
      if (error.status === 404) {
        return DocumentFactory.createNotFound(
          DubConfig.provider,
          request.package,
          null,
          ResponseFactory.createResponseStatus(error.source, error.status)
        );
      }
      return Promise.reject(error);
    });
}

async function createRemotePackageDocument(
  request: PackageRequest,
  semverSpec: SemverSpec
): Promise<PackageDocument> {
  const url = `${DubConfig.getApiUrl()}/${encodeURIComponent(request.package.name)}/info`;
  const queryParams = {
    minimize: 'true',
  }

  return jsonRequest.requestJson(HttpRequestMethods.get, url, queryParams)
    .then(httpResponse => {

      const packageInfo = httpResponse.data;

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

      const rawVersions = VersionHelpers.extractVersionsFromMap(packageInfo.versions);

      // seperate versions to releases and prereleases
      const { releases, prereleases } = VersionHelpers.splitReleasesFromArray(rawVersions)

      // analyse suggestions
      const suggestions = SuggestionFactory.createSuggestionTags(
        versionRange,
        releases,
        prereleases
      );

      // todo return a ~master entry when no matches found
      return {
        provider: DubConfig.provider,
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

export async function readDubSelections(filePath) {

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
      if (selectionsJson.fileVersion != 1) {
        reject(new Error(`Unknown dub.selections.json file version ${selectionsJson.fileVersion}`))
        return;
      }

      resolve(selectionsJson);
    });

  });

}