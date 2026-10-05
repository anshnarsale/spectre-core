#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const distCli = path.join(__dirname, '..', 'dist', 'cli.js');
if (fs.existsSync(distCli)) {
  require(distCli);
} else {
  require('ts-node').register({ project: path.join(__dirname, '..', 'tsconfig.json') });
  require('../src/cli');
}
