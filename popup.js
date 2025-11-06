document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultsDiv = document.getElementById("results");

  analyzeBtn.addEventListener("click", async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "⏳ Analisando...";
    resultsDiv.innerHTML = "<p>Processando imagens, aguarde...</p>";

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const imageData = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: "getImages" }, (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response);
        });
      });

      if (!imageData || !imageData.imageUrls || imageData.imageUrls.length === 0) {
        resultsDiv.innerHTML = "<p>Nenhuma imagem sem 'alt' encontrada.</p>";
        return;
      }

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "analyzeImages", imageUrls: imageData.imageUrls },
          (res) => resolve(res)
        );
      });

      // ✅ Verifica se veio algo do background antes de acessar
      if (!response) {
        resultsDiv.innerHTML = "<p style='color:#f66;'>Sem resposta do background.</p>";
        return;
      }

      resultsDiv.innerHTML = "";

      if (response.success) {
        response.descriptions.forEach(item => {
          const div = document.createElement("div");
          div.innerHTML = `
            <p><strong>Imagem:</strong> ${item.url}</p>
            <p><em>Descrição:</em> ${item.description}</p>
            <hr>
          `;
          resultsDiv.appendChild(div);
        });
      } else {
        resultsDiv.innerHTML = `<p style="color:#f66;">Erro: ${response.error}</p>`;
      }

    } catch (err) {
      console.error(err);
      resultsDiv.innerHTML = `<p style="color:#f66;">Erro inesperado: ${err.message}</p>`;
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "🔍 Analisar Imagens";
    }
  });
});
