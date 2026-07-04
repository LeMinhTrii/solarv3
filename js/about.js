document.addEventListener("DOMContentLoaded", function () {
  const whyItems = document.querySelectorAll(".sg-why-qa-item");

  whyItems.forEach(function (item) {
    const button = item.querySelector(".sg-why-qa-question");

    if (!button) return;

    button.addEventListener("click", function () {
      const isOpen = item.classList.contains("is-open");

      whyItems.forEach(function (qa) {
        qa.classList.remove("is-open");

        const qaBtn = qa.querySelector(".sg-why-qa-question");
        if (qaBtn) {
          qaBtn.setAttribute("aria-expanded", "false");
        }
      });

      if (!isOpen) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
});
