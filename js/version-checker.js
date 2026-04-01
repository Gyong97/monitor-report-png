/* ============================================================
 *  version-checker.js  —  GitHub 기반 버전 체크 & 업데이트 알림
 *
 *  ✅ 사용법
 *  1. 새 버전 배포 시: 아래 APP_VERSION을 올리고,
 *     GitHub의 version.json도 동일하게 수정
 *  2. GITHUB_VERSION_URL을 실제 레포 주소로 변경
 * ============================================================ */

/* ---------- 설정 ---------- */
const APP_VERSION = "1.0.0";

const GITHUB_VERSION_URL =
  "https://raw.githubusercontent.com/Gyong97/monitor-report-png/main/version.json";
//  ↑ {user}와 {repo}를 실제 값으로 변경하세요

const VERSION_CHECK_TIMEOUT = 3000; // 3초 타임아웃

/* ---------- 페이지 로드 시 자동 실행 ---------- */
(async function checkForUpdate() {
  try {
    /* 1) GitHub에서 최신 version.json 가져오기 */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT);

    const res = await fetch(
      GITHUB_VERSION_URL + "?t=" + Date.now(), // 캐시 방지
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = await res.json();

    /* 2) 버전 비교 */
    if (!remote.version) throw new Error("version 필드 없음");

    if (isNewerVersion(remote.version, APP_VERSION)) {
      showUpdateBanner(remote);
    } else {
      console.log(
        `[version-checker] 최신 버전입니다 (로컬: v${APP_VERSION}, 원격: v${remote.version})`
      );
    }
  } catch (e) {
    /* 오프라인이거나 URL 미설정 → 조용히 무시 */
    console.log("[version-checker] 버전 확인 건너뜀:", e.message);
  }
})();

/* ---------- semver 비교 ---------- */
function isNewerVersion(remote, local) {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);

  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false; // 동일 버전
}

/* ---------- 업데이트 배너 표시 ---------- */
function showUpdateBanner(remote) {
  /* "이 버전 무시"를 눌렀으면 표시하지 않음 */
  const dismissed = localStorage.getItem("monitoring-dismissed-version");
  if (dismissed === remote.version) return;

  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.innerHTML = `
    <div class="update-banner-content">
      <div class="update-banner-icon">🔔</div>
      <div class="update-banner-text">
        <strong>새 버전(v${escapeHtml(remote.version)})이 있습니다!</strong>
        <span class="update-banner-date">${escapeHtml(remote.releaseDate || "")}</span>
        <p class="update-banner-notes">${escapeHtml(remote.releaseNotes || "")}</p>
      </div>
      <div class="update-banner-actions">
        <a class="update-btn update-btn-download"
           href="${escapeHtml(remote.downloadUrl || "#")}"
           target="_blank"
           rel="noopener noreferrer">
          📥 다운로드
        </a>
        <button class="update-btn update-btn-ignore"
                onclick="dismissVersion('${escapeHtml(remote.version)}')">
          이 버전 무시
        </button>
        <button class="update-btn update-btn-close"
                onclick="closeBanner()">
          ✕
        </button>
      </div>
    </div>
    <div class="update-banner-version-info">
      현재: v${APP_VERSION} → 최신: v${escapeHtml(remote.version)}
    </div>
  `;

  document.body.prepend(banner);
}

/* ---------- 배너 조작 ---------- */
function dismissVersion(version) {
  localStorage.setItem("monitoring-dismissed-version", version);
  closeBanner();
}

function closeBanner() {
  const banner = document.getElementById("update-banner");
  if (banner) banner.remove();
}

/* ---------- 현재 버전 푸터 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const footer = document.createElement("div");
  footer.className = "version-footer";
  footer.textContent = `v${APP_VERSION}`;
  document.body.appendChild(footer);
});
