// slider hero
document.addEventListener("DOMContentLoaded", function () {
  const hero = document.querySelector(".sg-service-hero-slider");
  if (!hero) return;

  const images = hero.querySelectorAll(".sg-service-hero-img");
  const slides = hero.querySelectorAll(".sg-service-slide");
  const dots = hero.querySelectorAll(".sg-service-dots button");

  if (!images.length || !slides.length) return;

  let currentIndex = 0;
  let autoPlay;

  function goToSlide(index) {
    currentIndex = index;

    images.forEach(function (img, i) {
      img.classList.toggle("is-active", i === currentIndex);
    });

    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === currentIndex);
    });

    dots.forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === currentIndex);
    });
  }

  function nextSlide() {
    const nextIndex = (currentIndex + 1) % slides.length;
    goToSlide(nextIndex);
  }

  function startAutoPlay() {
    autoPlay = setInterval(nextSlide, 4500);
  }

  function resetAutoPlay() {
    clearInterval(autoPlay);
    startAutoPlay();
  }

  dots.forEach(function (dot, index) {
    dot.addEventListener("click", function () {
      goToSlide(index);
      resetAutoPlay();
    });
  });

  startAutoPlay();
});

// slider news
document.addEventListener("DOMContentLoaded", function () {
  const newsSlider = document.getElementById("sgNewsSlider");
  const newsPrevBtn = document.querySelector(".sg-news-prev");
  const newsNextBtn = document.querySelector(".sg-news-next");

  if (!newsSlider || !newsPrevBtn || !newsNextBtn) return;

  let isAnimating = false;

  const originalCards = Array.from(
    newsSlider.querySelectorAll(".sg-news-card"),
  );

  // Clone card để tạo loop, không cần duplicate HTML thủ công
  originalCards.forEach(function (card) {
    const clone = card.cloneNode(true);
    clone.classList.add("sg-news-card-clone");
    clone.setAttribute("aria-hidden", "true");
    newsSlider.appendChild(clone);
  });

  function getNewsCardGap() {
    const styles = window.getComputedStyle(newsSlider);
    const gap = styles.gap || styles.columnGap || "18px";
    return parseInt(gap, 10) || 18;
  }

  function getNewsScrollAmount() {
    const card = newsSlider.querySelector(".sg-news-card");
    if (!card) return 300;

    return card.offsetWidth + getNewsCardGap();
  }

  function getLoopPoint() {
    const firstClone = newsSlider.querySelector(".sg-news-card-clone");
    if (!firstClone) return newsSlider.scrollWidth / 2;

    return firstClone.offsetLeft - newsSlider.offsetLeft;
  }

  function normalizeLoop() {
    const loopPoint = getLoopPoint();

    if (newsSlider.scrollLeft >= loopPoint) {
      newsSlider.scrollLeft = newsSlider.scrollLeft - loopPoint;
    }

    isAnimating = false;
  }

  function slideNext() {
    if (isAnimating) return;

    isAnimating = true;

    newsSlider.scrollBy({
      left: getNewsScrollAmount(),
      behavior: "smooth",
    });

    setTimeout(normalizeLoop, 520);
  }

  function slidePrev() {
    if (isAnimating) return;

    isAnimating = true;

    const loopPoint = getLoopPoint();

    if (newsSlider.scrollLeft <= 2) {
      newsSlider.scrollLeft = loopPoint;
    }

    requestAnimationFrame(function () {
      newsSlider.scrollBy({
        left: -getNewsScrollAmount(),
        behavior: "smooth",
      });
    });

    setTimeout(function () {
      isAnimating = false;
    }, 520);
  }

  newsNextBtn.addEventListener("click", slideNext);
  newsPrevBtn.addEventListener("click", slidePrev);
});

document.addEventListener("DOMContentLoaded", function () {
  const faqItems = document.querySelectorAll(".sg-faq-item");

  faqItems.forEach(function (item) {
    const button = item.querySelector(".sg-faq-question");

    if (!button) return;

    button.addEventListener("click", function () {
      const isOpen = item.classList.contains("is-open");

      faqItems.forEach(function (faq) {
        faq.classList.remove("is-open");

        const faqButton = faq.querySelector(".sg-faq-question");
        if (faqButton) {
          faqButton.setAttribute("aria-expanded", "false");
        }
      });

      if (!isOpen) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
});

// call api blog home
document.addEventListener("DOMContentLoaded", function () {
  const newsSlider = document.getElementById("sgNewsSlider");
  const prevBtn = document.querySelector(".sg-news-prev");
  const nextBtn = document.querySelector(".sg-news-next");

  if (!newsSlider) return;

  const API_ORIGIN = "https://solar.natriion.com/index.php";
  const POST_DETAIL_PAGE = "/tin-tuc-chi-tiet.html";
  const FALLBACK_IMAGE = "/assets/logosolar.png";
  const LOGO_IMAGE = "/assets/logosolar.png";

  const CACHE_KEY = "sg_home_news_posts_cache_v1";
  const CACHE_TTL = 5 * 60 * 1000;

  // Xóa HTML lấy text
  function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  }

  // Chống lỗi HTML khi render
  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Cắt ngắn text
  function truncateText(text, maxLength) {
    const cleanText = String(text || "").trim();

    if (cleanText.length <= maxLength) return cleanText;

    return cleanText.slice(0, maxLength).trim() + "...";
  }

  // Lấy cache
  function getCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");

      if (!cache || !cache.time || !Array.isArray(cache.data)) return null;

      if (Date.now() - cache.time > CACHE_TTL) return null;

      return cache.data;
    } catch (error) {
      return null;
    }
  }

  // Lưu cache
  function setCache(data) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          time: Date.now(),
          data: data,
        }),
      );
    } catch (error) {
      console.warn("Không thể lưu cache tin tức trang chủ:", error);
    }
  }

  // Tạo API URL lấy tất cả post mới nhất
  function buildPostsApiUrl() {
    const url = new URL(API_ORIGIN);

    url.searchParams.set("rest_route", "/wp/v2/posts");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    url.searchParams.set("_embed", "wp:featuredmedia,wp:term");
    url.searchParams.set(
      "_fields",
      "id,slug,date,link,title,excerpt,categories,featured_media,_links,_embedded",
    );

    return url.toString();
  }

  // Lấy tiêu đề
  function getPostTitle(post) {
    return stripHTML(post?.title?.rendered || "Bài viết Solar");
  }

  // Lấy mô tả ngắn
  function getPostExcerpt(post) {
    const excerpt = stripHTML(post?.excerpt?.rendered || "");

    return (
      excerpt ||
      "Cập nhật kiến thức và thông tin hữu ích về điện năng lượng mặt trời."
    );
  }

  // Lấy ảnh đại diện
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

  // Lấy danh mục
  function getPostCategory(post) {
    const terms = post?._embedded?.["wp:term"] || [];
    const categories = terms.flat().filter(function (term) {
      return term.taxonomy === "category";
    });

    return categories?.[0]?.name || "Tin tức Solar";
  }

  // Format ngày
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

  // Link chi tiết bài viết
  function getPostDetailUrl(post) {
    return `${POST_DETAIL_PAGE}?slug=${encodeURIComponent(post.slug || "")}`;
  }

  // Chuẩn hóa post
  function normalizePost(post) {
    return {
      raw: post,
      id: post.id,
      slug: post.slug || "",
      title: getPostTitle(post),
      excerpt: truncateText(getPostExcerpt(post), 135),
      image: getPostImage(post),
      category: getPostCategory(post),
      date: formatPostDate(post.date),
      datetime: post.date || "",
      detailUrl: getPostDetailUrl(post),
    };
  }

  // Lưu post vừa click để trang detail render nhanh hơn
  function saveSelectedPost(post) {
    try {
      sessionStorage.setItem(
        "sg_selected_post",
        JSON.stringify(post.raw || post),
      );
    } catch (error) {}
  }

  // Render skeleton
  function renderNewsSkeleton(count = 5) {
    newsSlider.innerHTML = Array.from({ length: count })
      .map(function () {
        return `
          <article class="sg-news-card is-skeleton">
            <div class="sg-news-card-head">
              <div class="sg-news-skeleton-logo"></div>
              <div class="sg-news-skeleton-line is-head"></div>
            </div>

            <div class="sg-news-skeleton-image"></div>

            <div class="sg-news-body">
              <div class="sg-news-skeleton-line is-date"></div>
              <div class="sg-news-skeleton-line is-title"></div>
              <div class="sg-news-skeleton-line is-title-short"></div>
              <div class="sg-news-skeleton-line is-text"></div>
              <div class="sg-news-skeleton-line is-text"></div>
              <div class="sg-news-skeleton-line is-text-short"></div>
              <div class="sg-news-skeleton-line is-btn"></div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // Render empty
  function renderEmpty(message) {
    newsSlider.innerHTML = `
      <div class="sg-news-empty">
        ${escapeHTML(message)}
      </div>
    `;
  }

  // Tạo card bài viết
  function createNewsCard(post) {
    const article = document.createElement("article");
    article.className = "sg-news-card";

    article.innerHTML = `
      <div class="sg-news-card-head">
        <img
          src="${escapeHTML(LOGO_IMAGE)}"
          alt="Solar Green Energy Solutions"
          loading="lazy"
        />
        <h3>${escapeHTML(post.category)}</h3>
      </div>

      <a href="${escapeHTML(post.detailUrl)}" class="sg-news-image">
        <img
          src="${escapeHTML(post.image)}"
          alt="${escapeHTML(post.title)}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
      </a>

      <div class="sg-news-body">
        <time datetime="${escapeHTML(post.datetime)}">
          <i class="fa-regular fa-calendar"></i>
          ${escapeHTML(post.date)}
        </time>

        <h4><a href="${escapeHTML(post.detailUrl)}">${escapeHTML(post.title)}</a></h4>
 
        <p>${escapeHTML(post.excerpt)}</p>

        <a href="${escapeHTML(post.detailUrl)}" class="sg-news-readmore">
          Xem chi tiết
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;

    article.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        saveSelectedPost(post);
      });
    });

    return article;
  }

  // Render danh sách post
  function renderPosts(posts) {
    const normalizedPosts = posts.map(normalizePost);

    if (!normalizedPosts.length) {
      renderEmpty("Chưa có bài viết nào được cập nhật.");
      return;
    }

    newsSlider.innerHTML = "";

    const fragment = document.createDocumentFragment();

    normalizedPosts.forEach(function (post) {
      fragment.appendChild(createNewsCard(post));
    });

    newsSlider.appendChild(fragment);
  }

  // Gọi API lấy post
  async function fetchPostsFromApi() {
    const response = await fetch(buildPostsApiUrl(), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Không thể tải bài viết");
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
  }

  // Load bài viết có cache
  async function loadHomeNewsPosts() {
    const cachedPosts = getCache();

    if (cachedPosts) {
      renderPosts(cachedPosts);
      return;
    }

    renderNewsSkeleton(5);

    try {
      const posts = await fetchPostsFromApi();

      setCache(posts);
      renderPosts(posts);
    } catch (error) {
      console.error("Home news API error:", error);
      renderEmpty("Không thể tải bài viết. Vui lòng thử lại sau.");
    }
  }

  // Slider arrows
  function scrollNewsSlider(direction) {
    const firstCard = newsSlider.querySelector(".sg-news-card");
    const cardWidth = firstCard ? firstCard.offsetWidth : 240;
    const gap = 18;

    newsSlider.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: "smooth",
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      scrollNewsSlider(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      scrollNewsSlider(1);
    });
  }

  loadHomeNewsPosts();
});
