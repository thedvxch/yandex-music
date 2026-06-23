// @dvxch/yandex-music docs — небольшие улучшения UX поверх дефолтной темы TypeDoc.
// Без зависимостей. Сейчас: кнопка «копировать» на каждом блоке кода.
(function () {
  'use strict';

  function addCopyButtons() {
    document.querySelectorAll('pre').forEach(function (pre) {
      if (pre.querySelector('button.tsd-copy')) return;
      var code = pre.querySelector('code');
      if (!code) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tsd-copy';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Скопировать код');

      btn.addEventListener('click', function () {
        var text = code.innerText;
        var done = function () {
          btn.textContent = 'Copied';
          btn.classList.add('tsd-copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('tsd-copied');
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {});
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });

      pre.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyButtons);
  } else {
    addCopyButtons();
  }
})();
