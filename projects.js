/** projects.js: renders real projects from projects-data.js; shows an honest empty state when there are none. */
(function () {
  'use strict';
  const list = window.VIRA_PROJECTS || [], grid = document.getElementById('projGrid'), empty = document.getElementById('projEmpty');
  if (!grid) return;
  empty.hidden = list.length > 0;
  list.forEach(p => {
    const a = document.createElement('article'); a.className = 'proj-card';
    a.innerHTML = '<span class="tag"></span><h3></h3><div class="meta"></div><p></p>';
    a.querySelector('.tag').textContent = p.type || ''; a.querySelector('h3').textContent = p.title || '';
    a.querySelector('.meta').textContent = p.city ? '📍 ' + p.city : ''; a.querySelector('p').textContent = p.desc || '';
    grid.appendChild(a);
  });
})();
