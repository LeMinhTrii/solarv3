// chặn f12

(function () {
  "use strict";

  const isEditable = (el) => {
    if (!el) return false;

    const tag = el.tagName?.toLowerCase();

    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      el.isContentEditable ||
      el.closest?.(
        "input, textarea, select, [contenteditable='true'], .allow-copy",
      )
    );
  };

  const blockEvent = (event) => {
    if (isEditable(event.target)) return;

    event.preventDefault();
    event.stopPropagation();

    return false;
  };

  // Chặn chuột phải
  document.addEventListener("contextmenu", blockEvent);

  // Chặn copy/cut/paste ngoài form
  document.addEventListener("copy", blockEvent);
  document.addEventListener("cut", blockEvent);
  document.addEventListener("paste", blockEvent);

  // Chặn bôi đen text
  document.addEventListener("selectstart", function (event) {
    if (isEditable(event.target)) return;
    event.preventDefault();
  });

  // Chặn kéo thả ảnh/text
  document.addEventListener("dragstart", blockEvent);

  // Chặn phím tắt mở devtools/source/save/print/copy
  document.addEventListener(
    "keydown",
    function (event) {
      const key = event.key.toLowerCase();
      const ctrlOrCmd = event.ctrlKey || event.metaKey;

      // F12
      if (event.key === "F12") {
        event.preventDefault();
        return false;
      }

      // Ctrl/Cmd + Shift + I/J/C/K
      if (ctrlOrCmd && event.shiftKey && ["i", "j", "c", "k"].includes(key)) {
        event.preventDefault();
        return false;
      }

      // Ctrl/Cmd + U/S/P
      if (ctrlOrCmd && ["u", "s", "p"].includes(key)) {
        event.preventDefault();
        return false;
      }

      // Ctrl/Cmd + C ngoài form
      if (ctrlOrCmd && key === "c" && !isEditable(event.target)) {
        event.preventDefault();
        return false;
      }
    },
    true,
  );
})();

(function () {
  let devtoolsOpen = false;

  const threshold = 160;

  setInterval(function () {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    const isOpen = widthDiff > threshold || heightDiff > threshold;

    if (isOpen && !devtoolsOpen) {
      devtoolsOpen = true;

      document.body.innerHTML = `
        <div style="
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: Arial, sans-serif;
          background: #f4f8f5;
          color: #123;
          padding: 24px;
        ">
          <div>
            <h2 style="color:#147a35;">Solar Green</h2>
            <p>Trang đang được bảo vệ nội dung.</p>
          </div>
        </div>
      `;
    }
  }, 800);
})();
