#!/usr/bin/env node
import 'reflect-metadata';

import path from 'path';

import { generateEndpointDocSpec } from '../main/index.js';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const appModulePath = path.join(process.cwd(), 'out/main/app');
require(appModulePath);
const packageJson = require(packageJsonPath);

const intro = [
    `# ${packageJson.name} (${packageJson.version})`,
    packageJson.description,
];
const docs = generateEndpointDocSpec();
const md = intro.concat(docs);
process.stdout.write(md.join('\n'));
