/* ================================================================
   core.js  —  全站共用邏輯
   頁面切換（報價 ⇆ 各功能區）
   ================================================================ */

(function initNavSwitching() {
    var sectionMap = {
        'quote': document.getElementById('section-quote'),
        'final-doc': document.getElementById('section-final-doc'),
    };

    document.querySelectorAll('.topbar a[data-section]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var target = link.dataset.section;

            Object.values(sectionMap).forEach(function (el) {
                if (el) el.style.display = 'none';
            });
            if (sectionMap[target]) sectionMap[target].style.display = '';

            document.querySelectorAll('.topbar a').forEach(function (a) {
                a.classList.remove('active');
            });
            link.classList.add('active');
        });
    });
})();