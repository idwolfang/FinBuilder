const CHART_API_URL = "https://finbuilder-api.onrender.com/api/history";

let chartStocks = [];      // 所有勾選的標的
let chartCurrentIndex = 0; // 目前顯示第幾個
let chartStrike = 0;
let chartKo = 0;

async function generateChartForStock(symbol, name, strikePercent, koPercent) {

    // 抓歷史資料
    const tradeDate = window._lastPriceResults?.find(r => r.symbol === symbol)?.tradeDate
        || window._lastPriceResults?.[0]?.tradeDate
        || '';
    const historyUrl = tradeDate
        ? `${CHART_API_URL}/${symbol}?endDate=${tradeDate}`
        : `${CHART_API_URL}/${symbol}`;
    const res = await fetch(historyUrl);

    if (!res.ok) throw new Error(`無法取得 ${symbol} 歷史資料`);
    const data = await res.json();

    const dates = data.map(d => d.date);
    const closes = data.map(d => d.close);
    const vols = data.map(d => d.volume);
    const colors = data.map((d, i) =>
        d.close >= (i > 0 ? data[i - 1].close : d.open) ? "#e05c5c" : "#4caf7d"
    );

    const lastClose = closes[closes.length - 1];
    const priceResult = window._lastPriceResults?.find(r => r.symbol === symbol);
    const REF_ENTRY = priceResult && Number(priceResult.close) > 0
        ? Number(priceResult.close)
        : lastClose;
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
        xaxis: "x", yaxis: "y2",
        showlegend: false
    };

    const layout = {
        title: { text: `${symbol} ${name}`, font: { size: 16 } },
        grid: { rows: 2, columns: 1, subplots: [["xy"], ["xy2"]], roworder: "top to bottom" },
        xaxis: { domain: [0, 1], showgrid: true, gridcolor: "#eee" },
        yaxis: { domain: [0.3, 1], title: "Price (USD)", showgrid: true, gridcolor: "#eee" },
        yaxis2: { domain: [0, 0.25], title: "Volume", showgrid: false },
        legend: { x: 0, y: 1, bgcolor: "rgba(255,255,255,0.8)", borderwidth: 1 },
        margin: { t: 50, r: 30, b: 40, l: 60 },
        annotations: [{
            x: dates[dates.length - 1], y: lastClose,
            xref: "x", yref: "y",
            text: `${lastClose}`,
            showarrow: false,
            font: { color: "#e05c5c", size: 12 },
            xanchor: "left", xshift: 10
        }],
        plot_bgcolor: "#fff",
        paper_bgcolor: "#fff"
    };

    // 用隱藏的 div 產生 Plotly 圖，再轉成靜態圖片
    const tempDiv = document.createElement("div");
    tempDiv.style.cssText = "position:fixed; left:-9999px; top:0; width:900px; height:500px;";
    document.body.appendChild(tempDiv);

    await Plotly.newPlot(tempDiv, [
        traceLine,
        makeHLine(REF_ENTRY, `參考進場價(${REF_ENTRY})`, "#e05c5c", "dash"),
        makeHLine(REF_STRIKE, `執行價${strikePercent}%(${REF_STRIKE})`, "#e8a020", "dash"),
        makeHLine(REF_KO, `出場價${koPercent}%(${REF_KO})`, "#8e44ad", "dash"),
        traceVol
    ], layout, { responsive: false });

    const imgData = await Plotly.toImage(tempDiv, { format: "png", width: 900, height: 500 });
    document.body.removeChild(tempDiv);

    // 把圖片塞進燈箱
    document.getElementById("chartImg").src = imgData;

    // 更新換頁按鈕狀態
    document.getElementById("chartPrev").style.display = chartCurrentIndex > 0 ? "inline-block" : "none";
    document.getElementById("chartNext").style.display = chartCurrentIndex < chartStocks.length - 1 ? "inline-block" : "none";
    document.getElementById("chartPageInfo").textContent = chartStocks.length > 1
        ? `${chartCurrentIndex + 1} / ${chartStocks.length}`
        : "";

    // 儲存目前圖的資料供互動線圖用
    window._chartLastData = { symbol, name, strikePercent, koPercent, data };
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

    // 互動線圖：開新分頁
    document.getElementById("chartInteractive").addEventListener("click", () => {
        const d = window._chartLastData;
        if (!d) return;

        const dates = d.data.map(x => x.date);
        const closes = d.data.map(x => x.close);
        const vols = d.data.map(x => x.volume);
        const colors = d.data.map((x, i) =>
            x.close >= (i > 0 ? d.data[i - 1].close : x.open) ? "#e05c5c" : "#4caf7d"
        );
        const lastClose = closes[closes.length - 1];
        const priceResult = window._lastPriceResults?.find(r => r.symbol === d.symbol);
        const REF_ENTRY = priceResult && Number(priceResult.close) > 0
            ? Number(priceResult.close)
            : lastClose;
        const REF_STRIKE = Math.round(REF_ENTRY * (d.strikePercent / 100) * 100) / 100;
        const REF_KO = Math.round(REF_ENTRY * (d.koPercent / 100) * 100) / 100;

        const hLine = (y, label, color) => ({
            x: [dates[0], dates[dates.length - 1]], y: [y, y],
            type: "scatter", mode: "lines", name: label,
            line: { color: color, dash: "dash", width: 1.5 },
            xaxis: "x", yaxis: "y"
        });

        const traces = [
            {
                x: dates, y: closes,
                type: "scatter", mode: "lines",
                name: d.symbol + " " + d.name,
                line: { color: "#e05c5c", width: 2 }
            },
            hLine(REF_ENTRY, "參考進場價(" + REF_ENTRY + ")", "#e05c5c"),
            hLine(REF_STRIKE, "執行價" + d.strikePercent + "%(" + REF_STRIKE + ")", "#e8a020"),
            hLine(REF_KO, "出場價" + d.koPercent + "%(" + REF_KO + ")", "#8e44ad"),
            {
                x: dates, y: vols,
                type: "bar", name: "成交量",
                marker: { color: colors },
                xaxis: "x", yaxis: "y2",
                showlegend: false
            }
        ];

        const layout = {
            title: { text: d.symbol + " " + d.name, font: { size: 16 } },
            grid: { rows: 2, columns: 1, subplots: [["xy"], ["xy2"]], roworder: "top to bottom" },
            xaxis: { showgrid: true, gridcolor: "#eee" },
            yaxis: { domain: [0.3, 1], title: "Price (USD)", showgrid: true, gridcolor: "#eee" },
            yaxis2: { domain: [0, 0.25], title: "Volume", showgrid: false },
            legend: { x: 0, y: 1, bgcolor: "rgba(255,255,255,0.8)", borderwidth: 1 },
            margin: { t: 50, r: 30, b: 40, l: 60 },
            plot_bgcolor: "#fff", paper_bgcolor: "#fff"
        };

        const html = "<!DOCTYPE html><html><head>"
            + '<meta charset="UTF-8">'
            + "<title>" + d.symbol + " " + d.name + "</title>"
            + '<script src="https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.26.0/plotly.min.js"><' + "/script>"
            + '</head><body style="margin:0">'
            + '<div id="c" style="width:100%;height:100vh"></div>'
            + "<script>"
            + "Plotly.newPlot('c',"
            + JSON.stringify(traces) + ","
            + JSON.stringify(layout) + ","
            + "{responsive:true});"
            + "<" + "/script>"
            + "</body></html>";

        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
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