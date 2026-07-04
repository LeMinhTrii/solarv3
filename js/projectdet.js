document.addEventListener("DOMContentLoaded", function () {
  const detailRender = document.getElementById("sgProjectDetailRender");

  if (!detailRender) return;

  const PROJECT_API_BASE =
    "https://solar.natriion.com/index.php?rest_route=/solar/v1/projects";

  const FALLBACK_IMAGE = "/assets/logosolar.png";
  const SESSION_KEY = "sg_selected_project";

  let abortController = null;

  // Xóa thẻ HTML, chỉ lấy text thuần
  function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  }

  // Chống lỗi khi render text ra HTML
  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Lấy slug dự án từ URL
  function getSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || "";
  }

  // Lấy tiêu đề dự án
  function getProjectTitle(project) {
    return stripHTML(
      project?.title?.rendered || project?.title || "Chi tiết dự án",
    );
  }

  // Lấy ảnh dự án nếu cần dùng
  function getProjectImage(project) {
    return project?.image_full || project?.image || FALLBACK_IMAGE;
  }

  // Lấy danh mục dự án
  function getProjectTerm(project) {
    return project?.terms?.[0]?.name || "Dự án";
  }

  // Lấy nội dung chi tiết dự án
  function getProjectContent(project) {
    return (
      project?.content?.rendered ||
      project?.excerpt?.rendered ||
      "<p>Nội dung dự án đang được cập nhật.</p>"
    );
  }

  // Lấy dữ liệu dự án đã lưu từ trang danh sách để render nhanh trước
  function getSessionProject(slug) {
    try {
      const savedProject = JSON.parse(
        sessionStorage.getItem(SESSION_KEY) || "null",
      );

      if (!savedProject || savedProject.slug !== slug) return null;

      return savedProject;
    } catch (error) {
      return null;
    }
  }

  // Tạo API URL lấy chi tiết dự án theo slug
  function buildDetailApiUrl(slug) {
    const url = new URL(PROJECT_API_BASE);
    url.searchParams.set("slug", slug);
    url.searchParams.set("_refresh", Date.now());

    return url.toString();
  }

  // Tạo API URL fallback lấy tất cả dự án nếu API slug không hoạt động
  function buildFallbackListApiUrl() {
    const url = new URL(PROJECT_API_BASE);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("_refresh", Date.now());

    return url.toString();
  }

  // Render trạng thái đang tải
  function renderLoading() {
    detailRender.innerHTML = `
      <div class="sg-project-detail-skeleton">
        Đang tải chi tiết dự án...
      </div>
    `;
  }

  // Render thông báo lỗi hoặc không có dữ liệu
  function renderEmpty(message) {
    detailRender.innerHTML = `
      <div class="sg-project-empty">
        ${escapeHTML(message)}
      </div>
    `;
  }

  // Chuẩn hóa dữ liệu API trả về theo slug
  function normalizeDetailResponse(data, slug) {
    if (Array.isArray(data)) {
      return (
        data.find(function (project) {
          return project.slug === slug;
        }) ||
        data[0] ||
        null
      );
    }

    if (data && data.slug === slug) {
      return data;
    }

    if (data && data.id) {
      return data;
    }

    return null;
  }

  // Gọi API lấy chi tiết dự án theo slug
  async function fetchProjectDetailBySlug(slug) {
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();

    const response = await fetch(buildDetailApiUrl(slug), {
      cache: "no-store",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải chi tiết dự án theo slug");
    }

    const data = await response.json();

    return normalizeDetailResponse(data, slug);
  }

  // Fallback: gọi danh sách dự án rồi tìm đúng slug
  async function fetchProjectDetailFromList(slug) {
    const response = await fetch(buildFallbackListApiUrl(), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh sách dự án fallback");
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : [];

    return (
      list.find(function (project) {
        return project.slug === slug;
      }) || null
    );
  }

  // Cập nhật title trình duyệt
  function updateDocumentTitle(project) {
    document.title = `${getProjectTitle(project)} | Solar Green`;
  }

  // Render chi tiết dự án ra giao diện
  function renderProjectDetail(project) {
    const title = getProjectTitle(project);
    const term = getProjectTerm(project);
    const content = getProjectContent(project);

    updateDocumentTitle(project);

    detailRender.innerHTML = `
      <article class="sg-project-detail-article">
        <div class="sg-project-detail-content-wrap">
          <span class="sg-project-detail-label">${escapeHTML(term)}</span>

          <h1>${escapeHTML(title)}</h1>

          <div class="sg-project-detail-content">
            ${content}
          </div>
        </div>
      </article>
    `;
  }

  // Render nhanh bằng sessionStorage nếu user vừa bấm từ trang danh sách
  function renderSessionProjectIfAvailable(slug) {
    const sessionProject = getSessionProject(slug);

    if (!sessionProject) return false;

    renderProjectDetail(sessionProject);

    return true;
  }

  // Lấy dữ liệu mới nhất từ API rồi render lại
  async function loadFreshProject(slug) {
    try {
      let project = await fetchProjectDetailBySlug(slug);

      if (!project) {
        project = await fetchProjectDetailFromList(slug);
      }

      if (!project) {
        renderEmpty("Không tìm thấy dự án phù hợp.");
        return;
      }

      renderProjectDetail(project);
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Project detail error:", error);

      const hasCurrentContent = detailRender.querySelector(
        ".sg-project-detail-article",
      );

      if (!hasCurrentContent) {
        renderEmpty("Không thể tải chi tiết dự án. Vui lòng thử lại sau.");
      }
    }
  }

  // Khởi chạy page chi tiết dự án
  async function initProjectDetail() {
    const slug = getSlugFromUrl();

    if (!slug) {
      renderEmpty("Không tìm thấy slug dự án.");
      return;
    }

    const hasSessionData = renderSessionProjectIfAvailable(slug);

    if (!hasSessionData) {
      renderLoading();
    }

    await loadFreshProject(slug);
  }

  initProjectDetail();
});
