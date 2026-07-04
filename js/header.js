document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("sgMenuToggle");
  const nav = document.getElementById("sgNav");
  const dropdownItems = document.querySelectorAll(".sg-nav-dropdown");

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");

      menuToggle.classList.toggle("is-active", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("menu-open", isOpen);
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        menuToggle.classList.remove("is-active");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-open");

        dropdownItems.forEach(function (item) {
          item.classList.remove("is-open");
        });
      });
    });
  }

  dropdownItems.forEach(function (item) {
    const btn = item.querySelector(".sg-nav-dropdown-btn");

    if (!btn) return;

    btn.addEventListener("click", function (event) {
      if (window.innerWidth > 991) return;

      event.preventDefault();

      dropdownItems.forEach(function (otherItem) {
        if (otherItem !== item) {
          otherItem.classList.remove("is-open");
        }
      });

      item.classList.toggle("is-open");
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (nav && menuToggle) {
        nav.classList.remove("is-open");
        menuToggle.classList.remove("is-active");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-open");
      }

      dropdownItems.forEach(function (item) {
        item.classList.remove("is-open");
      });
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const productNav = document.getElementById("sgProductNav");
  const dropdown = document.getElementById("sgProductHeaderDropdown");

  if (!productNav || !dropdown) return;

  const API_ORIGIN = "https://solar.natriion.com/index.php";
  const PRODUCT_PAGE = "/san-pham.html";

  const CACHE_KEY = "sg_header_product_parent_categories_cache_v1";
  const CACHE_TTL = 5 * 60 * 1000;

  let isLoaded = false;
  let isLoading = false;
  let abortController = null;

  // Tạo URL API lấy danh mục sản phẩm
  function buildCategoryApiUrl() {
    const url = new URL(API_ORIGIN);

    url.searchParams.set("rest_route", "/wc/store/v1/products/categories");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("hide_empty", "false");

    return url.toString();
  }

  // Lấy cache danh mục cha
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

  // Lưu cache danh mục cha trong 5 phút
  function setCache(data) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          time: Date.now(),
          data: data,
        }),
      );
    } catch (error) {}
  }

  // Format tên danh mục
  function normalizeCategoryName(name) {
    return String(name || "")
      .replace("(", " (")
      .trim();
  }

  // Ẩn danh mục không cần hiển thị
  function shouldHideCategory(category) {
    return category.slug === "uncategorized";
  }

  // Lấy icon theo danh mục
  function getCategoryIcon(slug) {
    const iconMap = {
      "cac-goi-lap-dat": "fa-boxes-stacked",
      inverter: "fa-plug-circle-bolt",
      panel: "fa-solar-panel",
      battery: "fa-battery-full",
    };

    return iconMap[slug] || "fa-box";
  }

  // Sắp xếp danh mục cha đúng thứ tự yêu cầu
  function sortParentCategories(categories) {
    const order = ["cac-goi-lap-dat", "inverter", "panel", "battery"];

    return categories.sort(function (a, b) {
      const indexA = order.indexOf(a.slug);
      const indexB = order.indexOf(b.slug);

      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }

  // Chỉ lấy danh mục cha từ API
  function getParentCategories(categories) {
    return sortParentCategories(
      categories.filter(function (category) {
        return Number(category.parent) === 0 && !shouldHideCategory(category);
      }),
    );
  }

  // Tạo link qua trang sản phẩm theo category cha
  function getCategoryUrl(category) {
    return `${PRODUCT_PAGE}?category=${encodeURIComponent(
      category.id,
    )}&category_slug=${encodeURIComponent(
      category.slug || "",
    )}&category_name=${encodeURIComponent(normalizeCategoryName(category.name))}`;
  }

  // Render dropdown danh mục cha
  function renderParentCategories(categories) {
    if (!categories.length) {
      dropdown.innerHTML = `
        <div class="sg-product-header-empty">
          Chưa có danh mục sản phẩm.
        </div>
      `;
      return;
    }

    dropdown.innerHTML = categories
      .map(function (category) {
        return `
          <a href="${getCategoryUrl(category)}">
            <i class="fa-solid ${getCategoryIcon(category.slug)}"></i>
            ${normalizeCategoryName(category.name)}
          </a>
        `;
      })
      .join("");
  }

  // Gọi API lấy tất cả danh mục, sau đó lọc danh mục cha
  async function fetchParentCategoriesFromApi() {
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();

    const response = await fetch(buildCategoryApiUrl(), {
      cache: "no-store",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh mục sản phẩm");
    }

    const categories = await response.json();

    return getParentCategories(Array.isArray(categories) ? categories : []);
  }

  // Hover Product nav thì load danh mục cha
  async function loadProductNavCategories() {
    if (isLoaded || isLoading) return;

    isLoading = true;

    const cachedCategories = getCache();

    if (cachedCategories) {
      renderParentCategories(cachedCategories);
      isLoaded = true;
      isLoading = false;
      return;
    }

    dropdown.innerHTML = `
      <div class="sg-product-header-loading">
        Đang tải danh mục...
      </div>
    `;

    try {
      const parentCategories = await fetchParentCategoriesFromApi();

      setCache(parentCategories);
      renderParentCategories(parentCategories);

      isLoaded = true;
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Header product category error:", error);

      dropdown.innerHTML = `
        <div class="sg-product-header-empty">
          Không thể tải danh mục sản phẩm.
        </div>
      `;
    } finally {
      isLoading = false;
    }
  }

  loadProductNavCategories();
});
