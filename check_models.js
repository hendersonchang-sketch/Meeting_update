// check_models.js

// 請將您的 API Key 填入下方，或確認環境變數中有設定
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCJle0WjlTIggYjfn5leBH_FWIqWrB2jdw";

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    console.log("正在連線 Google API 查詢模型列表...\n");

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("查詢失敗:", data.error.message);
            return;
        }

        if (!data.models) {
            console.log("沒有找到任何模型，請確認 API Key 是否正確。");
            return;
        }

        console.log(`${"模型名稱 (ID)".padEnd(40)} | ${"能力 (Capabilities)"}`);
        console.log("-".repeat(80));

        let hasImagen = false;

        data.models.forEach((model) => {
            // 去掉 'models/' 前綴，讓顯示更乾淨
            const name = model.name.replace("models/", "");
            const methods = model.supportedGenerationMethods.join(", ");

            console.log(`${name.padEnd(40)} | ${methods}`);

            if (name.includes("imagen")) {
                hasImagen = true;
            }
        });

        console.log("-".repeat(80));
        console.log("\n【診斷結果】：");
        if (hasImagen) {
            console.log("✅ 您的 API Key 支援 'imagen' (生圖模型)。您可以直接呼叫它來生圖！");
        } else {
            console.log("❌ 您的 API Key 清單中沒有看到 'imagen' 模型。");
            console.log("   這表示您目前的 API 權限只能做「文字/對話」，無法直接生圖。");
            console.log("   解決方案：您需要使用 Vertex AI (Google Cloud) 的 API 端點，而非 AI Studio。");
        }

    } catch (error) {
        console.error("發生錯誤:", error);
    }
}

listModels();