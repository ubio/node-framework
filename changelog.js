const fs = require('fs');

const changelogText = fs.readFileSync('CHANGELOG.md', 'utf-8');
const unversionedLines = changelogText.split(/^## /m)[0].trim();

if (unversionedLines) {
    const newChangelog = ['## ', process.env.npm_package_version, '\n\n', changelogText].join('');
    fs.writeFileSync('./CHANGELOG.md', newChangelog, 'utf-8');
}

