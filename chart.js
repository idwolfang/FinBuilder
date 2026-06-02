const CHART_API_URL = "https://finbuilder-api.onrender.com/api/history";

let chartStocks = [];      // 所有勾選的標的
let chartCurrentIndex = 0; // 目前顯示第幾個
let chartStrike = 0;
let chartKo = 0;

async function generateChartForStock(symbol, name, strikePercent, koPercent) {

    // 抓歷史資料
    const res = await fetch(`${CHART_API_URL}/${symbol}`);
    if (!res.ok) throw new Error(`無法取得 ${symbol} 歷史資料`);
    const data = await res.json();

    const dates = data.map(d => d.date);
    const closes = data.map(d => d.close);
    const vols = data.map(d => d.volume);
    const colors = data.map((d, i) =>
        d.close >= (i > 0 ? data[i - 1].close : d.open) ? "#e05c5c" : "#4caf7d"
    );

    const lastClose = closes[closes.length - 1];
    const REF_ENTRY = lastClose;
    const REF_STRIKE = Math.round(REF_ENTRY * (strikePercent / 100) * 100) / 100;
    const REF_KO = Math.round(REF_ENTRY * (koPercent / 100) * 100) / 100;

    const traceLine = {
        x: dates, y: closes,
        type: "scatter", mode: "lines",
        name: `${symbol} ${name}`,
        line: { color: "#e05c5c", width: 2 }
    };

    const makeHLine = (y, label, color, dash) => ({
        x: [dates[0], dates[dates.length - 1]],
        y: [y, y],
        type: "scatter", mode: "lines",
        name: label,
        line: { color, dash, width: 1.5 },
        xaxis: "x", yaxis: "y"
    });

    const traceVol = {
        x: dates, y: vols,
        type: "bar", name: "成交量",
        marker: { color: colors },
        xaxis: "x", yaxis: "y2"
    };

    const layout = {
        title: { text: `${symbol} ${name}`, font: { size: 16 } },
        grid: { rows: 2, columns: 1, subplots: [["xy"], ["xy2"]], roworder: "top to bottom" },
        xaxis: { domain: [0, 1], showgrid: true, gridcolor: "#eee" },
        yaxis: { domain: [0.3, 1], title: "Price (USD)", showgrid: true, gridcolor: "#eee" },
        yaxis2: { domain: [0, 0.25], title: "Volume", showgrid: false },
        legend: { x: 0, y: 1, bgcolor: "rgba(255,255,255,0.8)", borderwidth: 1 },
        margin: { t: 50, r: 80, b: 40, l: 60 },
        annotations: [{
            x: dates[dates.length - 1], y: lastClose,
            xref: "x", yref: "y",
            text: `${lastClose}`,
            showarrow: false,
            font: { color: "#e05c5c", size: 12 },
            xanchor: "left", xshift: 5
        }],
        plot_bgcolor: "#fff",
        paper_bgcolor: "#fff"
    };

    const container = document.getElementById("chartContainer");

    Plotly.newPlot(container, [
        traceLine,
        makeHLine(REF_ENTRY, `參考進場價(${REF_ENTRY})`, "#e05c5c", "dash"),
        makeHLine(REF_STRIKE, `執行價${strikePercent}%(${REF_STRIKE})`, "#e8a020", "dash"),
        makeHLine(REF_KO, `出場價${koPercent}%(${REF_KO})`, "#8e44ad", "dash"),
        traceVol
    ], layout, { responsive: true });

    // 更新換頁按鈕狀態
    document.getElementById("chartPrev").style.display = chartCurrentIndex > 0 ? "inline-block" : "none";
    document.getElementById("chartNext").style.display = chartCurrentIndex < chartStocks.length - 1 ? "inline-block" : "none";
    document.getElementById("chartPageInfo").textContent = chartStocks.length > 1
        ? `${chartCurrentIndex + 1} / ${chartStocks.length}`
        : "";
}

function bindChartButton() {
    const btn = document.getElementById("generateChart");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const checkedStocks = Array.from(
            document.querySelectorAll('input[name="stock"]:checked')
        ).map(el => ({ symbol: el.value, name: el.dataset.name }));

        if (checkedStocks.length === 0) {
            document.getElementById("priceStatus").textContent = "請至少勾選一個連結標的。";
            return;
        }

        const strike = Number(document.getElementById("strike").value);
        const ko = Number(document.getElementById("ko").value);

        if (!strike || !ko) {
            alert("請先填寫 Strike % 和 KO %");
            return;
        }

        // 存到全域，換頁時用
        chartStocks = checkedStocks;
        chartCurrentIndex = 0;
        chartStrike = strike;
        chartKo = ko;

        // 顯示燈箱
        document.getElementById("chartModal").classList.add("active");

        try {
            await generateChartForStock(
                chartStocks[0].symbol,
                chartStocks[0].name,
                chartStrike,
                chartKo
            );
        } catch (e) {
            alert(e.message);
        }
    });

    // 上一檔
    document.getElementById("chartPrev").addEventListener("click", async () => {
        if (chartCurrentIndex > 0) {
            chartCurrentIndex--;
            await generateChartForStock(
                chartStocks[chartCurrentIndex].symbol,
                chartStocks[chartCurrentIndex].name,
                chartStrike, chartKo
            );
        }
    });

    // 下一檔
    document.getElementById("chartNext").addEventListener("click", async () => {
        if (chartCurrentIndex < chartStocks.length - 1) {
            chartCurrentIndex++;
            await generateChartForStock(
                chartStocks[chartCurrentIndex].symbol,
                chartStocks[chartCurrentIndex].name,
                chartStrike, chartKo
            );
        }
    });

    // 下載圖片
    document.getElementById("chartDownload").addEventListener("click", () => {
        const symbol = chartStocks[chartCurrentIndex].symbol;
        Plotly.downloadImage("chartContainer", {
            format: "png",
            width: 1200,
            height: 700,
            filename: `${symbol}-chart`
        });
    });

    // 關閉燈箱
    document.getElementById("closeChartModal").addEventListener("click", () => {
        document.getElementById("chartModal").classList.remove("active");
    });
    document.getElementById("chartModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("chartModal"))
            document.getElementById("chartModal").classList.remove("active");
    });
}

bindChartButton();