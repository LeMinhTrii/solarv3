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
