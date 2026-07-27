(function () {
  'use strict';

  const startedAt = performance.now();
  document.documentElement.classList.add('bq-booting');

  function installBranding() {
    document.title = 'BudgetQuest Cloud';

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = './icon.svg?v=2';

    if (document.getElementById('budgetQuestSplash')) return;

    const style = document.createElement('style');
    style.id = 'budgetQuestBrandingStyles';
    style.textContent = `
      html.bq-booting body > :not(#budgetQuestSplash){visibility:hidden!important}
      .bq-splash{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:32px;background:linear-gradient(160deg,#fffaf0 0%,#f8fbff 44%,#dbeaf6 100%);transition:opacity .3s ease,visibility .3s ease}
      .bq-splash::before{content:"";position:absolute;inset:auto -18% -24% -18%;height:52%;border-radius:50% 50% 0 0;background:linear-gradient(145deg,rgba(129,178,210,.52),rgba(232,243,250,.84));transform:rotate(-5deg)}
      .bq-splash::after{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border:1px solid rgba(213,169,65,.2);border-radius:50%;box-shadow:0 0 0 26px rgba(213,169,65,.08),0 0 0 54px rgba(213,169,65,.05)}
      .bq-splash.is-hidden{opacity:0;visibility:hidden;pointer-events:none}
      .bq-splash-card{position:relative;z-index:1;width:min(430px,100%);text-align:center;transform:translateY(-4vh)}
      .bq-splash-logo{width:min(210px,52vw);height:auto;filter:drop-shadow(0 18px 30px rgba(6,25,49,.16));animation:bqSplashIn .65s cubic-bezier(.2,.8,.2,1) both,bqSplashPulse 1.4s ease-in-out .65s infinite}
      .bq-splash-title{margin:26px 0 7px;font:800 clamp(31px,8vw,46px)/1.04 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-1.7px;color:#0b294a}
      .bq-splash-title span{color:#3c9b9b}
      .bq-splash-rule{display:flex;align-items:center;gap:12px;width:210px;margin:22px auto 18px;color:#d5a941}
      .bq-splash-rule::before,.bq-splash-rule::after{content:"";height:1px;flex:1;background:currentColor}.bq-splash-rule i{width:9px;height:9px;border-radius:50%;background:currentColor}
      .bq-splash-subtitle{margin:0;color:#203b58;font:500 clamp(16px,4.2vw,20px)/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      @keyframes bqSplashIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
      @keyframes bqSplashPulse{50%{transform:scale(1.025)}}
      @media (prefers-reduced-motion:reduce){.bq-splash-logo{animation:none}.bq-splash{transition:none}}
    `;
    document.head.appendChild(style);

    const splash = document.createElement('div');
    splash.id = 'budgetQuestSplash';
    splash.className = 'bq-splash';
    splash.setAttribute('role', 'status');
    splash.setAttribute('aria-label', 'BudgetQuest Cloud wird gestartet');
    splash.innerHTML = `
      <div class="bq-splash-card">
        <img class="bq-splash-logo" src="./icon.svg?v=2" alt="BudgetQuest Cloud">
        <div class="bq-splash-title">BudgetQuest <span>Cloud</span></div>
        <div class="bq-splash-rule" aria-hidden="true"><i></i></div>
        <p class="bq-splash-subtitle">Dein Finanz- und Haushaltsbegleiter</p>
      </div>`;
    document.body.prepend(splash);

    const hide = () => {
      const remaining = Math.max(0, 2000 - (performance.now() - startedAt));
      window.setTimeout(() => {
        document.documentElement.classList.remove('bq-booting');
        splash.classList.add('is-hidden');
        window.setTimeout(() => splash.remove(), 350);
      }, remaining);
    };

    document.readyState === 'complete'
      ? hide()
      : window.addEventListener('load', hide, { once: true });
  }

  if (document.body) {
    installBranding();
  } else {
    document.addEventListener('DOMContentLoaded', installBranding, { once: true });
  }
})();