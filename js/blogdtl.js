document.addEventListener("DOMContentLoaded", function () {
  const detailRender = document.getElementById("sgBlogDetailRender");
  const relatedPostsEl = document.getElementById("sgRelatedPosts");
  const recentPostsEl = document.getElementById("sgRecentPostsDetail");

  if (!detailRender) return;

  const POSTS_API_ORIGIN = "https://solar.natriion.com/index.php";
  const POST_DETAIL_PAGE = "/tin-tuc-chi-tiet.html";
  const FALLBACK_IMAGE = "/assets/banner-prd.jpg";

  const SESSION_KEY = "sg_selected_post";
  const RECENT_KEY = "sg_recent_posts";
  const DETAIL_CACHE_PREFIX = "sg_blog_detail_cache_v4_";
  const RELATED_CACHE_PREFIX = "sg_blog_related_cache_v4_";

  const CACHE_TTL = 5 * 60 * 1000;
  const relatedLimit = 5;
  const recentLimit = 5;

  let detailAbortController = null;
  let relatedAbortController = null;
  let relatedRequestedPostId = null;

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

  // Lấy cache và kiểm tra cache còn hạn không
  function getCacheEntry(key) {
    try {
      const cache = JSON.parse(localStorage.getItem(key) || "null");

      if (!cache || !cache.time || !cache.data) {
        return {
          hasCache: false,
          isFresh: false,
          data: null,
        };
      }

      return {
        hasCache: true,
        isFresh: Date.now() - cache.time <= CACHE_TTL,
        data: cache.data,
      };
    } catch (error) {
      return {
        hasCache: false,
        isFresh: false,
        data: null,
      };
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
      console.warn("Không thể lưu cache bài viết:", error);
    }
  }

  // Lấy slug bài viết từ URL
  function getSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || "";
  }

  // Tạo key cache chi tiết bài viết
  function getDetailCacheKey(slug) {
    return `${DETAIL_CACHE_PREFIX}${slug}`;
  }

  // Tạo key cache bài viết liên quan
  function getRelatedCacheKey(postId) {
    return `${RELATED_CACHE_PREFIX}${postId}`;
  }

  // Tạo URL API bài viết
  function buildPostsApiUrl(params = {}) {
    const url = new URL(POSTS_API_ORIGIN);

    url.searchParams.set("rest_route", "/wp/v2/posts");
    url.searchParams.set("_embed", "wp:featuredmedia,wp:term");
    url.searchParams.set(
      "_fields",
      "id,slug,date,modified,link,title,content,excerpt,sticky,categories,featured_media,_links,_embedded",
    );

    Object.entries(params).forEach(function ([key, value]) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    url.searchParams.set("_refresh", Date.now());

    return url.toString();
  }

  // Tạo URL API lấy chi tiết bài viết theo slug
  function buildPostDetailApiUrl(slug) {
    return buildPostsApiUrl({
      slug: slug,
      per_page: 1,
    });
  }

  // Tạo URL API lấy bài viết liên quan theo danh mục
  function buildRelatedPostsApiUrl(post) {
    const categoryId = Array.isArray(post.categories) ? post.categories[0] : "";

    const params = {
      per_page: relatedLimit + 1,
      orderby: "date",
      order: "desc",
    };

    if (categoryId) {
      params.categories = categoryId;
    }

    return buildPostsApiUrl(params);
  }

  // Lấy tiêu đề bài viết
  function getPostTitle(post) {
    return stripHTML(post?.title?.rendered || post?.title || "Bài viết Solar");
  }

  // Lấy nội dung bài viết
  function getPostContent(post) {
    return (
      post?.content?.rendered ||
      post?.excerpt?.rendered ||
      "<p>Nội dung bài viết đang được cập nhật.</p>"
    );
  }

  // Lấy ảnh đại diện bài viết
  function getPostImage(post) {
    const media = post?._embedded?.["wp:featuredmedia"]?.[0];

    return (
      post?.image ||
      media?.source_url ||
      media?.media_details?.sizes?.large?.source_url ||
      media?.media_details?.sizes?.medium_large?.source_url ||
      media?.media_details?.sizes?.medium?.source_url ||
      FALLBACK_IMAGE
    );
  }

  // Lấy danh mục bài viết
  function getPostCategory(post) {
    if (post?.category) return post.category;

    const terms = post?._embedded?.["wp:term"] || [];
    const categories = terms.flat().filter(function (term) {
      return term.taxonomy === "category";
    });

    return categories?.[0]?.name || "Tin tức";
  }

  // Format ngày bài viết
  function formatPostDate(dateString) {
    if (!dateString) return "";

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      return dateString;
    }

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

  // Tạo link sang trang chi tiết bài viết
  function getPostDetailUrl(post) {
    return `${POST_DETAIL_PAGE}?slug=${encodeURIComponent(post.slug || "")}`;
  }

  // Chuẩn hóa dữ liệu bài viết cho sidebar/recent
  function normalizePost(post) {
    const rawPost = post?.raw || post;

    return {
      raw: rawPost,
      id: post?.id || rawPost?.id,
      slug: post?.slug || rawPost?.slug || "",
      title:
        post?.title && typeof post.title === "string"
          ? post.title
          : getPostTitle(rawPost),
      image: post?.image || getPostImage(rawPost),
      category: post?.category || getPostCategory(rawPost),
      date: post?.date
        ? formatPostDate(post.date)
        : formatPostDate(rawPost?.date),
      detailUrl: post?.detailUrl || getPostDetailUrl(rawPost),
      categories: post?.categories || rawPost?.categories || [],
    };
  }

  // Lưu bài viết vào danh sách xem gần đây
  function saveRecentPost(post) {
    try {
      const normalizedPost = normalizePost(post);
      const current = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");

      const filtered = current.filter(function (item) {
        return item.id !== normalizedPost.id;
      });

      const next = [normalizedPost, ...filtered].slice(0, recentLimit);

      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(post?.raw || post));
    } catch (error) {}
  }

  // Lấy 5 bài viết xem gần đây
  function getRecentPosts() {
    try {
      const posts = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(posts) ? posts.slice(0, recentLimit) : [];
    } catch (error) {
      return [];
    }
  }

  // Lấy bài viết từ sessionStorage
  function getSessionPost(slug) {
    try {
      const post = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");

      if (!post || post.slug !== slug) return null;

      return post;
    } catch (error) {
      return null;
    }
  }

  // Kiểm tra bài viết có full content chưa
  function hasFullContent(post) {
    return Boolean(post?.content?.rendered);
  }

  // Render loading
  function renderLoading() {
    detailRender.innerHTML = `
      <div class="sg-blog-detail-skeleton">
        Đang tải bài viết...
      </div>
    `;
  }

  // Render thông báo lỗi/rỗng
  function renderEmpty(message) {
    detailRender.innerHTML = `
      <div class="sg-blog-detail-empty">
        ${escapeHTML(message)}
      </div>
    `;
  }

  // Tạo item sidebar
  function createSidebarPostItem(post) {
    const normalizedPost = normalizePost(post);

    const item = document.createElement("article");
    item.className = "sg-blog-side-item";

    item.innerHTML = `
      <a href="${escapeHTML(normalizedPost.detailUrl)}" class="sg-blog-side-image">
        <img
          src="${escapeHTML(normalizedPost.image)}"
          alt="${escapeHTML(normalizedPost.title)}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
      </a>

      <div class="sg-blog-side-content">
        <h3>
          <a href="${escapeHTML(normalizedPost.detailUrl)}">
            ${escapeHTML(normalizedPost.title)}
          </a>
        </h3>

        <time>
          <i class="fa-regular fa-calendar"></i>
          ${escapeHTML(normalizedPost.date)}
        </time>
      </div>
    `;

    item.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        saveRecentPost(normalizedPost.raw || normalizedPost);
      });
    });

    return item;
  }

  // Render danh sách sidebar
  function renderSidebarPosts(container, posts, emptyMessage) {
    if (!container) return;

    if (!posts.length) {
      container.innerHTML = `
        <div class="sg-blog-side-empty">${escapeHTML(emptyMessage)}</div>
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

  // Render bài viết xem gần đây
  function renderRecentPosts() {
    renderSidebarPosts(
      recentPostsEl,
      getRecentPosts(),
      "Chưa có bài viết đã xem.",
    );
  }

  // Render chi tiết bài viết
  function renderPostDetail(post) {
    const title = getPostTitle(post);
    const category = getPostCategory(post);
    const date = formatPostDate(post.date);
    const content = getPostContent(post);

    document.title = `${title} | Solar Green`;
    saveRecentPost(post);

    detailRender.innerHTML = `
      <article class="sg-blog-detail-article">
        <div class="sg-blog-detail-content-wrap">
          <div class="sg-blog-detail-meta">
            <span><i class="fa-solid fa-folder-open"></i> ${escapeHTML(category)}</span>
            <span><i class="fa-regular fa-calendar"></i> ${escapeHTML(date)}</span>
          </div>

          <h1>${escapeHTML(title)}</h1>

          <div class="sg-blog-detail-content">
            ${content}
          </div>
        </div>
      </article>
    `;

    renderRecentPosts();
  }

  // Render bài liên quan từ cache
  function renderRelatedFromCache(post) {
    if (!relatedPostsEl || !post || !post.id) return false;

    const relatedCache = getCacheEntry(getRelatedCacheKey(post.id));

    if (!relatedCache.hasCache) return false;

    const posts = relatedCache.data.map(normalizePost).slice(0, relatedLimit);

    renderSidebarPosts(relatedPostsEl, posts, "Chưa có bài viết liên quan.");

    return relatedCache.isFresh;
  }

  // Gọi API lấy chi tiết bài viết
  async function fetchPostDetailFromApi(slug) {
    if (detailAbortController) {
      detailAbortController.abort();
    }

    detailAbortController = new AbortController();

    const response = await fetch(buildPostDetailApiUrl(slug), {
      cache: "no-store",
      signal: detailAbortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải chi tiết bài viết");
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : [];

    return list[0] || null;
  }

  // Gọi API lấy bài viết liên quan
  async function fetchRelatedPostsFromApi(post) {
    if (relatedAbortController) {
      relatedAbortController.abort();
    }

    relatedAbortController = new AbortController();

    const response = await fetch(buildRelatedPostsApiUrl(post), {
      cache: "no-store",
      signal: relatedAbortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải bài viết liên quan");
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : [];

    return list.filter(function (item) {
      return item.id !== post.id;
    });
  }

  // Tải bài liên quan: cache trước, API chỉ gọi khi cần
  async function loadRelatedPostsSmart(post) {
    if (!relatedPostsEl || !post || !post.id) return;

    const cacheIsFresh = renderRelatedFromCache(post);

    if (cacheIsFresh) return;

    if (relatedRequestedPostId === post.id) return;

    relatedRequestedPostId = post.id;

    if (!relatedPostsEl.innerHTML.trim()) {
      relatedPostsEl.innerHTML = `
        <div class="sg-blog-side-empty">Đang tải bài viết...</div>
      `;
    }

    try {
      const freshRelated = await fetchRelatedPostsFromApi(post);

      setCache(getRelatedCacheKey(post.id), freshRelated);

      const posts = freshRelated.map(normalizePost).slice(0, relatedLimit);

      renderSidebarPosts(relatedPostsEl, posts, "Chưa có bài viết liên quan.");
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Related posts error:", error);

      const hasCache = renderRelatedFromCache(post);

      if (!hasCache) {
        relatedPostsEl.innerHTML = `
          <div class="sg-blog-side-empty">Không thể tải bài viết liên quan.</div>
        `;
      }
    }
  }

  // Lấy data ban đầu từ cache/session
  function getInitialPost(slug) {
    const detailCache = getCacheEntry(getDetailCacheKey(slug));
    const sessionPost = getSessionPost(slug);

    if (detailCache.hasCache) {
      return {
        post: detailCache.data,
        source: detailCache.isFresh ? "fresh-cache" : "stale-cache",
        shouldFetchDetail: !detailCache.isFresh,
      };
    }

    if (sessionPost) {
      return {
        post: sessionPost,
        source: hasFullContent(sessionPost)
          ? "session-full"
          : "session-preview",
        shouldFetchDetail: !hasFullContent(sessionPost),
      };
    }

    return {
      post: null,
      source: "none",
      shouldFetchDetail: true,
    };
  }

  // Tải chi tiết bài viết: cache render trước, API cập nhật sau nếu cần
  async function loadPostDetail(slug) {
    const initial = getInitialPost(slug);

    if (initial.post) {
      renderPostDetail(initial.post);
      loadRelatedPostsSmart(initial.post);
    } else {
      renderLoading();
    }

    if (!initial.shouldFetchDetail) return;

    try {
      const freshPost = await fetchPostDetailFromApi(slug);

      if (!freshPost) {
        if (!initial.post) {
          renderEmpty("Không tìm thấy bài viết phù hợp.");
        }

        return;
      }

      setCache(getDetailCacheKey(slug), freshPost);
      renderPostDetail(freshPost);
      loadRelatedPostsSmart(freshPost);
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Blog detail error:", error);

      if (!initial.post) {
        renderEmpty("Không thể tải bài viết. Vui lòng thử lại sau.");
      }
    }
  }

  // Khởi chạy trang chi tiết bài viết
  function initBlogDetail() {
    const slug = getSlugFromUrl();

    if (!slug) {
      renderEmpty("Không tìm thấy slug bài viết.");
      return;
    }

    renderRecentPosts();
    loadPostDetail(slug);
  }

  initBlogDetail();
});
