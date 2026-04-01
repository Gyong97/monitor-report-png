/* export-png.js — PNG 이미지 저장 */

function savePNG() {
  document.querySelectorAll(".hide-for-export").forEach(el => el.style.display = "none");
  renderTable({ forceHideEmpty: true });
  requestAnimationFrame(() => {
    const node = document.getElementById("preview");
    htmlToImage.toPng(node, { backgroundColor: "white", pixelRatio: 2 }).then(url => {
      const name = (processName.value || "monitoring").replace(/[\\/:*?"<>| ]+/g, "_")
        + "_" + new Date().toISOString().slice(0,10) + ".png";
      const a = document.createElement("a"); a.href = url; a.download = name; a.click();
      document.querySelectorAll(".hide-for-export").forEach(el => el.style.display = "");
      renderTable();
    });
  });
}
