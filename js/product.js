document.addEventListener("DOMContentLoaded", function () {
  const categoryRender = document.getElementById("sgpCategoryRender");
  const renderEl = document.getElementById("sgpRender");
  const titleEl = document.getElementById("sgpCurrentTitle");
  const pathEl = document.getElementById("sgpCurrentPath");
  const backBtn = document.getElementById("sgpBackBtn");

  if (!categoryRender || !renderEl || !titleEl || !pathEl || !backBtn) return;

  const API_ORIGIN = "https://solar.natriion.com/index.php";
  const FALLBACK_IMAGE = "/assets/products/product-placeholder.jpg";

  const CATEGORY_CACHE_KEY = "sg_product_categories_cache_v3";
  const PRODUCT_ALL_CACHE_KEY = "sg_product_all_cache_v3";
  const DETAIL_CACHE_PREFIX = "sg_product_detail_cache_v3_";
  const CACHE_TTL = 5 * 60 * 1000;

  const initialCount = 9;
  const loadStep = 9;

  let categoryTree = [];
  let allProducts = [];
  let currentProducts = [];

  let currentMode = "all";
  let currentParent = null;
  let currentChild = null;
  let visibleCount = 0;

  let allProductsPromise = null;
  let categoryAbortController = null;
  let productAbortController = null;
  let detailAbortController = null;

  const loadMoreBtn = ensureLoadMoreButton();

  // Tự tạo nút Load More nếu HTML chưa có
  function ensureLoadMoreButton() {
    let button = document.getElementById("sgpLoadMoreBtn");

    if (button) return button;

    const wrap = document.createElement("div");
    wrap.className = "sgp-load-more-wrap";

    wrap.innerHTML = `
      <button class="sgp-load-more is-hide" id="sgpLoadMoreBtn" type="button">
        Xem thêm sản phẩm
        <i class="fa-solid fa-arrow-down"></i>
      </button>
    `;

    renderEl.insertAdjacentElement("afterend", wrap);

    return document.getElementById("sgpLoadMoreBtn");
  }

  // Tạo URL API
  function buildApiUrl(restRoute, params = {}) {
    const url = new URL(API_ORIGIN);
    url.searchParams.set("rest_route", restRoute);

    Object.entries(params).forEach(function ([key, value]) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  // Xóa HTML lấy text
  function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
  }

  // Chống lỗi render text
  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Lấy cache
  function getCache(key) {
    try {
      const cache = JSON.parse(localStorage.getItem(key) || "null");

      if (!cache || !cache.time || !cache.data) return null;
      if (Date.now() - cache.time > CACHE_TTL) return null;

      return cache.data;
    } catch (error) {
      return null;
    }
  }

  // Lưu cache
  function setCache(key, data) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          time: Date.now(),
          data: data,
        }),
      );
    } catch (error) {
      console.warn("Không thể lưu cache product:", error);
    }
  }

  // Format tên danh mục
  function normalizeCategoryName(name) {
    return String(name || "")
      .replace("(", " (")
      .trim();
  }

  // Chuẩn hóa text để sort category
  function normalizeKey(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Ẩn danh mục không dùng
  function shouldHideCategory(category) {
    return category.slug === "uncategorized";
  }

  // Thứ tự danh mục cha: Gói lắp đặt, Inverter, Panel, Battery
  function getParentSortIndex(category) {
    const slug = normalizeKey(category.slug);
    const name = normalizeKey(category.name);

    if (
      slug.includes("goi") ||
      slug.includes("cac-goi") ||
      name.includes("goi lap dat")
    ) {
      return 1;
    }

    if (slug.includes("inverter") || name.includes("inverter")) {
      return 2;
    }

    if (slug.includes("panel") || name.includes("panel")) {
      return 3;
    }

    if (
      slug.includes("battery") ||
      slug.includes("batterry") ||
      slug.includes("he-luu-tru") ||
      name.includes("battery") ||
      name.includes("batterry") ||
      name.includes("luu tru")
    ) {
      return 4;
    }

    return 999;
  }

  // Sort danh mục cha
  function sortParentCategories(parents) {
    return parents.sort(function (a, b) {
      return getParentSortIndex(a) - getParentSortIndex(b);
    });
  }

  // Lấy icon category
  function getCategoryIcon(category) {
    const slug = normalizeKey(category.slug);
    const name = normalizeKey(category.name);

    if (slug.includes("goi") || name.includes("goi lap dat")) {
      return "fa-boxes-stacked";
    }

    if (slug.includes("inverter") || name.includes("inverter")) {
      return "fa-plug-circle-bolt";
    }

    if (slug.includes("panel") || name.includes("panel")) {
      return "fa-solar-panel";
    }

    if (
      slug.includes("battery") ||
      slug.includes("batterry") ||
      slug.includes("he-luu-tru") ||
      name.includes("luu tru")
    ) {
      return "fa-battery-full";
    }

    return "fa-box";
  }

  // Lấy hình sản phẩm
  function getImage(product) {
    return (
      product?.images?.[0]?.src ||
      product?.images?.[0]?.thumbnail ||
      FALLBACK_IMAGE
    );
  }

  // Format giá
  function formatPrice(product) {
    const prices = product?.prices;

    if (!prices || !prices.price) return "";

    const minorUnit = Number(prices.currency_minor_unit || 0);
    const rawPrice = Number(prices.price || 0);
    const value = rawPrice / Math.pow(10, minorUnit);

    if (!value) return "";

    try {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: prices.currency_code || "VND",
        maximumFractionDigits: 0,
      }).format(value);
    } catch (error) {
      return `${value.toLocaleString("vi-VN")} ${prices.currency_code || ""}`;
    }
  }

  // Lấy short description
  function getShortDescription(product) {
    return (
      product?.short_description ||
      "<p>Sản phẩm thuộc hệ thống điện mặt trời Solar Green.</p>"
    );
  }

  // Lấy long description
  function getLongDescription(product) {
    return (
      product?.description ||
      "<p>Thông tin chi tiết sản phẩm đang được cập nhật.</p>"
    );
  }

  // Lọc sản phẩm trùng
  function uniqueProducts(products) {
    const map = new Map();

    products.forEach(function (product) {
      if (product && product.id) {
        map.set(product.id, product);
      }
    });

    return Array.from(map.values());
  }

  // Kiểm tra sản phẩm có thuộc category không
  function productHasCategory(product, categoryIds) {
    const ids = categoryIds.map(Number);

    return Array.isArray(product.categories)
      ? product.categories.some(function (category) {
          return ids.includes(Number(category.id));
        })
      : false;
  }

  // Lấy category id từ URL header nav truyền qua
  function getUrlCategoryId() {
    const params = new URLSearchParams(window.location.search);
    const categoryId = Number(params.get("category") || 0);

    return categoryId || null;
  }

  // Cache key detail
  function getDetailCacheKey(productId) {
    return `${DETAIL_CACHE_PREFIX}${productId}`;
  }

  // Skeleton sidebar
  function renderCategorySkeleton(count = 4) {
    categoryRender.innerHTML = Array.from({ length: count })
      .map(function () {
        return `
          <div class="sgp-category-skeleton-group">
            <div class="sgp-category-skeleton-parent">
              <div class="sgp-category-skeleton-icon"></div>
              <div class="sgp-category-skeleton-line"></div>
            </div>

            <div class="sgp-category-skeleton-sub-list">
              <div class="sgp-category-skeleton-sub"></div>
              <div class="sgp-category-skeleton-sub"></div>
              <div class="sgp-category-skeleton-sub"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Skeleton sản phẩm
  function renderProductSkeleton(count = 6) {
    renderEl.innerHTML = `
      <div class="sgp-grid">
        ${Array.from({ length: count })
          .map(function () {
            return `
              <article class="sgp-product-skeleton-card">
                <div class="sgp-product-skeleton-img"></div>

                <div class="sgp-product-skeleton-body">
                  <div class="sgp-product-skeleton-line is-small"></div>
                  <div class="sgp-product-skeleton-line is-title"></div>
                  <div class="sgp-product-skeleton-line is-title-short"></div>
                  <div class="sgp-product-skeleton-line is-text"></div>
                  <div class="sgp-product-skeleton-line is-text-short"></div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;

    loadMoreBtn.classList.add("is-hide");
  }

  // Render empty
  function renderEmpty(message) {
    renderEl.innerHTML = `
      <div class="sgp-empty">${escapeHTML(message)}</div>
    `;

    loadMoreBtn.classList.add("is-hide");
  }

  // API lấy danh mục
  async function fetchCategoriesFromApi() {
    if (categoryAbortController) {
      categoryAbortController.abort();
    }

    categoryAbortController = new AbortController();

    const response = await fetch(
      buildApiUrl("/wc/store/v1/products/categories", {
        per_page: 100,
        hide_empty: false,
      }),
      {
        cache: "no-store",
        signal: categoryAbortController.signal,
      },
    );

    if (!response.ok) {
      throw new Error("Không lấy được danh mục sản phẩm");
    }

    return response.json();
  }

  // API lấy tất cả sản phẩm
  async function fetchAllProductsFromApi() {
    if (productAbortController) {
      productAbortController.abort();
    }

    productAbortController = new AbortController();

    const response = await fetch(
      buildApiUrl("/wc/store/v1/products", {
        per_page: 100,
        orderby: "date",
        order: "desc",
        _fields:
          "id,name,slug,images,short_description,description,permalink,categories,prices,attributes,sku",
      }),
      {
        cache: "no-store",
        signal: productAbortController.signal,
      },
    );

    if (!response.ok) {
      throw new Error("Không lấy được tất cả sản phẩm");
    }

    return response.json();
  }

  // API lấy chi tiết sản phẩm
  async function fetchProductDetailFromApi(productId) {
    if (detailAbortController) {
      detailAbortController.abort();
    }

    detailAbortController = new AbortController();

    const response = await fetch(
      buildApiUrl(`/wc/store/v1/products/${productId}`, {
        _fields:
          "id,name,slug,images,short_description,description,permalink,categories,prices,attributes,sku",
      }),
      {
        cache: "no-store",
        signal: detailAbortController.signal,
      },
    );

    if (!response.ok) {
      throw new Error("Không lấy được chi tiết sản phẩm");
    }

    return response.json();
  }

  // Build cây danh mục
  function buildCategoryTree(categories) {
    const cleanCategories = categories.filter(function (category) {
      return !shouldHideCategory(category);
    });

    const parents = sortParentCategories(
      cleanCategories.filter(function (category) {
        return Number(category.parent) === 0;
      }),
    );

    return parents.map(function (parent) {
      const children = cleanCategories.filter(function (child) {
        return Number(child.parent) === Number(parent.id);
      });

      return {
        ...parent,
        children: children,
      };
    });
  }

  // Tìm category theo id
  function findCategoryById(categoryId) {
    for (const parent of categoryTree) {
      if (Number(parent.id) === Number(categoryId)) {
        return {
          type: "parent",
          parent: parent,
          child: null,
        };
      }

      const child = parent.children.find(function (item) {
        return Number(item.id) === Number(categoryId);
      });

      if (child) {
        return {
          type: "child",
          parent: parent,
          child: child,
        };
      }
    }

    return null;
  }

  // Set active parent
  function setActiveParent(parentId) {
    document.querySelectorAll(".sgp-parent").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        Number(btn.dataset.parentId) === Number(parentId),
      );
    });
  }

  // Set active child
  function setActiveChild(childId) {
    document.querySelectorAll(".sgp-subcategory").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        Number(btn.dataset.childId) === Number(childId),
      );
    });
  }

  // Clear active sidebar
  function clearActiveSidebar() {
    document.querySelectorAll(".sgp-parent").forEach(function (btn) {
      btn.classList.remove("is-active");
    });

    document.querySelectorAll(".sgp-subcategory").forEach(function (btn) {
      btn.classList.remove("is-active");
    });
  }

  // Render sidebar category
  function renderCategories(tree) {
    if (!tree.length) {
      categoryRender.innerHTML = `
        <div class="sgp-empty">Chưa có danh mục sản phẩm.</div>
      `;
      return;
    }

    categoryRender.innerHTML = tree
      .map(function (parent) {
        const parentName = normalizeCategoryName(parent.name);

        const childHTML = parent.children
          .map(function (child) {
            const childName = normalizeCategoryName(child.name);

            return `
              <button
                class="sgp-subcategory"
                type="button"
                data-parent-id="${parent.id}"
                data-parent-name="${escapeHTML(parentName)}"
                data-child-id="${child.id}"
                data-child-name="${escapeHTML(childName)}"
              >
                ${escapeHTML(childName)}
              </button>
            `;
          })
          .join("");

        return `
          <div class="sgp-category-group">
            <button
              class="sgp-parent"
              type="button"
              data-parent-id="${parent.id}"
              data-parent-name="${escapeHTML(parentName)}"
            >
              <span>
                <i class="fa-solid ${getCategoryIcon(parent)}"></i>
                ${escapeHTML(parentName)}
              </span>
            </button>

            ${
              parent.children.length
                ? `<div class="sgp-sub-list">${childHTML}</div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    bindCategoryEvents();
  }

  // Bind click category
  function bindCategoryEvents() {
    document.querySelectorAll(".sgp-parent").forEach(function (btn) {
      btn.addEventListener("click", function () {
        renderParentCategory(
          Number(btn.dataset.parentId),
          btn.dataset.parentName,
        );
      });
    });

    document.querySelectorAll(".sgp-subcategory").forEach(function (btn) {
      btn.addEventListener("click", function () {
        renderChildCategory(
          Number(btn.dataset.parentId),
          btn.dataset.parentName,
          Number(btn.dataset.childId),
          btn.dataset.childName,
        );
      });
    });
  }

  // Load category có cache 5 phút
  async function loadCategories() {
    const cachedCategories = getCache(CATEGORY_CACHE_KEY);

    if (cachedCategories) {
      categoryTree = buildCategoryTree(cachedCategories);
      renderCategories(categoryTree);
      return categoryTree;
    }

    renderCategorySkeleton(4);

    const categories = await fetchCategoriesFromApi();

    setCache(CATEGORY_CACHE_KEY, categories);

    categoryTree = buildCategoryTree(categories);
    renderCategories(categoryTree);

    return categoryTree;
  }

  // Load tất cả sản phẩm có cache 5 phút
  async function loadAllProductsData(showSkeleton = true) {
    const cachedProducts = getCache(PRODUCT_ALL_CACHE_KEY);

    if (cachedProducts) {
      allProducts = uniqueProducts(cachedProducts);
      return allProducts;
    }

    if (allProductsPromise) return allProductsPromise;

    if (showSkeleton) renderProductSkeleton(6);

    allProductsPromise = fetchAllProductsFromApi()
      .then(function (products) {
        allProducts = uniqueProducts(Array.isArray(products) ? products : []);
        setCache(PRODUCT_ALL_CACHE_KEY, allProducts);
        return allProducts;
      })
      .finally(function () {
        allProductsPromise = null;
      });

    return allProductsPromise;
  }

  // Set Load More
  function setLoadMoreState() {
    const remaining = currentProducts.length - visibleCount;

    if (remaining <= 0) {
      loadMoreBtn.classList.add("is-hide");
      return;
    }

    const nextCount = Math.min(loadStep, remaining);

    loadMoreBtn.classList.remove("is-hide");
    loadMoreBtn.classList.remove("is-loading");
    loadMoreBtn.disabled = false;

    loadMoreBtn.innerHTML = `
      Xem thêm ${nextCount} sản phẩm
      <i class="fa-solid fa-arrow-down"></i>
    `;
  }

  // Loading nút Load More
  function setLoadMoreLoading() {
    loadMoreBtn.classList.add("is-loading");
    loadMoreBtn.disabled = true;

    loadMoreBtn.innerHTML = `
      Đang tải...
      <i class="fa-solid fa-spinner fa-spin"></i>
    `;
  }

  // Tạo card sản phẩm
  function createProductCard(product) {
    const article = document.createElement("article");
    article.className = "sgp-card";
    article.dataset.productId = product.id;

    const shortText =
      stripHTML(product.short_description) ||
      stripHTML(product.description) ||
      "Sản phẩm thuộc hệ thống điện mặt trời Solar Green.";

    const priceText = formatPrice(product);

    article.innerHTML = `
      <div class="sgp-card-img">
        <img
          src="${escapeHTML(getImage(product))}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
        />
      </div>

      <div class="sgp-card-body">
        <small>${escapeHTML(product.categories?.[0]?.name || "Sản phẩm")}</small>
        <h3>${escapeHTML(product.name)}</h3>
        <p>${escapeHTML(shortText)}</p>
        ${priceText ? `<div class="sgp-price">${escapeHTML(priceText)}</div>` : ""}
      </div>
    `;

    article.addEventListener("click", function () {
      renderProductDetail(product.id, product);
    });

    return article;
  }

  // Append sản phẩm cho Load More
  function appendProducts(from, to) {
    const grid = renderEl.querySelector(".sgp-grid");
    if (!grid) return;

    const fragment = document.createDocumentFragment();

    currentProducts.slice(from, to).forEach(function (product) {
      fragment.appendChild(createProductCard(product));
    });

    grid.appendChild(fragment);
  }

  // Render list sản phẩm
  function renderProductList(products, emptyMessage) {
    currentProducts = uniqueProducts(products);
    visibleCount = Math.min(initialCount, currentProducts.length);

    backBtn.classList.remove("is-show");

    if (!currentProducts.length) {
      renderEmpty(emptyMessage || "Chưa có sản phẩm.");
      return;
    }

    renderEl.innerHTML = `<div class="sgp-grid"></div>`;

    appendProducts(0, visibleCount);
    setLoadMoreState();
  }

  // Render tất cả sản phẩm khi vào /san-pham.html
  async function renderAllProducts() {
    currentMode = "all";
    currentParent = null;
    currentChild = null;

    clearActiveSidebar();

    titleEl.textContent = "Tất cả sản phẩm";
    pathEl.textContent = "Sản phẩm";

    try {
      const products = await loadAllProductsData(true);
      renderProductList(products, "Chưa có sản phẩm nào.");
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("All products error:", error);
      renderEmpty("Không thể tải sản phẩm. Vui lòng thử lại sau.");
    }
  }

  // Render sản phẩm theo parent: parent + children
  async function renderParentCategory(parentId, parentName) {
    currentMode = "parent";
    currentParent = {
      id: parentId,
      name: parentName,
    };
    currentChild = null;

    setActiveParent(parentId);
    setActiveChild(null);

    titleEl.textContent = parentName;
    pathEl.textContent = parentName;

    try {
      const products = await loadAllProductsData(true);
      const found = findCategoryById(parentId);
      const parent = found?.parent;

      if (!parent) {
        renderProductList([], "Chưa có sản phẩm trong danh mục này.");
        return;
      }

      const categoryIds = [
        parent.id,
        ...parent.children.map(function (child) {
          return child.id;
        }),
      ];

      const filteredProducts = products.filter(function (product) {
        return productHasCategory(product, categoryIds);
      });

      renderProductList(
        filteredProducts,
        "Chưa có sản phẩm trong danh mục này.",
      );
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Parent products error:", error);
      renderEmpty("Không thể tải sản phẩm. Vui lòng thử lại sau.");
    }
  }

  // Render sản phẩm theo child
  async function renderChildCategory(parentId, parentName, childId, childName) {
    currentMode = "child";
    currentParent = {
      id: parentId,
      name: parentName,
    };
    currentChild = {
      id: childId,
      name: childName,
    };

    setActiveParent(parentId);
    setActiveChild(childId);

    titleEl.textContent = childName;
    pathEl.textContent = `${parentName} / ${childName}`;

    try {
      const products = await loadAllProductsData(true);

      const filteredProducts = products.filter(function (product) {
        return productHasCategory(product, [childId]);
      });

      renderProductList(
        filteredProducts,
        "Chưa có sản phẩm trong danh mục này.",
      );
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Child products error:", error);
      renderEmpty("Không thể tải sản phẩm. Vui lòng thử lại sau.");
    }
  }

  // Render detail sản phẩm
  async function renderProductDetail(productId, fallbackProduct) {
    backBtn.classList.add("is-show");
    loadMoreBtn.classList.add("is-hide");

    const cachedDetail = getCache(getDetailCacheKey(productId));
    let product = cachedDetail || fallbackProduct;

    if (product) {
      renderProductDetailHTML(product);
    } else {
      renderProductSkeleton(1);
    }

    if (cachedDetail) return;

    try {
      const freshProduct = await fetchProductDetailFromApi(productId);

      setCache(getDetailCacheKey(productId), freshProduct);
      renderProductDetailHTML(freshProduct);
    } catch (error) {
      if (error.name === "AbortError") return;

      console.warn("Product detail fallback:", error);

      if (!product) {
        renderEmpty("Không thể tải chi tiết sản phẩm.");
      }
    }
  }

  // Render HTML detail: trên 2 cột, dưới full mô tả dài
  function renderProductDetailHTML(product) {
    const priceText = formatPrice(product);
    const shortDesc = getShortDescription(product);
    const longDesc = getLongDescription(product);

    titleEl.textContent = product.name;

    if (currentMode === "child" && currentChild) {
      pathEl.textContent = `${currentParent.name} / ${currentChild.name} / ${product.name}`;
    } else if (currentMode === "parent" && currentParent) {
      pathEl.textContent = `${currentParent.name} / ${product.name}`;
    } else {
      pathEl.textContent = `Sản phẩm / ${product.name}`;
    }

    const skuHTML = product.sku
      ? `
        <div class="sgp-spec">
          <strong>Mã sản phẩm</strong>
          <span>${escapeHTML(product.sku)}</span>
        </div>
      `
      : "";

    const attributesHTML = Array.isArray(product.attributes)
      ? product.attributes
          .map(function (attr) {
            const value = Array.isArray(attr.terms)
              ? attr.terms.map((term) => term.name).join(", ")
              : "";

            if (!value) return "";

            return `
              <div class="sgp-spec">
                <strong>${escapeHTML(attr.name)}</strong>
                <span>${escapeHTML(value)}</span>
              </div>
            `;
          })
          .join("")
      : "";

    const specsHTML = `${skuHTML}${attributesHTML}`;

    renderEl.innerHTML = `
      <article class="sgp-detail">
        <div class="sgp-detail-top">
          <div class="sgp-detail-img">
            <img
              src="${escapeHTML(getImage(product))}"
              alt="${escapeHTML(product.name)}"
              onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
            />
          </div>

          <div class="sgp-detail-content">
            <small>${escapeHTML(product.categories?.[0]?.name || "Sản phẩm")}</small>

            <h2>${escapeHTML(product.name)}</h2>

            ${priceText ? `<div class="sgp-price">${escapeHTML(priceText)}</div>` : ""}

            <div class="sgp-detail-short">
              ${shortDesc}
            </div>

            ${
              specsHTML
                ? `
                  <h3>Thông tin sản phẩm</h3>
                  <div class="sgp-specs">
                    ${specsHTML}
                  </div>
                `
                : ""
            }

            <div class="sgp-actions">
              <a href="/lien-he.html" class="sgp-btn">
                Nhận tư vấn
                <i class="fa-solid fa-arrow-right"></i>
              </a>

              <a href="tel:0902878519" class="sgp-btn is-light">
                <i class="fa-solid fa-phone"></i>
                Gọi tư vấn
              </a>
            </div>
          </div>
        </div>

        <div class="sgp-detail-long">
          <h3>Mô tả chi tiết</h3>

          <div class="sgp-product-description">
            ${longDesc}
          </div>
        </div>
      </article>
    `;

    loadMoreBtn.classList.add("is-hide");
  }

  // Back về list trước đó
  backBtn.addEventListener("click", function () {
    if (currentMode === "parent" && currentParent) {
      renderParentCategory(currentParent.id, currentParent.name);
      return;
    }

    if (currentMode === "child" && currentParent && currentChild) {
      renderChildCategory(
        currentParent.id,
        currentParent.name,
        currentChild.id,
        currentChild.name,
      );
      return;
    }

    renderAllProducts();
  });

  // Click Load More
  loadMoreBtn.addEventListener("click", function () {
    const oldCount = visibleCount;
    const newCount = Math.min(visibleCount + loadStep, currentProducts.length);

    setLoadMoreLoading();

    window.requestAnimationFrame(function () {
      appendProducts(oldCount, newCount);
      visibleCount = newCount;
      setLoadMoreState();
    });
  });

  // Init page
  async function initProductPage() {
    renderCategorySkeleton(4);
    renderProductSkeleton(6);

    try {
      await loadCategories();

      const urlCategoryId = getUrlCategoryId();

      if (urlCategoryId) {
        const found = findCategoryById(urlCategoryId);

        if (found?.type === "parent") {
          await renderParentCategory(
            found.parent.id,
            normalizeCategoryName(found.parent.name),
          );
          return;
        }

        if (found?.type === "child") {
          await renderChildCategory(
            found.parent.id,
            normalizeCategoryName(found.parent.name),
            found.child.id,
            normalizeCategoryName(found.child.name),
          );
          return;
        }
      }

      await renderAllProducts();
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Product init error:", error);

      categoryRender.innerHTML = `
        <div class="sgp-empty">
          Không thể tải danh mục sản phẩm.
        </div>
      `;

      renderEmpty("Không thể tải sản phẩm. Vui lòng thử lại sau.");
    }
  }

  initProductPage();
});

// cate bar mobile
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.querySelector(".sgp-sidebar");
  const sidebarHead = document.querySelector(".sgp-sidebar-head");
  const categoryRender = document.getElementById("sgpCategoryRender");

  if (!sidebar || !sidebarHead || !categoryRender) return;

  // Mobile: bấm tiêu đề để mở/đóng danh mục
  sidebarHead.addEventListener("click", function () {
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    sidebar.classList.toggle("is-open");
  });

  // Mobile: chọn danh mục xong thì tự đóng lại
  categoryRender.addEventListener("click", function (event) {
    const target = event.target.closest(".sgp-parent, .sgp-subcategory");

    if (!target) return;
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    setTimeout(function () {
      sidebar.classList.remove("is-open");
    }, 180);
  });
});
