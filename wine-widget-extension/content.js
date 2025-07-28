(function () {
    const existing = document.getElementById('wine-widget-iframe');
    if (existing) return;
  
    const iframe = document.createElement('iframe');
    iframe.id = 'wine-widget-iframe';
    iframe.src = 'https://virtual-sommelier-nu.vercel.app/'; // ← Replace with your URL
    iframe.style = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      height: 420px;
      z-index: 999999;
      border: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-radius: 12px;
    `;
    document.body.appendChild(iframe);
  })();
  