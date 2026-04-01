/* preset.js — 프리셋 가져오기 / 내보내기 */

function exportPreset() {
  const name = prompt("내보낼 파일명:", processName.value || "monitoring_preset");
  if (!name) return;
  const data = {
    version: 2, services, serviceHealth,
    serviceHealthRows: window.serviceHealthRows,
    checks: checks.map(c => ({ name: c.name, verify: c.verify || "" }))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[\\/:*?"<>| ]+/g, "_")}.json`;
  a.click();
}

function importPreset() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json";
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.services) || !Array.isArray(data.checks)) { alert("올바른 프리셋 파일이 아닙니다."); return; }
        services = [...data.services];
        serviceHealth = data.serviceHealth || {};
        if (Array.isArray(data.serviceHealthRows) && data.serviceHealthRows.length) {
          window.serviceHealthRows = data.serviceHealthRows.map(r => ({ name: r.name||"", result: r.result||{}, verify: r.verify||"" }));
        } else {
          window.serviceHealthRows = window.serviceHealthRows || [{ name:"서비스 정상 여부", result:{}, verify:"" }];
        }
        checks = data.checks.map(c => { const r={}; services.forEach(s=>r[s]="NA"); return { name:c.name, result:r, verify:c.verify||"" }; });
        saveState(); drawServices(); drawChecks(); renderTable();
      } catch (err) { console.error(err); alert("프리셋 파일을 불러오는 중 오류가 발생했습니다."); }
    };
    reader.readAsText(file, "utf-8");
  };
  input.click();
}
