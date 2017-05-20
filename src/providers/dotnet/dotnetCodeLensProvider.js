/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as CommandFactory from '../commandFactory';
import appSettings from '../../common/appSettings';
import { AbstractCodeLensProvider } from '../abstractCodeLensProvider';
import { appConfig } from '../../common/appConfiguration';
import { parseDependencyNodes } from '../../common/dependencyParser';
import { generateCodeLenses } from '../../common/codeLensGeneration';
import { dotnetVersionParser } from './dotnetVersionParser.js';
import { clearDecorations } from '../../editor/decorations';

const xmldoc = require('xmldoc');
const { Range } = require('vscode');

export class DotNetCodeLensProvider extends AbstractCodeLensProvider {

  get selector() {
    return {
      language: 'xml',
      scheme: 'file',
      pattern: '**/*.{csproj,fsproj}'
    }
  }

  provideCodeLenses(document, token) {
    if (appSettings.showVersionLenses === false)
      return;

    const xmlDocument = new xmldoc.XmlDocument(document.getText());

    const dependencyNodes = this.extractDependencyNodes(
      document,
      xmlDocument
    );

    const packageCollection = parseDependencyNodes(
      dependencyNodes,
      appConfig,
      dotnetVersionParser
    );

    appSettings.inProgress = true;
    return generateCodeLenses(packageCollection, document)
      .then(codelenses => {
        appSettings.inProgress = false;
        return codelenses;
      });
  }

  evaluateCodeLens(codeLens) {
    // check if this package was found
    if (codeLens.packageNotFound())
      return CommandFactory.createPackageNotFoundCommand(codeLens);

    // check if this is a tagged version
    if (codeLens.isTaggedVersion())
      return CommandFactory.createTaggedVersionCommand(codeLens);

    // check if this install a tagged version
    if (codeLens.isInvalidVersion())
      return CommandFactory.createInvalidCommand(codeLens);

    // check if this entered versions matches a registry versions
    if (codeLens.versionMatchNotFound())
      return CommandFactory.createVersionMatchNotFoundCommand(codeLens);

    // check if this matches prerelease version
    if (codeLens.matchesPrereleaseVersion())
      return CommandFactory.createMatchesPrereleaseVersionCommand(codeLens);

    // check if this is the latest version
    if (codeLens.matchesLatestVersion())
      return CommandFactory.createMatchesLatestVersionCommand(codeLens);

    // check if this satisfies the latest version
    if (codeLens.satisfiesLatestVersion())
      return CommandFactory.createSatisfiesLatestVersionCommand(codeLens);

    // check if this is a fixed version
    if (codeLens.isFixedVersion())
      return CommandFactory.createFixedVersionCommand(codeLens);

    const latestVersion = codeLens.package.meta.tag.version;
    return CommandFactory.createVersionCommand(
      codeLens.package.version,
      latestVersion,
      codeLens
    );
  }

  extractDependencyNodes(document, xmlDocument) {
    const packageDependencyKeys = appConfig.dotnetCSProjDependencyProperties;

    const nodes = [];
    xmlDocument.eachChild(group => {
      if (group.name !== 'ItemGroup') return;
      group.eachChild(child => {
        if (!packageDependencyKeys.includes(child.name)) return;

        const line = document.getText(
          new Range(
            document.positionAt(child.startTagPosition - 1),
            document.positionAt(child.position)
          )
        );

        const start = line.indexOf(' Version="') + 9;
        const end = line.indexOf('"', start + 1);
        nodes.push({
          start: child.startTagPosition + start - 1,
          end: child.startTagPosition + end,
          name: child.attr.Include,
          value: child.attr.Version,
          replaceInfo: {
            start: child.startTagPosition + start - 1,
            end: child.startTagPosition + end,
          }
        });
      });
    });

    return nodes;
  }

  extractVersionFromXml_(xmlResponse) {
    const versionExp = /<d:Version>(.*)<\/d:Version>/;
    const results = xmlResponse.match(versionExp);
    return results && results.length > 1 ? results[1] : '';
  }

}