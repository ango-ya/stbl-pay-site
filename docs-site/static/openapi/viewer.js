// Redoc の表示設定。テーマは docs（src/css/custom.css）の色・書体に合わせる
(function () {
  var font = '"Schibsted Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';
  var mono = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

  // 同じファイルが /docs/en/openapi/ にも出るので、英語版ではロゴと文言を替える
  if (/\/en\/openapi\//.test(location.pathname)) {
    document.documentElement.lang = 'en';
    var logo = document.querySelector('.stbl-brand img');
    logo.src = '../img/logo-wordmark-stblpay-black.png';
    logo.alt = 'STBLpay';
    logo.width = 882;
    logo.height = 199;
    document.querySelector('.stbl-back').textContent = 'REST API reference';
  }

  Redoc.init('../openapi.yaml', {
    // CSP の worker-src 'none' で検索の Worker が動かないため、検索は切る
    disableSearch: true,
    pathInMiddlePanel: true,
    scrollYOffset: '.stbl-header',
    theme: {
      spacing: { unit: 5 },
      colors: {
        primary: { main: '#2775ca' },
        text: { primary: '#161616', secondary: '#6b6b6b' },
        border: { dark: '#161616', light: '#e2e2e2' },
      },
      typography: {
        fontFamily: font,
        fontSize: '15px',
        lineHeight: '1.8',
        headings: { fontFamily: font, fontWeight: '700' },
        code: { fontFamily: mono, color: '#161616', backgroundColor: '#f7f7f6' },
        links: { color: '#2775ca', visited: '#2775ca', hover: '#1f5fa8' },
      },
      sidebar: { backgroundColor: '#f7f7f6', textColor: '#161616', activeTextColor: '#1f5fa8' },
      rightPanel: { backgroundColor: '#161616', textColor: '#ffffff' },
      codeBlock: { backgroundColor: '#000000' },
    },
  }, document.getElementById('redoc'));
})();
