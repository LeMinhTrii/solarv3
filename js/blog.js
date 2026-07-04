document.addEventListener("DOMContentLoaded", function () {
  const newsGrid = document.getElementById("sgNewsPageGrid");
  const loadMoreBtn = document.getElementById("sgNewsLoadMore");
  const featuredPostsEl = document.getElementById("sgFeaturedPosts");
  const recentPostsEl = document.getElementById("sgRecentPosts");

  if (!newsGrid || !loadMoreBtn) return;

  const POSTS_API_ORIGIN = "https://solar.natriion.com/index.php";
  const POST_DETAIL_PAGE = "/tin-tuc-chi-tiet.html";
  const FALLBACK_IMAGE = "/assets/logosolar.png";

  const RECENT_KEY = "sg_recent_posts";
  const FEATURED_CACHE_KEY = "sg_news_featured_cache_v1";
  const MAIN_CACHE_PREFIX = "sg_news_page_cache_v1_";

  const CACHE_TTL = 5 * 60 * 1000;
  const perPage = 6;
  const featuredLimit = 4;
  const recentLimit = 3;

  let currentPage = 1;
  let totalPages = null;
  let isLoading = false;
  let hasMore = true;
  let loadedPostIds = new Set();
  let mainAbortController = null;
  let featuredAbortController = null;

  // Xóa thẻ HTML, chỉ lấy text thuần
  function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  }

  // Chống lỗi HTML khi render dữ liệu từ API
  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Cắt ngắn mô tả để layout không bị vỡ
  function truncateText(text, maxLength) {
    const cleanText = String(text || "").trim();

    if (cleanText.length <= maxLength) return cleanText;

    return cleanText.slice(0, maxLength).trim() + "...";
  }

  // Lấy cache theo key
  function getCache(key) {
    try {
      const cache = JSON.parse(localStorage.getItem(key) || "null");

      if (!cache || !cache.time || !cache.data) return null;

      const isExpired = Date.now() - cache.time > CACHE_TTL;

      if (isExpired) return null;

      return cache.data;
    } catch (error) {
      return null;
    }
  }

  // Lưu cache theo key
  function setCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          time: Date.now(),
          data,
        }),
      );
    } catch (error) {
      console.warn("Không thể lưu cache tin tức:", error);
    }
  }

  // Tạo key cache cho từng page bài viết
  function getMainCacheKey(page) {
    return `${MAIN_CACHE_PREFIX}${page}`;
  }

  // Tạo URL API bài viết
  function buildPostsApiUrl(params = {}) {
    const url = new URL(POSTS_API_ORIGIN);

    url.searchParams.set("rest_route", "/wp/v2/posts");
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    url.searchParams.set("_embed", "wp:featuredmedia,wp:term");
    url.searchParams.set(
      "_fields",
      "id,slug,date,modified,link,title,excerpt,sticky,categories,featured_media,_links,_embedded",
    );

    Object.entries(params).forEach(function ([key, value]) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    url.searchParams.set("_refresh", Date.now());

    return url.toString();
  }

  // Tạo URL API danh sách bài viết bên trái
  function buildMainPostsApiUrl(page) {
    return buildPostsApiUrl({
      per_page: perPage,
      page: page,
    });
  }

  // Tạo URL API bài viết nổi bật, chỉ lấy sticky
  function buildFeaturedPostsApiUrl() {
    return buildPostsApiUrl({
      per_page: featuredLimit,
      sticky: true,
    });
  }

  // Lấy tiêu đề bài viết
  function getPostTitle(post) {
    return stripHTML(post?.title?.rendered || "Bài viết Solar");
  }

  // Lấy mô tả ngắn bài viết
  function getPostExcerpt(post) {
    const excerpt = stripHTML(post?.excerpt?.rendered || "");

    return (
      excerpt ||
      "Cập nhật kiến thức và thông tin hữu ích về điện năng lượng mặt trời."
    );
  }

  // Lấy ảnh đại diện bài viết
  function getPostImage(post) {
    const media = post?._embedded?.["wp:featuredmedia"]?.[0];

    return (
      media?.source_url ||
      media?.media_details?.sizes?.large?.source_url ||
      media?.media_details?.sizes?.medium_large?.source_url ||
      media?.media_details?.sizes?.medium?.source_url ||
      FALLBACK_IMAGE
    );
  }

  // Lấy danh mục bài viết
  function getPostCategory(post) {
    const terms = post?._embedded?.["wp:term"] || [];
    const categories = terms.flat().filter(function (term) {
      return term.taxonomy === "category";
    });

    return categories?.[0]?.name || "Tin tức";
  }

  // Format ngày đăng bài viết
  function formatPostDate(dateString) {
    if (!dateString) return "";

    try {
      return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(dateString));
    } catch (error) {
      return "";
    }
  }

  // Tạo link sang trang chi tiết bằng slug
  function getPostDetailUrl(post) {
    return `${POST_DETAIL_PAGE}?slug=${encodeURIComponent(post.slug || "")}`;
  }

  // Chuẩn hóa dữ liệu bài viết từ API
  function normalizePost(post) {
    return {
      raw: post,
      id: post.id,
      slug: post.slug || "",
      title: getPostTitle(post),
      excerpt: truncateText(getPostExcerpt(post), 170),
      image: getPostImage(post),
      category: getPostCategory(post),
      date: formatPostDate(post.date),
      detailUrl: getPostDetailUrl(post),
      sticky: Boolean(post.sticky),
    };
  }

  // Lưu bài viết đã click vào xem gần đây
  function saveRecentPost(post) {
    try {
      const current = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");

      const filtered = current.filter(function (item) {
        return item.id !== post.id;
      });

      const next = [post, ...filtered].slice(0, recentLimit);

      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      sessionStorage.setItem("sg_selected_post", JSON.stringify(post.raw));
    } catch (error) {}
  }

  // Lấy  bài viết xem gần đây
  function getRecentPosts() {
    try {
      const posts = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(posts) ? posts.slice(0, recentLimit) : [];
    } catch (error) {
      return [];
    }
  }

  // Hiển thị skeleton danh sách bên trái
  function renderNewsSkeleton(count = 4) {
    newsGrid.innerHTML = Array.from({ length: count })
      .map(function () {
        return `
          <article class="sg-news-paper-item sg-news-paper-skeleton">
            <div class="sg-news-paper-image"></div>

            <div class="sg-news-paper-content">
              <div class="sg-news-paper-skeleton-pill"></div>
              <div class="sg-news-paper-skeleton-line is-title"></div>
              <div class="sg-news-paper-skeleton-line is-title-short"></div>
              <div class="sg-news-paper-skeleton-line is-text"></div>
              <div class="sg-news-paper-skeleton-line is-text-short"></div>
              <div class="sg-news-paper-skeleton-line is-btn"></div>
            </div>
          </article>
        `;
      })
      .join("");

    loadMoreBtn.classList.add("is-hide");
  }

  // Hiển thị thông báo khi không có dữ liệu hoặc API lỗi
  function renderEmpty(message) {
    newsGrid.innerHTML = `
      <div class="sg-news-empty">${escapeHTML(message)}</div>
    `;

    loadMoreBtn.classList.add("is-hide");
  }

  // Tạo item bài viết dạng báo list bên trái
  function createPostListItem(post) {
    const article = document.createElement("article");
    article.className = "sg-news-paper-item";

    article.innerHTML = `
      <a href="${escapeHTML(post.detailUrl)}" class="sg-news-paper-image">
        <img
          src="${escapeHTML(post.image)}"
          alt="${escapeHTML(post.title)}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
      </a>

      <div class="sg-news-paper-content">
        <div class="sg-news-paper-meta">
          <span><i class="fa-regular fa-calendar"></i> ${escapeHTML(post.date)}</span>
          <span><i class="fa-solid fa-folder-open"></i> ${escapeHTML(post.category)}</span>
        </div>

        <h2>
          <a href="${escapeHTML(post.detailUrl)}">
            ${escapeHTML(post.title)}
          </a>
        </h2>

        <p>${escapeHTML(post.excerpt)}</p>

        <a href="${escapeHTML(post.detailUrl)}" class="sg-news-paper-more">
          Xem chi tiết
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;

    article.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        saveRecentPost(post);
      });
    });

    return article;
  }

  // Tạo item nhỏ trong sidebar
  function createSidebarPostItem(post) {
    const item = document.createElement("article");
    item.className = "sg-news-side-item";

    item.innerHTML = `
      <a href="${escapeHTML(post.detailUrl)}" class="sg-news-side-image">
        <img
          src="${escapeHTML(post.image)}"
          alt="${escapeHTML(post.title)}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
      </a>

      <div class="sg-news-side-content">
        <h3>
          <a href="${escapeHTML(post.detailUrl)}">
            ${escapeHTML(post.title)}
          </a>
        </h3>

        <time>
          <i class="fa-regular fa-calendar"></i>
          ${escapeHTML(post.date)}
        </time>
      </div>
    `;

    item.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        saveRecentPost(post);
      });
    });

    return item;
  }

  // Append bài viết vào list, không render lại toàn bộ
  function appendPosts(posts) {
    const fragment = document.createDocumentFragment();

    posts.forEach(function (post) {
      fragment.appendChild(createPostListItem(post));
    });

    newsGrid.appendChild(fragment);
  }

  // Render bài viết sidebar
  function renderSidebarPosts(container, posts, emptyMessage) {
    if (!container) return;

    if (!posts.length) {
      container.innerHTML = `
        <div class="sg-news-side-empty">${escapeHTML(emptyMessage)}</div>
      `;
      return;
    }

    container.innerHTML = "";

    const fragment = document.createDocumentFragment();

    posts.slice(0, 5).forEach(function (post) {
      fragment.appendChild(createSidebarPostItem(post));
    });

    container.appendChild(fragment);
  }

  // Render bài viết xem gần đây từ localStorage
  function renderRecentPosts() {
    renderSidebarPosts(
      recentPostsEl,
      getRecentPosts(),
      "Chưa có bài viết đã xem.",
    );
  }

  // Cập nhật nút Load More
  function setLoadMoreState(lastFetchedCount) {
    const reachedLastPage = totalPages !== null && currentPage >= totalPages;
    const fetchedLessThanPerPage = lastFetchedCount < perPage;

    if (!hasMore || reachedLastPage || fetchedLessThanPerPage) {
      hasMore = false;
      loadMoreBtn.classList.add("is-hide");
      return;
    }

    loadMoreBtn.classList.remove("is-hide");
    loadMoreBtn.classList.remove("is-loading");
    loadMoreBtn.disabled = false;

    loadMoreBtn.innerHTML = `
      Xem thêm bài viết
      <i class="fa-solid fa-arrow-down"></i>
    `;
  }

  // Chuyển nút Load More sang loading
  function setLoadMoreLoading() {
    loadMoreBtn.classList.add("is-loading");
    loadMoreBtn.disabled = true;

    loadMoreBtn.innerHTML = `
      Đang tải...
      <i class="fa-solid fa-spinner fa-spin"></i>
    `;
  }

  // Lọc bài trùng và chuẩn hóa bài viết
  function normalizeUniquePosts(postList) {
    return postList
      .filter(function (post) {
        if (loadedPostIds.has(post.id)) return false;

        loadedPostIds.add(post.id);
        return true;
      })
      .map(normalizePost);
  }

  // Gọi API lấy danh sách bài viết theo page
  async function fetchPostsFromApi(page) {
    if (mainAbortController) {
      mainAbortController.abort();
    }

    mainAbortController = new AbortController();

    const response = await fetch(buildMainPostsApiUrl(page), {
      cache: "no-store",
      signal: mainAbortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh sách bài viết");
    }

    const data = await response.json();

    const totalPagesHeader = response.headers.get("X-WP-TotalPages");

    if (totalPagesHeader) {
      totalPages = Number(totalPagesHeader);
    }

    return {
      posts: Array.isArray(data) ? data : [],
      totalPages: totalPages,
    };
  }

  // Gọi API lấy bài viết nổi bật sticky
  async function fetchFeaturedPostsFromApi() {
    if (featuredAbortController) {
      featuredAbortController.abort();
    }

    featuredAbortController = new AbortController();

    const response = await fetch(buildFeaturedPostsApiUrl(), {
      cache: "no-store",
      signal: featuredAbortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải bài viết nổi bật");
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
  }

  // Tải bài viết nổi bật, ưu tiên cache trước
  async function loadFeaturedPosts() {
    if (!featuredPostsEl) return;

    const cachedFeatured = getCache(FEATURED_CACHE_KEY);

    if (cachedFeatured) {
      const posts = cachedFeatured.map(normalizePost).slice(0, featuredLimit);

      renderSidebarPosts(featuredPostsEl, posts, "Chưa có bài viết nổi bật.");

      return;
    }

    featuredPostsEl.innerHTML = `
      <div class="sg-news-side-empty">Đang tải bài viết nổi bật...</div>
    `;

    try {
      const data = await fetchFeaturedPostsFromApi();

      setCache(FEATURED_CACHE_KEY, data);

      const posts = data.map(normalizePost).slice(0, featuredLimit);

      renderSidebarPosts(featuredPostsEl, posts, "Chưa có bài viết nổi bật.");
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Featured News API Error:", error);

      featuredPostsEl.innerHTML = `
        <div class="sg-news-side-empty">Không thể tải bài viết nổi bật.</div>
      `;
    }
  }

  // Tải bài viết bên trái theo page, có cache theo từng page
  async function loadPosts(page) {
    if (isLoading || !hasMore) return;

    isLoading = true;

    const cacheKey = getMainCacheKey(page);
    const cachedPage = getCache(cacheKey);

    if (cachedPage && Array.isArray(cachedPage.posts)) {
      if (page === 1) {
        newsGrid.innerHTML = "";
      } else {
        setLoadMoreLoading();
      }

      if (cachedPage.totalPages) {
        totalPages = cachedPage.totalPages;
      }

      const normalizedPosts = normalizeUniquePosts(cachedPage.posts);

      if (!normalizedPosts.length && page === 1) {
        renderEmpty("Chưa có bài viết nào được cập nhật.");
        isLoading = false;
        return;
      }

      appendPosts(normalizedPosts);

      currentPage = page;
      setLoadMoreState(cachedPage.posts.length);

      isLoading = false;
      return;
    }

    if (page === 1) {
      renderNewsSkeleton(4);
    } else {
      setLoadMoreLoading();
    }

    try {
      const result = await fetchPostsFromApi(page);
      const postList = result.posts;

      setCache(cacheKey, {
        posts: postList,
        totalPages: result.totalPages,
      });

      const normalizedPosts = normalizeUniquePosts(postList);

      if (page === 1) {
        newsGrid.innerHTML = "";
      }

      if (!normalizedPosts.length && page === 1) {
        renderEmpty("Chưa có bài viết nào được cập nhật.");
        return;
      }

      appendPosts(normalizedPosts);

      currentPage = page;
      setLoadMoreState(postList.length);
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("News API Error:", error);

      if (page === 1) {
        renderEmpty("Không thể tải danh sách bài viết. Vui lòng thử lại sau.");
      } else {
        loadMoreBtn.classList.remove("is-loading");
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = `
          Thử lại
          <i class="fa-solid fa-rotate-right"></i>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  // Xử lý click Load More
  loadMoreBtn.addEventListener("click", function () {
    loadPosts(currentPage + 1);
  });

  // Render 5 bài xem gần đây
  renderRecentPosts();

  // Gọi API bài viết nổi bật riêng
  loadFeaturedPosts();

  // Gọi API bài viết bên trái page đầu tiên
  loadPosts(1);
});
