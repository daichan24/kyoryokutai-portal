const { join } = require('path');

/** Puppeteer のブラウザキャッシュをプロジェクト配下に固定（Render / Docker でのパス解決を安定させる） */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
