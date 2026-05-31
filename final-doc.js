/* ================================================================
   final-doc.js  —  最終文件產生器
   依賴：docx CDN、jsPDF CDN、html2canvas CDN（已於 index.html 載入）
   ================================================================ */

// ----------------------------------------------------------------
// 一、頁面切換（報價 ⇆ 最終文件）
// ----------------------------------------------------------------
(function initNavSwitching() {
    const sectionMap = {
        'quote': document.getElementById('section-quote'),
        'final-doc': document.getElementById('section-final-doc'),
    };

    document.querySelectorAll('.topbar a[data-section]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const target = link.dataset.section;

            Object.values(sectionMap).forEach(el => { if (el) el.style.display = 'none'; });
            if (sectionMap[target]) sectionMap[target].style.display = '';

            document.querySelectorAll('.topbar a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
        });
    });
})();

// ----------------------------------------------------------------
// 二、商品類型連動（STEPDOWN 專用欄位顯隱）
// ----------------------------------------------------------------
const fdProductType = document.getElementById('fd-productType');
if (fdProductType) {
    fdProductType.addEventListener('change', function () {
        const isStepdown = (this.value === 'STEPDOWN');
        const stepField = document.getElementById('fd-stepDownField');
        const koBlock = document.getElementById('fd-block-ko');
        if (stepField) stepField.style.display = isStepdown ? 'block' : 'none';
        if (koBlock) koBlock.style.display = isStepdown ? 'block' : 'none';
    });
}

// ----------------------------------------------------------------
// 三、圖片上傳預覽
// ----------------------------------------------------------------
function initUploadZone(zoneId, fileInputId, imgId) {
    const zone = document.getElementById(zoneId);
    const fileInput = document.getElementById(fileInputId);
    const img = document.getElementById(imgId);
    if (!zone || !fileInput || !img) return;

    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            img.src = ev.target.result;
            zone.querySelector('.fd-upload-ph').style.display = 'none';
            zone.querySelector('.fd-upload-prev').style.display = 'block';
            zone.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    });
}

initUploadZone('fd-zone-stock', 'fd-file-stock', 'fd-img-stock');
initUploadZone('fd-zone-schedule', 'fd-file-schedule', 'fd-img-schedule');
initUploadZone('fd-zone-ko', 'fd-file-ko', 'fd-img-ko');

// ----------------------------------------------------------------
// 四、取得並驗證表單資料
// ----------------------------------------------------------------
function getFdFormData() {
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
        stepDown: document.getElementById('fd-stepDown')?.value || '',
        tradeDate: document.getElementById('fd-tradeDate').value,
        issueDate: document.getElementById('fd-issueDate').value,
        maturityDate: document.getElementById('fd-maturityDate').value,
        koStartDate: document.getElementById('fd-koStartDate').value,
        finalValDate: document.getElementById('fd-finalValDate').value,
        imgStock: document.getElementById('fd-img-stock').src,
        imgSchedule: document.getElementById('fd-img-schedule').src,
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
    if (!document.getElementById('fd-zone-stock')?.classList.contains('has-image'))
        return '請上傳連結標的表格圖片';
    if (!document.getElementById('fd-zone-schedule')?.classList.contains('has-image'))
        return '請上傳觀察期間及配息交割日表格圖片';
    if (data.productType === 'STEPDOWN' &&
        !document.getElementById('fd-zone-ko')?.classList.contains('has-image'))
        return '步階式出場商品請上傳 KO 遞減時程表圖片';
    return null;
}

// ----------------------------------------------------------------
// 五、輔助函式
// ----------------------------------------------------------------
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${yyyy} 年 ${parseInt(mm)} 月 ${parseInt(dd)} 日`;
}

function buildTitle(data) {
    const prefixMap = { DAC: '(區間)', FCN: '(固定)', STEPDOWN: '(Stepdown固定)' };
    const typeMap = { DAC: '區間配息', FCN: '固定配息', STEPDOWN: '固定配息' };
    const prefix = prefixMap[data.productType] || '';
    const typeName = typeMap[data.productType] || '';
    const issuerName = data.issuer !== '-' ? data.issuer : '';
    return `${prefix}${data.sn}  最終商品文件 ${data.tenor}${typeName}  <${issuerName} ${data.coupon}%>`;
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// （已移除 dataUrlToArrayBuffer 與 getImageDimensions，不再需要）


// ----------------------------------------------------------------
// 六、Word 產生（html-docx-js）
// ----------------------------------------------------------------
async function generateWord(data) {
    if (!window.htmlDocx) {
        alert('html-docx-js 尚未載入，請重新整理頁面後再試。');
        return;
    }

    const content = buildDocumentHtml(data);
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <style>
        body {
            font-family: "微軟正黑體", "Microsoft JhengHei", sans-serif;
            font-size: 12pt;
            line-height: 1.7;
            color: #111;
        }
        h2  { font-size: 13pt; font-weight: bold; margin: 0 0 8pt; }
        p   { margin: 3pt 0; }
        img { max-width: 170mm; display: block; margin: 6pt 0; }
    </style>
</head>
<body>${content}</body>
</html>`;

    // 1134 twips ≈ 20mm（A4 標準邊距）
    const blob = htmlDocx.asBlob(fullHtml, {
        orientation: 'portrait',
        margins: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
    });

    triggerDownload(blob, `${data.sn}_最終商品文件.docx`);
}

// ----------------------------------------------------------------
// 七、PDF 產生（window.print 列印預覽）
// ----------------------------------------------------------------
async function generatePdf(data) {
    const content = buildDocumentHtml(data);
    const printWin = window.open('', '_blank', 'width=860,height=800');

    if (!printWin) {
        alert('請允許瀏覽器彈出視窗（popup），才能開啟列印預覽。');
        return;
    }

    printWin.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>${escHtml(data.sn)}_最終商品文件</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: "微軟正黑體", "Microsoft JhengHei", sans-serif;
            font-size: 12pt;
            line-height: 1.7;
            color: #111;
            width: 170mm;
            margin: 20mm auto;
            padding: 0;
        }
        h2  { font-size: 13pt; font-weight: bold; margin: 0 0 8pt; }
        p   { margin: 3pt 0; }
        img { max-width: 100%; display: block; margin: 6pt 0; }
        @media print {
            @page { size: A4; margin: 20mm; }
            body  { margin: 0; width: 100%; }
        }
    </style>
    
</head>
<body>${content}</body>
</html>`);

    printWin.document.close();
    setTimeout(() => {
        printWin.focus();
        printWin.print();
    }, 500);
}

// ----------------------------------------------------------------
// 八、建立文件 HTML 內容（Word 與 PDF 共用同一來源）
// ----------------------------------------------------------------
function buildDocumentHtml(data) {
    const ekiLine = data.eki
        ? `<p><strong>下限價格EKI：</strong>對任一連結標的而言，其期初價之 ${data.eki}%</p>`
        : '';

    const koTableBlock = (data.productType === 'STEPDOWN' && data.imgKo?.startsWith('data:'))
        ? `<img src="${data.imgKo}" style="max-width:100%;display:block;margin:8px 0;" />`
        : '';

    const couponBlock = data.productType === 'DAC'
        ? `<p>每月配息：於各交割日，發行機構將依下列計算公式以美元為計價單位給付：</p>
           <p>每月配息金額 = 商品面額 × 100% × <strong>${data.coupon}%</strong> × (1/12)（四捨五入至小數點後第 2 位）× (n/N)</p>
           <p>n = 所有連結標的之收盤價同時大於或等於其配息下層界線之觀察日天數</p>
           <p>N = 觀察期間的觀察日總數</p>
           <p><strong>配息觀察期間及配息交割日</strong></p>`
        : `<p>每月固定配息：於各交割日，發行機構將依下列計算公式以美元為計價單位給付：</p>
           <p>每月配息金額 = 每單位商品面額 × <strong>${data.coupon}%</strong>（即年利率 ${data.coupon}%）</p>
           <p><strong>觀察期間及配息交割日：</strong></p>`;

    return `
        <h2>${escHtml(buildTitle(data))}</h2>
        <p><strong>期初價：</strong>對任一連結標的而言，其交易日之價格。</p>
        <p><strong>記憶式自動提前出場價：</strong>對任一連結標的而言，其期初價 ${data.ko}%。</p>
        <p><strong>執行價(轉換價)：</strong>對任一連結標的而言，其期初價之 ${data.strike}%。</p>
        ${ekiLine}
        <p><strong>連結標的：</strong></p>
        <img src="${data.imgStock}" style="max-width:100%;display:block;margin:8px 0;" />
        ${koTableBlock}
        <p><strong>商品年期：</strong>${parseInt(data.tenor)}個月（本商品發生記憶式自動提前出場事件除外）</p>
        <p><strong>交易日：</strong>${formatDate(data.tradeDate)}</p>
        <p><strong>發行日：</strong>${formatDate(data.issueDate)}</p>
        <p><strong>到期日：</strong>${formatDate(data.maturityDate)}</p>
        <p><strong>記憶式自動提前出場事件：</strong>${formatDate(data.koStartDate)}(含) 起至期末評價日 ${formatDate(data.finalValDate)}(含)</p>
        <p>當所有連結標的之收盤價都曾經大於或等於其自動出場觸發水準，則本商品滿足記憶式自動提前出場條款。</p>
        ${couponBlock}
        <img src="${data.imgSchedule}" style="max-width:100%;display:block;margin:8px 0;" />
        <p style="text-align:center;font-style:italic;margin-top:32px;color:#555;font-size:12px;">
            上述資料均節錄自附件「中文產品說明書」，僅供投資人參考使用。
        </p>`;
}

// ----------------------------------------------------------------
// 九、按鈕綁定
// ----------------------------------------------------------------
function bindFdButton(btnId, label, handler) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const data = getFdFormData();
        const err = validateFdForm(data);
        if (err) { alert(err); return; }
        btn.disabled = true;
        btn.textContent = '⏳ 產生中...';
        try {
            await handler(data);
        } catch (e) {
            console.error(e);
            alert(`產生失敗：${e.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    });
}

bindFdButton('fd-downloadWord', '⬇ 下載 Word', generateWord);
bindFdButton('fd-downloadPdf', '⬇ 下載 PDF', generatePdf);