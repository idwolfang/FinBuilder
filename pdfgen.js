/* ================================================================
   pdfgen.js — 身分文件 PDF 產生器
   上傳身分證／存摺／其他文件圖片，依規則排版後輸出 PDF
   ================================================================ */

(function () {
    'use strict';

    // ---------- 版面常數（單位：mm，A4）----------
    var PAGE_W = 210;
    var PAGE_H = 297;
    var MARGIN = 12.7;            // Word「窄」邊界
    var PRINT_W = PAGE_W - MARGIN * 2;
    var PRINT_H = PAGE_H - MARGIN * 2;
    var ID_HEIGHT = 54;           // 身分證固定高度
    var PASSBOOK_WIDTH = 160;     // 存摺固定寬度
    var GAP = 5;                  // 同頁合併時的間距

    // ---------- 狀態 ----------
    var pdfItems = [];            // { id, file, url, img, type, mergeWithPrev }
    var itemCounter = 0;
    var currentPages = [];
    var currentPreviewIndex = 0;

    // ---------- DOM ----------
    var fileInput, list, previewBtn, statusEl;
    var modal, previewPagesEl, pageInfoEl, pagePrevBtn, pageNextBtn, confirmBtn, closeBtn;

    function init() {
        fileInput = document.getElementById('pdfgen-fileInput');
        list = document.getElementById('pdfgen-list');
        previewBtn = document.getElementById('pdfgen-previewBtn');
        statusEl = document.getElementById('pdfgen-status');

        modal = document.getElementById('pdfgenPreviewModal');
        previewPagesEl = document.getElementById('pdfgenPreviewPages');
        pageInfoEl = document.getElementById('pdfgenPageInfo');
        pagePrevBtn = document.getElementById('pdfgenPagePrev');
        pageNextBtn = document.getElementById('pdfgenPageNext');
        confirmBtn = document.getElementById('pdfgenConfirmDownload');
        closeBtn = document.getElementById('pdfgenCloseModal');

        if (!fileInput) return; // 此頁未載入時不執行，避免其他分頁報錯

        fileInput.addEventListener('change', handleFiles);
        list.addEventListener('change', handleListChange);
        list.addEventListener('click', handleListClick);
        previewBtn.addEventListener('click', onPreviewClick);
        pagePrevBtn.addEventListener('click', function () { gotoPage(currentPreviewIndex - 1); });
        pageNextBtn.addEventListener('click', function () { gotoPage(currentPreviewIndex + 1); });
        confirmBtn.addEventListener('click', onConfirmDownload);
        closeBtn.addEventListener('click', closeModal);
    }

    // ---------- 上傳（可分批，累加到既有列表）----------
    function handleFiles(e) {
        var files = Array.prototype.slice.call(e.target.files);
        files.forEach(function (file) {
            var id = 'pg' + (++itemCounter);
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { renderList(); };
            img.src = url;
            pdfItems.push({ id: id, file: file, url: url, img: img, type: 'id', mergeWithPrev: false });
        });
        renderList();
        fileInput.value = ''; // 允許重複選同一批檔案 / 繼續分批上傳
        statusEl.textContent = '';
    }

    // ---------- 列表渲染 ----------
    function renderList() {
        var html = pdfItems.map(function (item, idx) {
            var prev = idx > 0 ? pdfItems[idx - 1] : null;
            var canMerge = item.type !== 'other' && prev && prev.type === item.type;
            var mergeHtml;

            if (item.type === 'other') {
                mergeHtml = '<span class="pdfgen-fixed-hint">滿版鋪滿A4，固定各自一頁</span>';
            } else if (canMerge) {
                mergeHtml = '<label class="pdfgen-merge-label"><input type="checkbox" class="pdfgen-merge"' +
                    (item.mergeWithPrev ? ' checked' : '') + ' /> 與上一張合併同頁</label>';
            } else {
                mergeHtml = '<span class="pdfgen-fixed-hint">與上一張非同類型，將另起新頁</span>';
            }

            return '' +
                '<div class="pdfgen-item" data-id="' + item.id + '">' +
                '  <img class="pdfgen-thumb" src="' + item.url + '" alt="" />' +
                '  <div class="pdfgen-item-info">' +
                '    <select class="pdfgen-type">' +
                '      <option value="id"' + (item.type === 'id' ? ' selected' : '') + '>身分證</option>' +
                '      <option value="passbook"' + (item.type === 'passbook' ? ' selected' : '') + '>存摺</option>' +
                '      <option value="other"' + (item.type === 'other' ? ' selected' : '') + '>其他文件</option>' +
                '    </select>' +
                mergeHtml +
                '  </div>' +
                '  <div class="pdfgen-item-actions">' +
                '    <button type="button" class="pdfgen-up" title="上移">↑</button>' +
                '    <button type="button" class="pdfgen-down" title="下移">↓</button>' +
                '    <button type="button" class="pdfgen-remove" title="刪除">✖</button>' +
                '  </div>' +
                '</div>';
        }).join('');
        list.innerHTML = html;
    }

    function handleListChange(e) {
        var itemEl = e.target.closest('.pdfgen-item');
        if (!itemEl) return;
        var item = findItem(itemEl.dataset.id);
        if (!item) return;

        if (e.target.classList.contains('pdfgen-type')) {
            item.type = e.target.value;
            item.mergeWithPrev = false; // 換類型後合併狀態不再有效，重設
            renderList();
        } else if (e.target.classList.contains('pdfgen-merge')) {
            item.mergeWithPrev = e.target.checked;
        }
    }

    function handleListClick(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var itemEl = e.target.closest('.pdfgen-item');
        if (!itemEl) return;
        var idx = pdfItems.findIndex(function (it) { return it.id === itemEl.dataset.id; });
        if (idx === -1) return;

        if (btn.classList.contains('pdfgen-remove')) {
            URL.revokeObjectURL(pdfItems[idx].url);
            pdfItems.splice(idx, 1);
            renderList();
        } else if (btn.classList.contains('pdfgen-up') && idx > 0) {
            swapItems(idx, idx - 1);
        } else if (btn.classList.contains('pdfgen-down') && idx < pdfItems.length - 1) {
            swapItems(idx, idx + 1);
        }
    }

    function swapItems(a, b) {
        var tmp = pdfItems[a];
        pdfItems[a] = pdfItems[b];
        pdfItems[b] = tmp;
        renderList();
    }

    function findItem(id) {
        return pdfItems.find(function (it) { return it.id === id; });
    }

    // ---------- 排版計算 ----------
    // 每張圖算出 { w, h }（mm），身分證用固定高度、存摺用固定寬度、其他文件滿版A4
    function computeRect(item) {
        var ratio = item.img.naturalWidth / item.img.naturalHeight;
        if (item.type === 'id') {
            var h = ID_HEIGHT;
            return { w: h * ratio, h: h, imgId: item.id };
        }
        if (item.type === 'passbook') {
            var w = PASSBOOK_WIDTH;
            return { w: w, h: w / ratio, imgId: item.id };
        }
        // other：滿版鋪滿整張 A4，貼齊紙緣
        return { x: 0, y: 0, w: PAGE_W, h: PAGE_H, imgId: item.id };
    }

    // 依序把 items 排成頁面陣列：[{ type, rects: [{x,y,w,h,imgId}, ...] }, ...]
    function buildPages(items) {
        var pages = [];
        var currentPage = null;

        function newPage(type) {
            currentPage = { type: type, rects: [], cursorX: 0, cursorY: 0, rowHeight: 0 };
            pages.push(currentPage);
            return currentPage;
        }

        items.forEach(function (item) {
            if (item.type === 'other') {
                newPage('other');
                currentPage.rects.push(computeRect(item));
                currentPage = null; // 其他文件固定各自一頁，強制中斷合併鏈
                return;
            }

            var wantsMerge = item.mergeWithPrev && currentPage && currentPage.type === item.type;
            if (!wantsMerge) newPage(item.type);

            var rect = computeRect(item);

            if (item.type === 'id') {
                // 由左至右排列，超出版面寬度換行
                if (currentPage.cursorX + rect.w > PRINT_W) {
                    currentPage.cursorX = 0;
                    currentPage.cursorY += currentPage.rowHeight + GAP;
                    currentPage.rowHeight = 0;
                }
                // 超出版面高度，安全機制：強制換到新頁
                if (currentPage.cursorY + rect.h > PRINT_H) {
                    newPage(item.type);
                }
                rect.x = MARGIN + currentPage.cursorX;
                rect.y = MARGIN + currentPage.cursorY;
                currentPage.rects.push(rect);
                currentPage.cursorX += rect.w + GAP;
                currentPage.rowHeight = Math.max(currentPage.rowHeight, rect.h);
            } else if (item.type === 'passbook') {
                // 上下堆疊，置中
                if (currentPage.cursorY + rect.h > PRINT_H) {
                    newPage(item.type);
                }
                rect.x = MARGIN + (PRINT_W - rect.w) / 2;
                rect.y = MARGIN + currentPage.cursorY;
                currentPage.rects.push(rect);
                currentPage.cursorY += rect.h + GAP;
            }
        });

        return pages;
    }

    // ---------- 預覽燈箱 ----------
    function onPreviewClick() {
        if (pdfItems.length === 0) { alert('請先上傳圖片'); return; }
        var notLoaded = pdfItems.some(function (it) { return !it.img.complete || it.img.naturalWidth === 0; });
        if (notLoaded) { alert('圖片尚未載入完成，請稍候再試一次'); return; }

        currentPages = buildPages(pdfItems);
        currentPreviewIndex = 0;
        renderPreview();
        openModal();
    }

    function renderPreview() {
        previewPagesEl.innerHTML = '';
        currentPages.forEach(function (page, i) {
            var pageEl = document.createElement('div');
            pageEl.className = 'pdfgen-page';
            pageEl.style.display = i === currentPreviewIndex ? 'block' : 'none';
            page.rects.forEach(function (rect) {
                var item = findItem(rect.imgId);
                if (!item) return;
                var imgEl = document.createElement('img');
                imgEl.className = 'pdfgen-page-rect';
                imgEl.src = item.url;
                imgEl.style.left = (rect.x / PAGE_W * 100) + '%';
                imgEl.style.top = (rect.y / PAGE_H * 100) + '%';
                imgEl.style.width = (rect.w / PAGE_W * 100) + '%';
                imgEl.style.height = (rect.h / PAGE_H * 100) + '%';
                pageEl.appendChild(imgEl);
            });
            previewPagesEl.appendChild(pageEl);
        });
        updatePageInfo();
    }

    function gotoPage(idx) {
        if (idx < 0 || idx >= currentPages.length) return;
        currentPreviewIndex = idx;
        var children = previewPagesEl.querySelectorAll('.pdfgen-page');
        children.forEach(function (el, i) { el.style.display = i === idx ? 'block' : 'none'; });
        updatePageInfo();
    }

    function updatePageInfo() {
        pageInfoEl.textContent = currentPages.length
            ? ('第 ' + (currentPreviewIndex + 1) + ' / ' + currentPages.length + ' 頁')
            : '';
        pagePrevBtn.style.display = currentPages.length > 1 ? '' : 'none';
        pageNextBtn.style.display = currentPages.length > 1 ? '' : 'none';
    }

    function openModal() { modal.classList.add('active'); }
    function closeModal() { modal.classList.remove('active'); }

    // ---------- 產生並下載 PDF（跟預覽用同一份 currentPages，看到等於印出來） ----------
    function onConfirmDownload() {
        if (!window.jspdf) { alert('PDF 元件載入失敗，請重新整理頁面再試'); return; }
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: 'mm', format: 'a4' });

        currentPages.forEach(function (page, i) {
            if (i > 0) doc.addPage();
            page.rects.forEach(function (rect) {
                var item = findItem(rect.imgId);
                if (!item) return;
                var fmt = item.file.type === 'image/png' ? 'PNG' : 'JPEG';
                doc.addImage(item.img, fmt, rect.x, rect.y, rect.w, rect.h);
            });
        });

        var d = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var dateStr = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
        doc.save('身分文件_' + dateStr + '.pdf');

        statusEl.textContent = '✅ PDF 已產生並下載';
        closeModal();
    }

    document.addEventListener('DOMContentLoaded', init);
})();