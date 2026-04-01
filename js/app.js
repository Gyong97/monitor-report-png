/* ============================================================
 *  app.js  —  상태 관리 · 렌더링 · 이벤트 · 편집
 * ============================================================ */

/* ===== 전역 상태 ===== */
let services = [];
let checks = [];
let serviceHealth = {};
let dragServiceIndex = null;
let dragCheckIndex = null;
let lastClickedCell = null;
let lastClickedService = null;
let lastServiceHealthCell = null;
let editingServiceIdx = null;
let editingCheckIdx = null;
let editingVerify = null;
let editMode = false;

const VERIFY_TEMPLATES = [
  "", "DB확인", "로그확인", "화면확인", "배치확인", "모니터링확인", "__custom__"
];

if (!Array.isArray(window.serviceHealthRows)) {
  window.serviceHealthRows = [
    { name: "서비스 정상 여부", result: {}, verify: "" }
  ];
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isServiceEmpty(service) {
  const healthEmpty = serviceHealthRows.every(row => (row.result && row.result[service]) !== "OK");
  const checksEmpty = checks.every(c => (c.result && c.result[service]) !== "OK");
  return healthEmpty && checksEmpty;
}

function isCheckEmpty(check) {
  return services.every(s => (check.result && check.result[s]) !== "OK");
}

function saveState() {
  localStorage.setItem("monitoring-state", JSON.stringify({
    services, checks, serviceHealth,
    serviceHealthRows: window.serviceHealthRows,
    process: processName.value
  }));
}

function loadState() {
  const s = localStorage.getItem("monitoring-state");
  if (!s) return;
  const d = JSON.parse(s);
  services = d.services || [];
  serviceHealth = d.serviceHealth || {};
  processName.value = d.process || "";
  checks = (d.checks || []).map(c => {
    const r = c.result || {};
    services.forEach(svc => { if (!r.hasOwnProperty(svc)) r[svc] = "NA"; });
    return { name: c.name || "", result: r, verify: c.verify || "" };
  });
  window.serviceHealthRows = Array.isArray(d.serviceHealthRows) && d.serviceHealthRows.length
    ? d.serviceHealthRows.map(r => {
        const rr = r.result || {};
        services.forEach(svc => { if (!rr.hasOwnProperty(svc)) rr[svc] = "NA"; });
        return { name: r.name || "", result: rr, verify: r.verify || "" };
      })
    : window.serviceHealthRows;
}

function toggleEditMode() {
  editMode = !editMode;
  const panel = document.getElementById("edit-panel");
  const btn = document.getElementById("toggleEditBtn");
  if (editMode) { panel.style.display = "block"; btn.textContent = "✔ 편집 완료"; }
  else { panel.style.display = "none"; btn.textContent = "✏ 편집 모드"; renderTable(); }
}

function addService() {
  services.push("");
  serviceHealthRows.forEach(row => { row.result[services[services.length - 1]] = "NA"; });
  drawServices(); saveState();
}

function renameService(i, v) { services[i] = v; serviceHealth[v] ??= "NA"; saveState(); }

function removeService(i) {
  const removed = services[i];
  services.splice(i, 1);
  delete serviceHealth[removed];
  serviceHealthRows.forEach(row => { delete row.result[removed]; });
  checks.forEach(c => delete c.result[removed]);
  drawServices(); drawChecks(); saveState();
}

function drawServices() {
  const d = document.getElementById("services"); d.innerHTML = "";
  services.forEach((s, i) => {
    d.innerHTML += `<div class="drag-item" draggable="true"
      ondragstart="dragServiceIndex=${i}" ondragover="event.preventDefault()"
      ondrop="dropService(${i})">
      <span class="drag-handle">☰</span>
      <input value="${s}" oninput="renameService(${i},this.value)" />
      <span class="remove-btn" onclick="removeService(${i})">✖</span></div>`;
  });
}

function dropService(t) {
  if (dragServiceIndex === null || dragServiceIndex === t) return;
  const m = services.splice(dragServiceIndex, 1)[0];
  services.splice(t, 0, m); drawServices(); saveState(); dragServiceIndex = null;
}

function addCheck() {
  const r = {}; services.forEach(s => r[s] = "NA");
  checks.push({ name: "", result: r, verify: "" }); drawChecks(); saveState();
}

function drawChecks() {
  const d = document.getElementById("checks"); d.innerHTML = "";
  checks.forEach((c, i) => {
    d.innerHTML += `<div class="drag-item">
      <span class="drag-handle">☰</span>
      <input value="${c.name}" placeholder="체크 항목명"
        oninput="checks[${i}].name=this.value; saveState();" />
      <span class="remove-btn" onclick="checks.splice(${i},1);drawChecks();saveState();">✖</span></div>`;
  });
}

function toggleServiceHealth(s) { serviceHealth[s] = (serviceHealth[s]==="OK")?"NA":"OK"; saveState(); renderTable(); }
function toggleCell(ci, s) { checks[ci].result[s] = (checks[ci].result[s]==="OK")?"NA":"OK"; saveState(); renderTable(); }

function handleCellClick(checkIdx, serviceIdx, isShift) {
  const service = services[serviceIdx]; if (!service) return;
  if (!isShift || !lastClickedCell) {
    checks[checkIdx].result[service] = (checks[checkIdx].result[service]==="OK")?"NA":"OK";
    lastClickedCell = { checkIdx, serviceIdx }; saveState(); renderTable(); return;
  }
  const r1=lastClickedCell.checkIdx, c1=lastClickedCell.serviceIdx, r2=checkIdx, c2=serviceIdx;
  const rowMin=Math.min(r1,r2), rowMax=Math.max(r1,r2), colMin=Math.min(c1,c2), colMax=Math.max(c1,c2);
  const targetValue = checks[r1].result[services[c1]];
  for (let r=rowMin;r<=rowMax;r++) for (let c=colMin;c<=colMax;c++) {
    const s=services[c]; if (checks[r].result.hasOwnProperty(s)) checks[r].result[s]=targetValue;
  }
  lastClickedCell = { checkIdx, serviceIdx }; saveState(); renderTable();
}

function handleServiceHealthClick(serviceIdx, isShift) {
  const service = services[serviceIdx]; if (!service) return;
  if (!serviceHealth.hasOwnProperty(service)) serviceHealth[service]="NA";
  if (!isShift || !lastClickedService) {
    serviceHealth[service] = (serviceHealth[service]==="OK")?"NA":"OK";
    lastClickedService = { serviceIdx }; saveState(); renderTable(); return;
  }
  const c1=lastClickedService.serviceIdx, c2=serviceIdx;
  const colMin=Math.min(c1,c2), colMax=Math.max(c1,c2);
  const targetValue = serviceHealth[services[c1]] || "NA";
  for (let c=colMin;c<=colMax;c++) serviceHealth[services[c]]=targetValue;
  lastClickedService = { serviceIdx }; saveState(); renderTable();
}

function handleServiceHealthCellClick(rowIdx, serviceIdx, isShift) {
  const row=serviceHealthRows[rowIdx], service=services[serviceIdx];
  if (!row || !service) return;
  if (!row.result) row.result = {};
  if (!row.result.hasOwnProperty(service)) row.result[service]="NA";
  if (!isShift || !lastServiceHealthCell) {
    row.result[service] = (row.result[service]==="OK")?"NA":"OK";
    lastServiceHealthCell = { rowIdx, serviceIdx }; saveState(); renderTable(); return;
  }
  const r1=lastServiceHealthCell.rowIdx, c1=lastServiceHealthCell.serviceIdx;
  const rowMin=Math.min(r1,rowIdx), rowMax=Math.max(r1,rowIdx);
  const colMin=Math.min(c1,serviceIdx), colMax=Math.max(c1,serviceIdx);
  const targetValue = serviceHealthRows[r1].result[services[c1]] || "NA";
  for (let r=rowMin;r<=rowMax;r++) for (let c=colMin;c<=colMax;c++) {
    if (!serviceHealthRows[r].result) serviceHealthRows[r].result={};
    serviceHealthRows[r].result[services[c]]=targetValue;
  }
  lastServiceHealthCell = { rowIdx, serviceIdx }; saveState(); renderTable();
}

function addServiceHealthRow() {
  const name = prompt("서버 이름을 입력하세요 (예: A서버, B서버)"); if (!name) return;
  if (serviceHealthRows.some(r => r.name===name)) { alert("이미 존재하는 서버명입니다."); return; }
  const result = {}; services.forEach(s => { result[s]="NA"; });
  serviceHealthRows.push({ name, result, verify: "로그확인" }); saveState(); renderTable();
}

function removeServiceHealthRow(rowIdx) {
  const row = serviceHealthRows[rowIdx]; if (!row) return;
  if (row.name==="서비스 정상 여부") { alert("기본 서비스 정상 여부 행은 삭제할 수 없습니다."); return; }
  if (!confirm(`'${row.name}' 서버를 삭제할까요?`)) return;
  serviceHealthRows.splice(rowIdx, 1); saveState(); renderTable();
}

function resetServiceHealthRows() {
  if (!confirm("서버 정상 여부를 초기화할까요?\n(서버 항목이 모두 제거됩니다)")) return;
  serviceHealthRows = [{ name: "서비스 정상 여부", result: {}, verify: "" }];
  services.forEach(s => { serviceHealthRows[0].result[s]="NA"; }); saveState(); renderTable();
}

function removeServiceFromTable(serviceIdx) {
  if (!confirm("이 서비스를 삭제할까요?")) return;
  const removed = services[serviceIdx]; services.splice(serviceIdx, 1);
  serviceHealthRows.forEach(row => { delete row.result[removed]; });
  checks.forEach(c => delete c.result[removed]); saveState(); renderTable();
}

function removeCheckFromTable(checkIdx) {
  if (!confirm("이 체크 항목을 삭제할까요?")) return;
  checks.splice(checkIdx, 1); saveState(); renderTable();
}

function addServiceFromTable() {
  services.push("");
  serviceHealthRows.forEach(row => { row.result[services[services.length-1]]="NA"; });
  checks.forEach(c => { c.result[services[services.length-1]]="NA"; });
  editingServiceIdx = services.length - 1; saveState(); renderTable();
  requestAnimationFrame(() => {
    document.querySelector(`input.service-edit[data-service-idx="${editingServiceIdx}"]`)?.focus();
  });
}

function addCheckFromTable() {
  const result = {}; services.forEach(s => result[s]="NA");
  checks.push({ name: "", result, verify: "로그확인" });
  editingCheckIdx = checks.length - 1; saveState(); renderTable();
  requestAnimationFrame(() => {
    document.querySelector(`input.inline-edit[data-check-idx="${editingCheckIdx}"]`)?.focus();
  });
}

function renameServiceInline(serviceIdx, newName) {
  const oldName = services[serviceIdx]; newName = newName.trim(); editingServiceIdx = null;
  if (!newName || newName===oldName) { renderTable(); return; }
  if (services.includes(newName)) { alert("이미 존재하는 서비스명입니다."); renderTable(); return; }
  services[serviceIdx] = newName;
  serviceHealthRows.forEach(row => {
    if (row.result?.hasOwnProperty(oldName)) { row.result[newName]=row.result[oldName]; delete row.result[oldName]; }
  });
  checks.forEach(c => {
    if (c.result?.hasOwnProperty(oldName)) { c.result[newName]=c.result[oldName]; delete c.result[oldName]; }
  });
  saveState(); renderTable();
}

function editServiceName(serviceIdx) {
  const oldName = services[serviceIdx]; if (!oldName) return;
  const newName = prompt("서비스명을 수정하세요", oldName);
  if (!newName || newName===oldName) return;
  if (services.includes(newName)) { alert("이미 존재하는 서비스명입니다."); return; }
  services[serviceIdx] = newName;
  serviceHealthRows.forEach(row => { if (row.result?.hasOwnProperty(oldName)) { row.result[newName]=row.result[oldName]; delete row.result[oldName]; } });
  checks.forEach(c => { if (c.result?.hasOwnProperty(oldName)) { c.result[newName]=c.result[oldName]; delete c.result[oldName]; } });
  saveState(); renderTable();
}

function editCheckName(checkIdx) {
  const check = checks[checkIdx]; if (!check) return;
  const newName = prompt("체크 항목명을 수정하세요", check.name||"");
  if (!newName || newName===(check.name||"")) return;
  check.name = newName; saveState(); renderTable();
}

function renderVerifyEditor(type, idx, value) {
  const templates = ["DB확인","로그확인","화면확인","배치확인","모니터링확인"];
  const isTemplate = templates.includes(value);
  const selectedValue = isTemplate ? value : (value ? "__custom__" : "");
  const customValue = isTemplate ? "" : value;
  return `<div class="verify-editor" onclick="event.stopPropagation()">
    <select class="verify-select" data-vtype="${type}" data-vidx="${idx}" onchange="handleVerifyTemplateChange(this)">
      <option value="">선택</option>
      <option value="DB확인" ${selectedValue==="DB확인"?"selected":""}>DB확인</option>
      <option value="로그확인" ${selectedValue==="로그확인"?"selected":""}>로그확인</option>
      <option value="화면확인" ${selectedValue==="화면확인"?"selected":""}>화면확인</option>
      <option value="배치확인" ${selectedValue==="배치확인"?"selected":""}>배치확인</option>
      <option value="모니터링확인" ${selectedValue==="모니터링확인"?"selected":""}>모니터링확인</option>
      <option value="__custom__" ${selectedValue==="__custom__"?"selected":""}>직접입력</option>
    </select>
    <textarea class="verify-input verify-edit" data-vtype="${type}" data-vidx="${idx}"
      ${selectedValue==="__custom__"?"":"disabled"}
      placeholder="직접 입력 (Shift+Enter 줄바꿈)">${escapeHtml(customValue)}</textarea></div>`;
}

function startVerifyEdit(type, idx) {
  editingVerify = { type, idx }; renderTable();
  requestAnimationFrame(() => {
    document.querySelector(`select.verify-select[data-vtype="${type}"][data-vidx="${idx}"]`)?.focus();
  });
}

function handleVerifyTemplateChange(selectEl) {
  const type=selectEl.dataset.vtype, idx=Number(selectEl.dataset.vidx);
  const input = selectEl.closest(".verify-editor")?.querySelector(".verify-input");
  if (!input) return;
  if (selectEl.value==="__custom__") { input.disabled=false; input.focus(); input.select(); return; }
  input.value=""; input.disabled=true; commitVerify(type, idx, selectEl.value);
}

function commitVerify(type, idx, val) {
  const v = (val||"").trim();
  if (type==="check") { if (!checks[idx]) return; checks[idx].verify=v; }
  else if (type==="health") { if (!serviceHealthRows[idx]) return; serviceHealthRows[idx].verify=v; }
  else return;
  editingVerify=null; saveState(); renderTable();
}

function resetAll() {
  if (!confirm("모두 초기화할까요?")) return;
  services=[]; checks=[]; serviceHealth={}; processName.value="";
  localStorage.removeItem("monitoring-state"); drawServices(); drawChecks(); renderTable();
}
function resetServices() {
  if (!confirm("서비스만 초기화할까요?")) return;
  services=[]; serviceHealth={}; checks.forEach(c=>c.result={});
  saveState(); drawServices(); drawChecks(); renderTable();
}
function resetChecks() {
  if (!confirm("체크 항목만 초기화할까요?")) return;
  checks=[]; saveState(); drawChecks(); renderTable();
}

function renderTable(options = {}) {
  const isExport = options.forceHideEmpty === true;
  const hideService = isExport ? true : document.getElementById("hideEmptyService")?.checked;
  const hideCheck = isExport ? true : document.getElementById("hideEmptyCheck")?.checked;

  if (!Array.isArray(window.serviceHealthRows))
    window.serviceHealthRows = [{ name:"서비스 정상 여부", result:{}, verify:"" }];

  const visibleServices = hideService ? services.filter(s=>!isServiceEmpty(s)) : services;
  const visibleChecks = hideCheck ? checks.filter(c=>!isCheckEmpty(c)) : checks;
  const serviceIdxMap = visibleServices.map(s=>services.indexOf(s));
  const visibleHealthRows = serviceHealthRows.length===1
    ? serviceHealthRows : serviceHealthRows.filter(r=>r.name!=="서비스 정상 여부");

  const hasAddCol = !isExport;
  const totalCols = 1 + visibleServices.length + (hasAddCol?1:0) + 1;
  const svcColsForWidth = visibleServices.length + (hasAddCol?1:0);

  const previewEl = document.getElementById("preview");
  previewEl.style.setProperty("--svc-cols", String(Math.max(1, svcColsForWidth)));

  let html = `<div class="png-title">프로세스: ${escapeHtml(processName.value||"")}</div><table><tr><th>체크항목 \\ 서비스</th>`;

  visibleServices.forEach((s, visSi) => {
    const si = serviceIdxMap[visSi];
    html += `<th class="service-header" data-service-idx="${si}"><div class="service-header-label">
      ${editingServiceIdx===si
        ? `<input class="inline-edit service-edit" value="${escapeHtml(s)}" data-service-idx="${si}">`
        : `<span class="cell-text">${escapeHtml(s)}</span>`}
      ${!isExport?`<span class="cell-delete" onclick="removeServiceFromTable(${si})">✖</span>`:""}</div></th>`;
  });
  if (!isExport) html += `<th class="add-col"><button onclick="addServiceFromTable()">＋</button></th>`;
  html += `<th class="verify-col">검증방법</th></tr>`;

  visibleHealthRows.forEach((row, visRowIdx) => {
    const rowIdx = serviceHealthRows.indexOf(row);
    const isLast = visRowIdx === visibleHealthRows.length-1;
    const verifyText = row.verify||"";
    html += `<tr class="summary-row ${isLast?"section-end":""}"><td>${escapeHtml(row.name)}
      ${(!isExport&&row.name!=="서비스 정상 여부")?`<span class="remove-btn" onclick="removeServiceHealthRow(${rowIdx})">✖</span>`:""}</td>`;
    visibleServices.forEach((s,visSi) => {
      const si=serviceIdxMap[visSi], ok=row.result&&row.result[s]==="OK";
      html += `<td class="service-cell clickable ${ok?"status-ok":"status-na"}"
        onclick="handleServiceHealthCellClick(${rowIdx},${si},event.shiftKey)">${ok?"🟢":"–"}</td>`;
    });
    if (!isExport) html += `<td class="add-col"></td>`;
    html += `<td class="verify-col" ondblclick="startVerifyEdit('health',${rowIdx})">
      ${editingVerify?.type==="health"&&editingVerify?.idx===rowIdx
        ? renderVerifyEditor("health",rowIdx,verifyText)
        : `<span class="verify-text">${escapeHtml(verifyText)}</span>`}</td></tr>`;
  });

  html += `<tr class="section-header"><td colspan="${totalCols}">2️⃣ 변경 적용 상세 로직 점검 (아래부터 적용 로직)</td></tr>`;

  visibleChecks.forEach(check => {
    const ci=checks.indexOf(check), verifyText=check.verify||"";
    html += `<tr><td class="check-name" data-check-idx="${ci}"><div class="cell-wrap">
      ${editingCheckIdx===ci
        ? `<input class="inline-edit" value="${escapeHtml(check.name||"")}" data-check-idx="${ci}">`
        : `<span class="cell-text">${escapeHtml(check.name||"")}</span>`}
      ${!isExport?`<span class="cell-delete" onclick="removeCheckFromTable(${ci})">✖</span>`:""}</div></td>`;
    visibleServices.forEach((s,visSi) => {
      const si=serviceIdxMap[visSi], ok=check.result&&check.result[s]==="OK";
      html += `<td class="service-cell clickable ${ok?"status-ok":"status-na"}"
        onclick="handleCellClick(${ci},${si},event.shiftKey)">${ok?"🟢":"–"}</td>`;
    });
    if (!isExport) html += `<td class="add-col"></td>`;
    html += `<td class="verify-col" ondblclick="startVerifyEdit('check',${ci})">
      ${editingVerify?.type==="check"&&editingVerify?.idx===ci
        ? renderVerifyEditor("check",ci,verifyText)
        : `<span class="verify-text">${escapeHtml(verifyText)}</span>`}</td></tr>`;
  });

  if (!isExport) html += `<tr class="add-row"><td colspan="${totalCols}"><button onclick="addCheckFromTable()">＋ 체크 항목 추가</button></td></tr>`;
  html += `</table>`;
  previewEl.innerHTML = html;
}

/* 이벤트 리스너 */
document.addEventListener("keydown", (e) => {
  const input = e.target.closest("input.inline-edit, textarea.verify-input");
  const select = e.target.closest("select.verify-select");
  if (!input && !select) return;
  if (input && input.classList.contains("verify-edit")) {
    const vtype=input.dataset.vtype, vidx=Number(input.dataset.vidx);
    if (Number.isNaN(vidx)) return;
    if (e.key==="Enter"&&e.shiftKey) return;
    if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); commitVerify(vtype,vidx,input.value); return; }
    if (e.key==="Escape") { editingVerify=null; renderTable(); return; }
  }
  if (select && select.classList.contains("verify-select")) {
    const vtype=select.dataset.vtype, vidx=Number(select.dataset.vidx);
    if (Number.isNaN(vidx)) return;
    if (e.key==="Escape") { editingVerify=null; renderTable(); return; }
    if (e.key==="Enter"&&select.value!=="__custom__") { commitVerify(vtype,vidx,select.value); return; }
  }
  if (input && input.classList.contains("service-edit")) {
    const si=Number(input.dataset.serviceIdx); if (Number.isNaN(si)) return;
    if (e.key==="Enter") { renameServiceInline(si, input.value); return; }
    if (e.key==="Escape") { editingServiceIdx=null; renderTable(); return; }
  }
  if (input && !input.classList.contains("service-edit") && !input.classList.contains("verify-edit")) {
    const ci=Number(input.dataset.checkIdx); if (Number.isNaN(ci)) return;
    if (e.key==="Enter") { checks[ci].name=input.value.trim(); editingCheckIdx=null; saveState(); renderTable(); }
    if (e.key==="Escape") { editingCheckIdx=null; renderTable(); }
  }
});

document.addEventListener("blur", (e) => {
  const input = e.target.closest("input.inline-edit, textarea.verify-input");
  if (!input) return;
  if (input.classList.contains("service-edit")) {
    const si=Number(input.dataset.serviceIdx);
    if (!Number.isNaN(si)) renameServiceInline(si, input.value); return;
  }
  if (input.classList.contains("verify-edit")) return;
  const ci=Number(input.dataset.checkIdx);
  if (!Number.isNaN(ci)) { checks[ci].name=input.value.trim(); editingCheckIdx=null; saveState(); renderTable(); }
}, true);

document.addEventListener("dblclick", (e) => {
  const th = e.target.closest("th.service-header");
  if (th) {
    const si=Number(th.dataset.serviceIdx);
    if (!Number.isNaN(si)) { editingServiceIdx=si; renderTable();
      requestAnimationFrame(()=>{ const i=document.querySelector(`input.service-edit[data-service-idx="${si}"]`); i?.focus(); i?.select(); });
    } return;
  }
  const td = e.target.closest("td.check-name");
  if (td) {
    const ci=Number(td.dataset.checkIdx);
    if (!Number.isNaN(ci)) { editingCheckIdx=ci; renderTable();
      requestAnimationFrame(()=>{ const i=document.querySelector(`input.inline-edit[data-check-idx="${ci}"]`); i?.focus(); i?.select(); });
    }
  }
});

document.addEventListener("input", (e) => {
  if (e.target.classList.contains("verify-input")) { e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }
});

loadState(); drawServices(); drawChecks(); renderTable();
