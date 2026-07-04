document.addEventListener("DOMContentLoaded", function () {
  const projectGrid = document.getElementById("sgProjectGrid");
  const loadMoreBtn = document.getElementById("sgProjectLoadMore");

  if (!projectGrid || !loadMoreBtn) return;

  const PROJECT_API =
    "https://solar.natriion.com/index.php?rest_route=/solar/v1/projects";

  const PROJECT_DETAIL_PAGE = "/du-an-chi-tiet.html";
  const FALLBACK_IMAGE = "/assets/logosolar.png";

  const CACHE_KEY = "sg_projects_cache_v1";
  const CACHE_TTL = 5 * 60 * 1000;

  const initialCount = 8;
  const loadStep = 8;

  let allProjects = [];
  let visibleCount = 0;
  let isLoading = false;
  let abortController = null;

  // Xóa thẻ HTML từ nội dung API, chỉ lấy text thuần
  function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  }

  // Chống lỗi HTML khi render dữ liệu từ API ra giao diện
  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Cắt ngắn đoạn mô tả để card không bị quá dài
  function truncateText(text, maxLength) {
    const cleanText = String(text || "").trim();

    if (cleanText.length <= maxLength) return cleanText;

    return cleanText.slice(0, maxLength).trim() + "...";
  }

  // Lấy tiêu đề dự án từ API
  function getProjectTitle(project) {
    return stripHTML(
      project?.title?.rendered || project?.title || "Dự án điện mặt trời",
    );
  }

  // Lấy mô tả ngắn của dự án
  function getProjectExcerpt(project) {
    const excerpt = stripHTML(project?.excerpt?.rendered || "");

    return (
      excerpt ||
      "Giải pháp điện mặt trời được tư vấn, thiết kế và triển khai theo nhu cầu sử dụng điện thực tế."
    );
  }

  // Lấy ảnh đại diện dự án, nếu không có thì dùng ảnh mặc định
  function getProjectImage(project) {
    return project?.image || project?.image_full || FALLBACK_IMAGE;
  }

  // Lấy danh mục đầu tiên của dự án
  function getProjectTerm(project) {
    return project?.terms?.[0]?.name || "Dự án";
  }

  // Tạo link sang trang chi tiết dự án bằng slug
  function getProjectDetailUrl(project) {
    return `${PROJECT_DETAIL_PAGE}?slug=${encodeURIComponent(project.slug || "")}`;
  }

  // Tự bắt công suất từ tiêu đề dự án như 8kW, 44kWp, 6.9kWh
  function extractCapacity(title) {
    const text = title || "";
    const match = text.match(/(\d+(?:[,.]\d+)?)\s*(kWp|kW|kWh)/i);

    if (!match) return "Solar";

    return `${match[1]}${match[2]}`;
  }

  // Tự nhận diện loại dự án dựa trên tiêu đề
  function getProjectType(project) {
    const title = getProjectTitle(project).toLowerCase();

    if (title.includes("hybrid")) return "Hybrid";
    if (title.includes("áp mái")) return "Áp mái";
    if (title.includes("hòa lưới") || title.includes("hoà lưới"))
      return "Hòa lưới";
    if (title.includes("lưu trữ")) return "Lưu trữ";
    if (title.includes("gia đình")) return "Gia đình";
    if (title.includes("doanh nghiệp") || title.includes("nhà xưởng"))
      return "Doanh nghiệp";

    return getProjectTerm(project);
  }

  // Chuẩn hóa dữ liệu dự án từ API thành object dễ render
  function normalizeProject(project) {
    const title = getProjectTitle(project);
    const excerpt = getProjectExcerpt(project);
    const image = getProjectImage(project);
    const term = getProjectTerm(project);

    return {
      raw: project,
      id: project?.id || project?.slug || title,
      slug: project?.slug || "",
      title,
      excerpt: truncateText(excerpt, 135),
      image,
      term,
      capacity: extractCapacity(title),
      type: getProjectType(project),
      detailUrl: getProjectDetailUrl(project),
    };
  }

  // Lấy dữ liệu cache dự án từ localStorage
  function getCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");

      if (!cache || !cache.time || !Array.isArray(cache.data)) return null;

      const isExpired = Date.now() - cache.time > CACHE_TTL;

      if (isExpired) return null;

      return cache.data;
    } catch (error) {
      return null;
    }
  }

  // Lưu danh sách dự án vào localStorage
  function setCache(data) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          time: Date.now(),
          data,
        }),
      );
    } catch (error) {
      console.warn("Không thể lưu cache dự án:", error);
    }
  }

  // Cập nhật trạng thái nút Load More
  function setLoadMoreState() {
    const remaining = allProjects.length - visibleCount;

    if (remaining <= 0) {
      loadMoreBtn.classList.add("is-hide");
      return;
    }

    loadMoreBtn.classList.remove("is-hide");
    loadMoreBtn.classList.remove("is-loading");
    loadMoreBtn.disabled = false;

    const nextCount = Math.min(loadStep, remaining);

    loadMoreBtn.innerHTML = `
      Xem thêm ${nextCount} dự án
      <i class="fa-solid fa-arrow-down"></i>
    `;
  }

  // Chuyển nút Load More sang trạng thái đang tải
  function setLoadMoreLoading() {
    loadMoreBtn.classList.add("is-loading");
    loadMoreBtn.disabled = true;

    loadMoreBtn.innerHTML = `
      Đang tải...
      <i class="fa-solid fa-spinner fa-spin"></i>
    `;
  }

  // Hiển thị skeleton trong lúc chờ API
  function renderProjectSkeleton(count = 8) {
    projectGrid.innerHTML = Array.from({ length: count })
      .map(function () {
        return `
          <article class="sg-project-app-card sg-project-skeleton">
            <div class="sg-project-app-image"></div>

            <div class="sg-project-app-body">
              <div class="sg-project-skeleton-meta">
                <div class="sg-project-skeleton-pill"></div>
                <div class="sg-project-skeleton-pill is-short"></div>
              </div>

              <div class="sg-project-skeleton-line is-title"></div>
              <div class="sg-project-skeleton-line is-title-short"></div>

              <div class="sg-project-skeleton-line is-text"></div>
              <div class="sg-project-skeleton-line is-text-short"></div>

              <div class="sg-project-skeleton-line is-btn"></div>
            </div>
          </article>
        `;
      })
      .join("");

    loadMoreBtn.classList.add("is-hide");
  }

  // Hiển thị thông báo khi không có dữ liệu hoặc API lỗi
  function renderEmpty(message) {
    projectGrid.innerHTML = `
      <div class="sg-project-empty">
        ${escapeHTML(message)}
      </div>
    `;

    loadMoreBtn.classList.add("is-hide");
  }

  // Tạo một card dự án
  function createProjectCard(project) {
    const article = document.createElement("article");
    article.className = "sg-project-app-card";

    article.innerHTML = `
      <a href="${escapeHTML(project.detailUrl)}" class="sg-project-app-image">
        <img
          src="${escapeHTML(project.image)}"
          alt="${escapeHTML(project.title)}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
        <span>${escapeHTML(project.term)}</span>
      </a>

      <div class="sg-project-app-body">
        <div class="sg-project-app-meta">
          <span><i class="fa-solid fa-bolt"></i> ${escapeHTML(project.capacity)}</span>
          <span><i class="fa-solid fa-solar-panel"></i> ${escapeHTML(project.type)}</span>
        </div>

        <h3>
          <a href="${escapeHTML(project.detailUrl)}">
            ${escapeHTML(project.title)}
          </a>
        </h3>

        <p>${escapeHTML(project.excerpt)}</p>

        <a href="${escapeHTML(project.detailUrl)}" class="sg-project-app-more">
          Xem chi tiết
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;

    const detailLinks = article.querySelectorAll("a");

    detailLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        try {
          sessionStorage.setItem(
            "sg_selected_project",
            JSON.stringify(project.raw),
          );
        } catch (error) {}
      });
    });

    return article;
  }

  // Thêm một nhóm dự án mới vào grid
  function appendProjects(from, to) {
    const fragment = document.createDocumentFragment();
    const projectsToAppend = allProjects.slice(from, to);

    projectsToAppend.forEach(function (project) {
      fragment.appendChild(createProjectCard(project));
    });

    projectGrid.appendChild(fragment);
  }

  // Render danh sách dự án đầu tiên
  function renderInitialProjects() {
    projectGrid.innerHTML = "";

    if (!allProjects.length) {
      renderEmpty("Chưa có dự án nào được cập nhật.");
      return;
    }

    visibleCount = Math.min(initialCount, allProjects.length);
    appendProjects(0, visibleCount);
    setLoadMoreState();
  }

  // Gọi API lấy tất cả dự án
  async function fetchProjectsFromApi() {
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();

    const response = await fetch(`${PROJECT_API}&_refresh=${Date.now()}`, {
      cache: "no-store",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh sách dự án");
    }

    return response.json();
  }

  // Lấy dữ liệu dự án, ưu tiên cache trước rồi mới gọi API
  async function fetchProjects() {
    if (isLoading) return;

    isLoading = true;

    const cachedData = getCache();

    if (cachedData) {
      allProjects = cachedData.map(normalizeProject);
      renderInitialProjects();
      isLoading = false;

      return;
    }

    renderProjectSkeleton(initialCount);

    try {
      const data = await fetchProjectsFromApi();
      const projectList = Array.isArray(data) ? data : [];

      setCache(projectList);

      allProjects = projectList.map(normalizeProject);
      renderInitialProjects();
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Project API Error:", error);

      renderEmpty("Không thể tải danh sách dự án. Vui lòng thử lại sau.");
    } finally {
      isLoading = false;
    }
  }

  // Xử lý khi bấm nút Load More
  loadMoreBtn.addEventListener("click", function () {
    if (isLoading) return;

    const oldCount = visibleCount;
    const newCount = Math.min(visibleCount + loadStep, allProjects.length);

    setLoadMoreLoading();

    window.requestAnimationFrame(function () {
      appendProjects(oldCount, newCount);
      visibleCount = newCount;
      setLoadMoreState();
    });
  });

  // Khởi chạy lấy dữ liệu dự án khi trang load xong
  fetchProjects();
});
