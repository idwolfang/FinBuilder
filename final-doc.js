/* ================================================================
   final-doc.js  —  最終文件產生器
   依賴：html-docx-js CDN、html2canvas CDN（已於 index.html 載入）
   ================================================================ */

var FD_STYLE = {
    bodyPt: 12,
    h2Pt: 14,
    marginVCm: 1.27,  // 上下邊界（cm）
    marginHCm: 1.27,  // 左右邊界（cm）
    lineHeight: 1.4,   // 行高（Word / PNG 共用）
    paraSpacePt: 2,    // 段落上下間距（pt，Word 用）
};

FD_STYLE._bodyPx = Math.round(FD_STYLE.bodyPt * 1.333);
FD_STYLE._h2Px = Math.round(FD_STYLE.h2Pt * 1.333);
FD_STYLE._marginVPx = Math.round(FD_STYLE.marginVCm / 2.54 * 96);
FD_STYLE._marginHPx = Math.round(FD_STYLE.marginHCm / 2.54 * 96);
FD_STYLE._marginVTwips = Math.round(FD_STYLE.marginVCm * 567);
FD_STYLE._marginHTwips = Math.round(FD_STYLE.marginHCm * 567);


// ----------------------------------------------------------------
// 二、商品類型連動（STEPDOWN 專用欄位顯隱）
// ----------------------------------------------------------------
var fdProductType = document.getElementById('fd-productType');
if (fdProductType) {
    fdProductType.addEventListener('change', function () {
        var isStepdown = (this.value === 'STEPDOWN');
        var stepField = document.getElementById('fd-stepDownField');
        var koBlock = document.getElementById('fd-block-ko');
        if (stepField) stepField.style.display = isStepdown ? 'block' : 'none';
        if (koBlock) koBlock.style.display = isStepdown ? 'block' : 'none';
    });
}

// ----------------------------------------------------------------
// 三、圖片上傳預覽
// ----------------------------------------------------------------

// ① ② 多張圖片暫存陣列
var fdImageStore = { stock: [], schedule: [] };

// ① ② 多張上傳（按上傳順序排列）
function initMultiUploadZone(zoneId, fileInputId, imgListId, storeKey) {
    var zone = document.getElementById(zoneId);
    var fileInput = document.getElementById(fileInputId);
    var imgList = document.getElementById(imgListId);
    if (!zone || !fileInput || !imgList) return;

    fileInput.addEventListener('change', function (e) {
        var files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(function (file) {
            var reader = new FileReader();
            reader.onload = function (ev) {
                fdImageStore[storeKey].push(ev.target.result);

                var wrapper = document.createElement('div');
                wrapper.className = 'fd-img-item';

                var img = document.createElement('img');
                img.src = ev.target.result;

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'fd-img-remove';
                removeBtn.textContent = '✕';
                removeBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var allItems = Array.from(imgList.querySelectorAll('.fd-img-item'));
                    var idx = allItems.indexOf(wrapper);
                    if (idx !== -1) {
                        fdImageStore[storeKey].splice(idx, 1);
                        imgList.removeChild(wrapper);
                    }
                    if (fdImageStore[storeKey].length === 0) {
                        zone.querySelector('.fd-upload-ph').style.display = '';
                        zone.querySelector('.fd-upload-prev').style.display = 'none';
                        zone.classList.remove('has-image');
                    }
                });

                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);
                imgList.appendChild(wrapper);

                zone.querySelector('.fd-upload-ph').style.display = 'none';
                zone.querySelector('.fd-upload-prev').style.display = 'block';
                zone.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        });
        fileInput.value = ''; // 重置，允許重複選同一檔案
    });
}

// ③ 單張上傳（KO 遞減時程表，只需一張）
function initUploadZone(zoneId, fileInputId, imgId) {
    var zone = document.getElementById(zoneId);
    var fileInput = document.getElementById(fileInputId);
    var img = document.getElementById(imgId);
    if (!zone || !fileInput || !img) return;

    fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            img.src = ev.target.result;
            zone.querySelector('.fd-upload-ph').style.display = 'none';
            zone.querySelector('.fd-upload-prev').style.display = 'block';
            zone.classList.add('has-image');

            // 防止重複新增刪除按鈕
            var existing = zone.querySelector('.fd-img-remove');
            if (existing) existing.remove();

            var removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'fd-img-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                img.src = '';
                fileInput.value = '';
                zone.querySelector('.fd-upload-ph').style.display = '';
                zone.querySelector('.fd-upload-prev').style.display = 'none';
                zone.classList.remove('has-image');
            });
            zone.querySelector('.fd-upload-prev').appendChild(removeBtn);
        };
        reader.readAsDataURL(file);
    });
}

initMultiUploadZone('fd-zone-stock', 'fd-file-stock', 'fd-img-list-stock', 'stock');
initMultiUploadZone('fd-zone-schedule', 'fd-file-schedule', 'fd-img-list-schedule', 'schedule');
initUploadZone('fd-zone-ko', 'fd-file-ko', 'fd-img-ko');

// ----------------------------------------------------------------
// 四、取得並驗證表單資料
// ----------------------------------------------------------------
function getFdFormData() {
    var stepDownEl = document.getElementById('fd-stepDown');
    return {
        productType: document.getElementById('fd-productType').value,
        sn: document.getElementById('fd-sn').value.trim(),
        tenor: document.getElementById('fd-tenor').value,
        currency: document.getElementById('fd-currency').value,
        issuer: document.getElementById('fd-issuer').value,
        coupon: document.getElementById('fd-coupon').value,
        ko: document.getElementById('fd-ko').value,
        strike: document.getElementById('fd-strike').value,
        eki: document.getElementById('fd-eki').value,
        stepDown: stepDownEl ? stepDownEl.value : '',
        tradeDate: document.getElementById('fd-tradeDate').value,
        issueDate: document.getElementById('fd-issueDate').value,
        maturityDate: document.getElementById('fd-maturityDate').value,
        koStartDate: document.getElementById('fd-koStartDate').value,
        finalValDate: document.getElementById('fd-finalValDate').value,
        imgStockList: fdImageStore.stock,
        imgScheduleList: fdImageStore.schedule,
        imgKo: document.getElementById('fd-img-ko').src,
    };
}

function validateFdForm(data) {
    if (!data.sn) return '請填寫 SN 編號';
    if (!data.coupon) return '請填寫 Coupon %';
    if (!data.ko) return '請填寫 KO %';
    if (!data.strike) return '請填寫 Strike %';
    if (!data.tradeDate) return '請填寫交易日';
    if (!data.issueDate) return '請填寫發行日';
    if (!data.maturityDate) return '請填寫到期日';
    if (!data.koStartDate) return '請填寫 KO 開始日';
    if (!data.finalValDate) return '請填寫期末評價日';

    var zoneStock = document.getElementById('fd-zone-stock');
    var zoneSchedule = document.getElementById('fd-zone-schedule');
    var zoneKo = document.getElementById('fd-zone-ko');

    if (!zoneStock || !zoneStock.classList.contains('has-image'))
        return '請上傳連結標的表格圖片';
    if (!zoneSchedule || !zoneSchedule.classList.contains('has-image'))
        return '請上傳觀察期間及配息交割日表格圖片';

    /*
    if (data.productType === 'STEPDOWN' &&
        (!zoneKo || !zoneKo.classList.contains('has-image')))
        return '步階式出場商品請上傳 KO 遞減時程表圖片';
    */

    return null;
}

// ----------------------------------------------------------------
// 五、輔助函式
// ----------------------------------------------------------------
function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    return parts[0] + ' 年 ' + parseInt(parts[1]) + ' 月 ' + parseInt(parts[2]) + ' 日';
}

function buildTitle(data) {
    var prefixMap = { DAC: '（區間）', FCN: '（固定）', STEPDOWN: '（Stepdown固定）' };
    var typeMap = { DAC: '區間配息', FCN: '固定配息', STEPDOWN: '固定配息' };
    var prefix = prefixMap[data.productType] || '';
    var typeName = typeMap[data.productType] || '';
    var issuerName = data.issuer !== '-' ? data.issuer : '';
    return prefix + data.sn + '  最終商品文件 ' + data.tenor + typeName +
        '  <' + issuerName + ' ' + data.coupon + '%>';
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
}

// ----------------------------------------------------------------
// 六、Word 產生（html-docx-js）
// ----------------------------------------------------------------
async function generateWord(data) {
    if (!window.htmlDocx) {
        alert('html-docx-js 尚未載入，請重新整理頁面後再試。');
        return;
    }

    var content = buildDocumentHtml(data);
    var fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
        'body{font-family:"微軟正黑體","Microsoft JhengHei",sans-serif;' +
        'font-size:' + FD_STYLE.bodyPt + 'pt;line-height:' + FD_STYLE.lineHeight + ';color:#111;}' +
        'h2{font-size:' + FD_STYLE.h2Pt + 'pt;font-weight:bold;margin:0 0 8pt;}' +
        'p{margin:' + FD_STYLE.paraSpacePt + 'pt 0;}' +
        'img{max-width:170mm;display:inline-block;}' +
        '</style></head><body>' + content + '</body></html>';

    var blob = htmlDocx.asBlob(fullHtml, {
        orientation: 'portrait',
        margins: { top: FD_STYLE._marginVTwips, right: FD_STYLE._marginHTwips, bottom: FD_STYLE._marginVTwips, left: FD_STYLE._marginHTwips }
    });

    triggerDownload(blob, data.sn + '_最終商品文件.docx');
}

// ----------------------------------------------------------------
// 七、PNG 圖片產生（html2canvas，與 Word 相同內容來源）
// 注意：在本機 file:// 環境下會有安全限制，請改用 Live Server 測試
// 部署到 GitHub Pages（https://）後完全正常
// ----------------------------------------------------------------
async function generateImage(data) {
    var content = buildDocumentHtml(data);

    var container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff;box-sizing:border-box;';

    var styleEl = document.createElement('style');
    styleEl.textContent =
        '.fd-ci{padding:' + FD_STYLE._marginVPx + 'px ' + FD_STYLE._marginHPx + 'px;width:794px;box-sizing:border-box;' +
        'font-family:"微軟正黑體","Microsoft JhengHei",sans-serif;' +
        'font-size:' + FD_STYLE._bodyPx + 'px;line-height:' + FD_STYLE.lineHeight + ';color:#111;' +
        '-webkit-text-size-adjust:none;text-size-adjust:none;}' +
        '.fd-ci h2{font-size:' + FD_STYLE._h2Px + 'px;font-weight:bold;margin:0 0 ' + Math.round(FD_STYLE.paraSpacePt * 1.333 * 2) + 'px;}' +
        '.fd-ci p{margin:' + Math.round(FD_STYLE.paraSpacePt * 1.333) + 'px 0;}' +
        '.fd-ci img{max-width:100%;display:block;margin:8px 0;}';
    container.appendChild(styleEl);

    var inner = document.createElement('div');
    inner.className = 'fd-ci';
    inner.innerHTML = content;
    container.appendChild(inner);
    document.body.appendChild(container);

    try {
        var canvas = await html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
        });
        var imageUrl = canvas.toDataURL('image/png');

        var fdModal = document.getElementById('fdPreviewModal');
        var fdPreviewImg = document.getElementById('fdPreviewImg');
        var fdDownloadBtn = document.getElementById('fdDownloadModal');

        fdPreviewImg.src = imageUrl;
        fdModal.classList.add('active');

        fdDownloadBtn.onclick = function () {
            var link = document.createElement('a');
            link.href = imageUrl;
            link.download = data.sn + '_最終商品文件.png';
            link.click();
        };
    } finally {
        document.body.removeChild(container);
    }
}

// 燈箱關閉邏輯
var fdModal = document.getElementById('fdPreviewModal');
var fdCloseBtn = document.getElementById('fdCloseModal');
if (fdCloseBtn) {
    fdCloseBtn.addEventListener('click', function () {
        fdModal.classList.remove('active');
    });
}
if (fdModal) {
    fdModal.addEventListener('click', function (e) {
        if (e.target === fdModal) fdModal.classList.remove('active');
    });
}

// ----------------------------------------------------------------
// 八、建立文件 HTML 內容（Word、PNG、預覽 共用同一來源）
// ----------------------------------------------------------------
function buildDocumentHtml(data) {
    var ekiLine = data.eki
        ? '<p><strong>下限價格<span style="color:#c00000;">EKI</span>：</strong>對任一連結標的而言，其期初價之 <span style="color:#c00000;">' + data.eki + '%</span></p>'
        : '';

    var koTableBlock = (data.productType === 'STEPDOWN' &&
        data.imgKo && data.imgKo.indexOf('data:') === 0)
        ? '<p style="text-align:center;margin:8px 0;"><img src="' + data.imgKo + '" style="max-width:100%;display:inline-block;" /></p>'
        : '';

    var couponBlock = data.productType === 'DAC'
        ? '<p>每月配息：於各交割日，發行機構將依下列計算公式以美元為計價單位給付：</p>' +
        '<p><strong>✤&emsp;每月配息金額</strong> = 商品面額 × 100% × <strong style="color:#c00000;">' + data.coupon + '%</strong> × (1/12)' +
        '（四捨五入至小數點後第 2 位）× (n/N)</p>' +
        '<p><strong>✤&emsp;</strong>n = 所有連結標的之<u>收盤價同時大於或等於其配息下層界線</u>之觀察日天數</p>' +
        '<p><strong>✤&emsp;</strong>N = 觀察期間的觀察日總數</p>' +
        '<p><strong>✤&emsp;配息觀察期間及配息交割日</strong></p>'
        : '<p>每月固定配息：於各交割日，發行機構將依下列計算公式以美元為計價單位給付：</p>' +
        '<p><strong>✤&emsp;每月配息金額</strong> = 商品面額 × 100% × <strong style="color:#c00000;">' + data.coupon + '%</strong> × (1/12)' +
        '（四捨五入至小數點後第 2 位）</p>' +
        '<p><strong>✤&emsp;配息觀察期間及配息交割日：</strong></p>';

    var stockImagesHtml = (data.imgStockList || []).map(function (src) {
        return '<p style="text-align:center;margin:8px 0;"><img src="' + src + '" style="max-width:100%;display:inline-block;" /></p>';
    }).join('');

    var scheduleImagesHtml = (data.imgScheduleList || []).map(function (src) {
        return '<p style="text-align:center;margin:8px 0;"><img src="' + src + '" style="max-width:100%;display:inline-block;" /></p>';
    }).join('');

    return '<h2 style="color:#c00000;">' + escHtml(buildTitle(data)) + '</h2>' +
        '<p><strong>期初價：</strong>對任一連結標的而言，其交易日之價格。</p>' +
        '<p><strong>記憶式自動提前出場價：</strong>對任一連結標的而言，其期初價 ' + data.ko + '%' + (data.productType === 'STEPDOWN' && data.stepDown ? '後每月降 ' + data.stepDown + '%' : '') + '。</p>' +
        '<p><strong>執行價(轉換價)：</strong>對任一連結標的而言，其期初價之 <span style="color:#c00000;">' + data.strike + '%</span>。</p>' +
        ekiLine +
        '<p><strong><strong>✤&emsp;</strong>連結標的：</strong></p>' +
        stockImagesHtml +
        koTableBlock +
        '<p><strong><strong>✤&emsp;</strong>商品年期：</strong>' + parseInt(data.tenor) + '個月' +
        '（本商品發生記憶式自動提前出場事件除外）</p>' +
        '<p><strong><strong>✤&emsp;</strong>交易日：</strong>' + formatDate(data.tradeDate) + '</p>' +
        '<p><strong><strong>✤&emsp;</strong>發行日：</strong>' + formatDate(data.issueDate) + '</p>' +
        '<p><strong><strong>✤&emsp;</strong>到期日：</strong>' + formatDate(data.maturityDate) + '</p>' +
        '<p><strong><strong>✤&emsp;</strong>記憶式自動提前出場事件</strong>：' +
        '<span style="color:#c00000;">' + formatDate(data.koStartDate) + '(含)</span>' +
        ' 起至期末評價日 ' +
        '<span style="color:#1f3864;">' + formatDate(data.finalValDate) + '(含)</span></p>' +
        '<p style="margin-left:2em;">當所有連結標的之收盤價都曾經大於或等於其自動出場觸發水準，' +
        '則本商品滿足記憶式自動提前出場條款。</p>' +
        couponBlock +
        scheduleImagesHtml +
        '<p style="text-align:center;font-style:italic;margin-top:32px;color:#4472c4;font-size:10pt;' +
        'border-top:1px solid #4472c4;border-bottom:1px solid #4472c4;padding:4pt 0;">' +
        '上述資料均節錄自附件「中文產品說明書」，僅供投資人參考使用。</p>';
}

// ----------------------------------------------------------------
// 九、按鈕綁定
// ----------------------------------------------------------------
function bindFdButton(btnId, label, handler) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async function () {
        if (btn.disabled) return;
        var data = getFdFormData();
        var err = validateFdForm(data);
        if (err) { alert(err); return; }
        btn.disabled = true;
        btn.textContent = '⏳ 產生中...';
        try {
            await handler(data);
        } catch (e) {
            console.error(e);
            alert('產生失敗：' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    });
}

bindFdButton('fd-downloadWord', '⬇ 下載 Word', generateWord);
bindFdButton('fd-downloadPng', '⬇ 下載 PNG', generateImage);

// ----------------------------------------------------------------
// 開發用：預設填入測試數值（正式上線前可整段刪除）
// ----------------------------------------------------------------


/*(function prefillFdForm() {
    var defaults = {
        'fd-sn': '2026SN2228',
        'fd-coupon': '17.17',
        'fd-ko': '96',
        'fd-strike': '80',
        'fd-eki': '60',
        'fd-tradeDate': '2026-05-06',
        'fd-issueDate': '2026-05-13',
        'fd-maturityDate': '2026-11-17',
        'fd-koStartDate': '2026-06-15',
        'fd-finalValDate': '2026-11-13',
    };
    Object.keys(defaults).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = defaults[id];
    });
    var issuerEl = document.getElementById('fd-issuer');
    if (issuerEl) issuerEl.value = 'DBS';
})();*/