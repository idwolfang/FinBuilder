const API_URL = "https://finbuilder-api.onrender.com/api/price";

const quoteDateInput = document.querySelector("#quoteDate");
const fetchPriceButton = document.querySelector("#fetchPrice");
const priceStatus = document.querySelector("#priceStatus");
const generateQuoteButton = document.querySelector("#generateQuote");
const quotePreview = document.querySelector("#quotePreview");

// 取得燈箱相關元素
const modal = document.getElementById("previewModal");
const previewImg = document.getElementById("previewImg");
const closeModalBtn = document.getElementById("closeModal");
const downloadModalBtn = document.getElementById("downloadModal");

// 表單連動邏輯
const productTypeSelect = document.getElementById("productType");
const stepDownField = document.getElementById("stepDownField");
const koLabelText = document.getElementById("koLabelText");

productTypeSelect.addEventListener("change", function () {
    if (this.value === "FCN（固定配息）步階式出場") {
        stepDownField.style.display = "block";
        koLabelText.textContent = "起始 KO%";
    } else {
        stepDownField.style.display = "none";
        koLabelText.textContent = "KO %";
    }
});

if (fetchPriceButton) {
    fetchPriceButton.addEventListener("click", async () => {
        const checkedStocks = getCheckedStocks();
        if (checkedStocks.length === 0) {
            priceStatus.textContent = "請至少勾選一個連結標的。";
            return;
        }
        await fetchPricesForStocks(checkedStocks);
    });
}

// 點擊產生圖片 -> 啟動隱藏截圖 -> 顯示燈箱
generateQuoteButton.addEventListener("click", async () => {
    const checkedStocks = getCheckedStocks();

    if (checkedStocks.length === 0) {
        priceStatus.textContent = "請至少勾選一個連結標的。";
        return;
    }

    const form = getQuoteForm();
    if (!form) return;

    priceStatus.textContent = "正在抓取股價與產出報價單...";

    const priceResults = await fetchPricesForStocks(checkedStocks);
    if (!priceResults || priceResults.length === 0) return;

    // 將 HTML 繪製到畫面外的隱藏容器
    renderQuote(form, priceResults);

    // 稍微延遲讓 DOM 更新渲染完成
    setTimeout(async () => {
        const quoteCard = document.querySelector(".capture-area");
        if (!quoteCard) return;

        try {
            const canvas = await html2canvas(quoteCard, {
                backgroundColor: "#ffffff",
                scale: 2, // 確保圖片高解析度
            });

            const imageUrl = canvas.toDataURL("image/png");

            // 將圖片塞入燈箱並顯示
            previewImg.src = imageUrl;
            modal.classList.add("active");
            priceStatus.textContent = "報價圖片已產生，請於畫面上方預覽或下載。";

            // 綁定下載按鈕
            downloadModalBtn.onclick = () => {
                const link = document.createElement("a");
                link.href = imageUrl;
                link.download = `quote-${Date.now()}.png`;
                link.click();
            };

        } catch (error) {
            priceStatus.textContent = "產生圖片失敗，請重新整理後再試一次。";
        }
    }, 150);
});

// 關閉燈箱邏輯
closeModalBtn.addEventListener("click", () => {
    modal.classList.remove("active");
});
// 點擊暗色背景也能關閉
modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.classList.remove("active");
    }
});

function getCheckedStocks() {
    return Array.from(document.querySelectorAll('input[name="stock"]:checked')).map(
        (input) => ({
            symbol: input.value,
            name: input.dataset.name,
        })
    );
}

function getQuoteForm() {
    const strike = Number(document.querySelector("#strike").value);
    const ko = Number(document.querySelector("#ko").value);
    const coupon = Number(document.querySelector("#coupon").value);
    const eki = Number(document.querySelector("#eki").value);
    const stepDown = Number(document.querySelector("#stepDown").value) || 0;

    if (!strike || !ko || !coupon) {
        alert("請填寫完整的 Strike, KO, Coupon... 等參數");
        return;
    }

    return {
        productType: document.querySelector("#productType").value,
        tenor: document.querySelector("#tenor").value,
        currency: document.querySelector("#currency").value,
        strike,
        ko,
        stepDown,
        coupon,
        eki,
        koStart: document.querySelector("#koStart").value,
        memoryKo: document.querySelector("#memoryKo").value,
        issuer: document.querySelector("#issuer").value,
    };
}

async function fetchPricesForStocks(stocks) {
    const quoteDate = quoteDateInput.value;
    if (!quoteDate) {
        priceStatus.textContent = "請先選擇報價日期。";
        return null;
    }

    const results = [];
    try {
        for (const stock of stocks) {
            priceStatus.textContent = `正在抓取 ${stock.symbol} 前一交易日收盤價...`;
            const price = await getPreviousClosePrice(stock.symbol, quoteDate);
            results.push({ ...stock, ...price });
        }

        priceStatus.textContent = results
            .map(item => `${item.symbol} 參考進場價：${item.close}`)
            .join(" / ");
        return results;
    } catch (error) {
        priceStatus.textContent = error.message;
        return null;
    }
}

async function getPreviousClosePrice(symbol, quoteDate) {
    const url = `${API_URL}/${encodeURIComponent(symbol)}?date=${encodeURIComponent(quoteDate)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`抓不到 ${symbol} 資料，請確認 API 是否正常運作。`);
    const data = await response.json();
    return {
        tradeDate: data.tradeDate,
        close: Number(data.closePrice).toFixed(2),
    };
}

function renderQuote(form, priceResults) {
    const inputDate = document.querySelector("#quoteDate").value;
    const formattedDate = inputDate ? inputDate.replace(/-/g, '/') : '';

    // =========================================
    // 智慧色彩與文字判斷
    // =========================================
    let labelBgColor = "#fdebeb"; // 預設為淺粉紅 (對應 FCN、DAC)
    let memoryKoLabel = "Memory KO"; // 預設英文標籤

    if (form.productType.includes("步階式")) {
        labelBgColor = "#e3f2fd"; // 步階式切換為淺藍色
        memoryKoLabel = "KO period end"; // 步階式專屬英文替換
    }

    let koDisplayHTML = `${Number(form.ko).toFixed(2)}%`;
    if (form.productType === "FCN（固定配息）步階式出場") {
        const obsCount = parseInt(form.tenor);
        let koValues = [];
        for (let i = 0; i < obsCount; i++) {
            let currentVal = form.ko - (i * form.stepDown);
            koValues.push(Number(currentVal).toFixed(2).replace(/\.00$/, '') + '%');
        }
        const itemsPerLine = 6;
        let groupedKo = [];
        for (let i = 0; i < koValues.length; i += itemsPerLine) {
            groupedKo.push(koValues.slice(i, i + itemsPerLine).join("、"));
        }
        koDisplayHTML = groupedKo.join("<br>");
    }

    // =========================================
    // EKI 動態顯示控制
    // 沒輸入 EKI(或 0)時:隱藏上半部 EKI 列 + 下半部 觸及生效價 整欄
    // 表格從 6 欄變 5 欄,table-layout:fixed 會自動把寬度重分給剩下 3 欄
    // =========================================
    const showEki = form.eki > 0;
    const valueColspan = showEki ? 4 : 3;
    const issuerColspan = showEki ? 6 : 5;

    const ekiRowHTML = showEki ? `
        <tr>
            <td class="label-en" style="background-color: ${labelBgColor};">EKI</td>
            <td class="label-zh" style="background-color: ${labelBgColor};">觸及生效價</td>
            <td colspan="${valueColspan}" class="value-highlight">${Number(form.eki).toFixed(2)}%</td>
        </tr>
    ` : '';

    const ekiHeaderHTML = showEki
        ? `<td class="label-zh" style="background-color: ${labelBgColor};">觸及生效價</td>`
        : '';

    const ekiSubHTML = showEki
        ? `<td class="val-sub">${Number(form.eki).toFixed(2)}%</td>`
        : '';

    const rows = priceResults.map((item) => {
        const referencePrice = Number(item.close);
        const strikePrice = referencePrice * (form.strike / 100);
        const koPrice = referencePrice * (form.ko / 100);

        const ekiPriceCell = showEki
            ? `<td class="num-val">${formatMoney(referencePrice * (form.eki / 100))}</td>`
            : '';

        return `
        <tr>
          <td colspan="2" class="stock-name"><strong>${item.symbol}</strong> ${item.name}</td>
          <td class="num-val">${formatMoney(referencePrice)}</td>
          ${ekiPriceCell}
          <td class="num-val">${formatMoney(strikePrice)}</td>
          <td class="num-val">${formatMoney(koPrice)}</td>
        </tr>
        `;
    }).join("");

    // 處理發行機構，若選為 "-" 則不顯示
    const issuerText = form.issuer !== "-" ? form.issuer : "";

    quotePreview.innerHTML = `
    <div class="capture-area">
        <table class="modern-quote-table">
            <tbody>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">Type</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">類型</td>
                    <td colspan="${valueColspan}" class="value-highlight">${form.productType}</td>
                </tr>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">Tenor</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">天期</td>
                    <td colspan="${valueColspan}" class="value-highlight">${form.tenor}</td>
                </tr>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">Strike</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">預計執行價</td>
                    <td colspan="${valueColspan}" class="value-highlight">${Number(form.strike).toFixed(2)}%</td>
                </tr>
                ${ekiRowHTML}
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">KO</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">出場價</td>
                    <td colspan="${valueColspan}" class="value-highlight" style="line-height: 1.5;">${koDisplayHTML}</td>
                </tr>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">Coupon</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">年化報酬率</td>
                    <td colspan="${valueColspan}" class="value-highlight">${Number(form.coupon).toFixed(2)}%</td>
                </tr>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">KO Start</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">閉鎖</td>
                    <td colspan="${valueColspan}" class="value-highlight">${form.koStart}</td>
                </tr>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">${memoryKoLabel}</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">記憶式</td>
                    <td colspan="${valueColspan}" class="value-highlight">${form.memoryKo}</td>
                </tr>
                <tr>
                    <td class="label-en" style="background-color: ${labelBgColor};">Currency</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">幣別</td>
                    <td colspan="${valueColspan}" class="value-highlight">${form.currency}</td>
                </tr>
                <tr>
                    <td colspan="${issuerColspan}" class="issuer-title" style="background-color: ${labelBgColor};">發行機構：${issuerText}</td>
                </tr>
            </tbody>
            
            <tbody class="bottom-section">
                <tr>
                    <td colspan="2" rowspan="2" class="label-zh align-middle" style="background-color: ${labelBgColor};">連結標的</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">參考進場價</td>
                    ${ekiHeaderHTML}
                    <td class="label-zh" style="background-color: ${labelBgColor};">預計執行價</td>
                    <td class="label-zh" style="background-color: ${labelBgColor};">提前出場價</td>
                </tr>
                <tr>
                    <td class="val-sub">${formattedDate}</td>
                    ${ekiSubHTML}
                    <td class="val-sub">${Number(form.strike).toFixed(2)}%</td>
                    <td class="val-sub">${Number(form.ko).toFixed(2)}%</td>
                </tr>
                ${rows}
            </tbody>
        </table>
    </div>
  `;
}

function formatMoney(value) {
    return Number(value).toFixed(2);
}

window.addEventListener("DOMContentLoaded", () => {
    const quoteDateInput = document.getElementById("quoteDate");
    if (quoteDateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        quoteDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
});