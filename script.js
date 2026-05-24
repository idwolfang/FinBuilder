// 原本的 STOOQ_PROXY_URL 刪除，改為指向你剛建好的 C# 伺服器
const API_URL = "https://finbuilder-api.onrender.com/api/price";

const quoteDateInput = document.querySelector("#quoteDate");
const fetchPriceButton = document.querySelector("#fetchPrice");
const priceStatus = document.querySelector("#priceStatus");
const generateQuoteButton = document.querySelector("#generateQuote");
const quotePreview = document.querySelector("#quotePreview");
const downloadQuoteButton = document.querySelector("#downloadQuote");

// =========================================
// 表單連動邏輯：控制「步階式出場」的專屬欄位顯示
// =========================================
const productTypeSelect = document.getElementById("productType");
const stepDownField = document.getElementById("stepDownField");
const koLabelText = document.getElementById("koLabelText");

productTypeSelect.addEventListener("change", function () {
    if (this.value === "FCN（固定配息）步階式出場") {
        // 如果是步階式，顯示遞減欄位，並更改 KO 標籤文字
        stepDownField.style.display = "block";
        koLabelText.textContent = "起始 KO%";
    } else {
        // 其他商品隱藏遞減欄位，恢復原本的 KO 標籤
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

generateQuoteButton.addEventListener("click", async () => {
    const checkedStocks = getCheckedStocks();

    if (checkedStocks.length === 0) {
        priceStatus.textContent = "請至少勾選一個連結標的。";
        return;
    }

    const form = getQuoteForm();

    if (!form) {
        return;
    }

    const priceResults = await fetchPricesForStocks(checkedStocks);

    if (!priceResults || priceResults.length === 0) {
        return;
    }

    renderQuote(form, priceResults);
    priceStatus.textContent = "報價表格已產生。";
});

downloadQuoteButton.addEventListener("click", async () => {
    const quoteCard = document.querySelector(".quote-card");

    if (!quoteCard) {
        priceStatus.textContent = "請先產生報價圖片。";
        return;
    }

    priceStatus.textContent = "正在產生 PNG 圖片...";

    try {
        const canvas = await html2canvas(quoteCard, {
            backgroundColor: "#ffffff",
            scale: 2,
        });

        const imageUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");

        link.href = imageUrl;
        link.download = `quote-${Date.now()}.png`;
        link.click();

        priceStatus.textContent = "PNG 圖片已下載。";
    } catch (error) {
        priceStatus.textContent = "產生圖片失敗，請重新整理後再試一次。";
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

    // 新增：抓取每月遞減數值 (如果沒填預設為 0)
    const stepDown = Number(document.querySelector("#stepDown").value) || 0;

    // 讓 EKI 不再是必填項目
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
        stepDown, // 新增：傳遞遞減數值
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

            results.push({
                ...stock,
                ...price,
            });
        }

        priceStatus.textContent = results
            .map(
                (item) =>
                    `${item.symbol} 參考日期：${item.tradeDate}，參考進場價：${item.close}`
            )
            .join(" / ");

        return results;
    } catch (error) {
        priceStatus.textContent = error.message;
        return null;
    }
}

// 2. 抓取股價的函式 (確保裡面使用的是 API_URL)
async function getPreviousClosePrice(symbol, quoteDate) {
    // 這裡要注意！一定要用上面定義的 API_URL
    const url = `${API_URL}/${encodeURIComponent(symbol)}?date=${encodeURIComponent(quoteDate)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`抓不到 ${symbol} 資料，請確認雲端 API 伺服器是否正常運作。`);
    }

    const data = await response.json();

    return {
        tradeDate: data.tradeDate,
        close: Number(data.closePrice).toFixed(2),
    };
}

function parseStooqCsv(csvText) {
    const cleanText = csvText.trim();

    if (
        !cleanText ||
        cleanText.includes("No data") ||
        cleanText.includes("Get your apikey") ||
        cleanText.includes("Missing symbol")
    ) {
        return [];
    }

    const lines = cleanText.split(/\r?\n/);

    if (lines.length <= 1) {
        return [];
    }

    return lines
        .slice(1)
        .map((line) => {
            const [date, open, high, low, close, volume] = line.trim().split(",");

            return {
                date,
                open,
                high,
                low,
                close,
                volume,
            };
        })
        .filter((row) => row.date && row.close && !Number.isNaN(Number(row.close)));
}

function renderQuote(form, priceResults) {
    // 【修正點 2】：參考進場日期改為直接讀取網頁畫面上「當下選擇的日期」
    const inputDate = document.querySelector("#quoteDate").value;
    const formattedDate = inputDate ? inputDate.replace(/-/g, '/') : '';

    // =========================================
    // 智慧運算：「步階式出場」的 KO 顯示字串
    // =========================================
    let koDisplayHTML = `${Number(form.ko).toFixed(2)}%`; // 預設顯示單一數值

    // 支援你修正後的精簡版名稱 "FCN（固定配息）步階式出場"
    if (form.productType === "FCN（固定配息）步階式出場") {
        const obsCount = parseInt(form.tenor);

        let koValues = [];
        for (let i = 0; i < obsCount; i++) {
            let currentVal = form.ko - (i * form.stepDown);
            koValues.push(Number(currentVal).toFixed(2).replace(/\.00$/, '') + '%');
        }

        // 【修正點 3】：固定以 6 個為一組進行換行
        const itemsPerLine = 6;
        let groupedKo = [];
        for (let i = 0; i < koValues.length; i += itemsPerLine) {
            groupedKo.push(koValues.slice(i, i + itemsPerLine).join("、"));
        }
        koDisplayHTML = groupedKo.join("<br>");
    }

    // 1. 產生下方股票資料的 HTML
    const rows = priceResults.map((item) => {
        const referencePrice = Number(item.close);
        const ekiPriceText = form.eki > 0 ? formatMoney(referencePrice * (form.eki / 100)) : "-";
        const strikePrice = referencePrice * (form.strike / 100);
        const koPrice = referencePrice * (form.ko / 100);

        return `
        <tr>
          <td colspan="2" class="stock-name"><strong>${item.symbol} </strong> ${item.name}</td>
          <td class="num-val">${formatMoney(referencePrice)}</td>
          <td class="num-val">${ekiPriceText}</td>
          <td class="num-val">${formatMoney(strikePrice)}</td>
          <td class="num-val">${formatMoney(koPrice)}</td>
        </tr>
        `;
    }).join("");

    // 處理發行機構顯示文字
    const issuerText = form.issuer !== "--選擇--" ? form.issuer : "";

    // 2. 將精準排版的 Table 塞入網頁中
    quotePreview.innerHTML = `
    <div id="capture-area" class="quote-card">
        <table class="modern-quote-table">
            <tbody>
                <tr>
                    <td class="label-en">Type</td>
                    <td class="label-zh">類型</td>
                    <td colspan="4" class="value-highlight">${form.productType}</td>
                </tr>
                <tr>
                    <td class="label-en">Tenor</td>
                    <td class="label-zh">天期</td>
                    <td colspan="4" class="value-highlight">${form.tenor}</td>
                </tr>
                <tr>
                    <td class="label-en">Strike</td>
                    <td class="label-zh">預計執行價</td>
                    <td colspan="4" class="value-highlight">${Number(form.strike).toFixed(2)}%</td>
                </tr>
                <tr>
                    <td class="label-en">EKI</td>
                    <td class="label-zh">觸及生效價</td>
                    <td colspan="4" class="value-highlight">${form.eki > 0 ? Number(form.eki).toFixed(2) + '%' : '-'}</td>
                </tr>
                <tr>
                    <td class="label-en">KO</td>
                    <td class="label-zh">出場價</td>
                    <td colspan="4" class="value-highlight" style="line-height: 1.5;">${koDisplayHTML}</td>
                </tr>
                <tr>
                    <td class="label-en">Coupon</td>
                    <td class="label-zh">年化報酬率</td>
                    <td colspan="4" class="value-highlight">${Number(form.coupon).toFixed(2)}%</td>
                </tr>
                <tr>
                    <td class="label-en">KO Start</td>
                    <td class="label-zh">閉鎖</td>
                    <td colspan="4" class="value-highlight">${form.koStart}</td>
                </tr>
                <tr>
                    <td class="label-en">Memory KO</td>
                    <td class="label-zh">記憶式</td>
                    <td colspan="4" class="value-highlight">${form.memoryKo}</td>
                </tr>
                <tr>
                    <td class="label-en">Currency</td>
                    <td class="label-zh">幣別</td>
                    <td colspan="4" class="value-highlight">${form.currency}</td>
                </tr>

                <tr>
                    <td colspan="6" class="issuer-title" style="background-color: #fff1f2; text-align: left !important; padding-left: 20px !important;">發行機構：${issuerText}</td>
                </tr>

            </tbody>
            
            <tbody class="bottom-section">
                <tr>
                    <td colspan="2" rowspan="2" class="label-zh align-middle">連結標的</td>
                    <td class="label-zh">參考進場價</td>
                    <td class="label-zh">觸及生效價</td>
                    <td class="label-zh">預計執行價</td>
                    <td class="label-zh">提前出場價</td>
                </tr>
                <tr>
                    <td class="val-sub">${formattedDate}</td>
                    <td class="val-sub">${form.eki > 0 ? Number(form.eki).toFixed(2) + '%' : '-'}</td>
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

function formatPercent(value) {
    return `${Number(value).toFixed(2)}%`;
}

function formatDate(dateText) {
    return dateText.replaceAll("-", "/");
}

// =========================================
// 頁面初始化：自動將報價日期預設為今天
// =========================================
window.addEventListener("DOMContentLoaded", () => {
    const quoteDateInput = document.getElementById("quoteDate");
    if (quoteDateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        // 月份與日期若小於 10 要補 0，以符合 HTML date 欄位的 YYYY-MM-DD 格式
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');

        quoteDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
});