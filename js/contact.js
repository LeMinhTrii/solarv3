document.addEventListener("DOMContentLoaded", function () {
  const contactForm = document.getElementById("sgContactForm");

  if (!contactForm) return;

  const CONTACT_SHEET_API =
    "https://script.google.com/macros/s/AKfycbznE_vlgyVk106aIu0hY2bDz2qSZdYK3G2CxXFtkNIYKKYYOdv_f-WpYix8qYxC0uBBsg/exec";
  const submitBtn = contactForm.querySelector(".sg-contact-submit");

  // Validate số điện thoại Việt Nam cơ bản
  function isValidPhone(phone) {
    return /^(0|\+84)[0-9]{9,10}$/.test(String(phone || "").replace(/\s/g, ""));
  }

  // Lấy dữ liệu từ form
  function getContactPayload() {
    const formData = new FormData(contactForm);

    return {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      source_page: window.location.href,
      user_agent: navigator.userAgent,
    };
  }

  // Kiểm tra dữ liệu trước khi gửi
  function validateContactPayload(payload) {
    if (!payload.name) {
      return "Vui lòng nhập họ và tên.";
    }

    if (!payload.phone) {
      return "Vui lòng nhập số điện thoại.";
    }

    if (!isValidPhone(payload.phone)) {
      return "Số điện thoại chưa đúng định dạng.";
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return "Email chưa đúng định dạng.";
    }

    return "";
  }

  // Set trạng thái button
  function setContactSubmitting(isSubmitting) {
    if (!submitBtn) return;

    submitBtn.disabled = isSubmitting;

    submitBtn.innerHTML = isSubmitting
      ? `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Đang gửi thông tin...
      `
      : `
        <i class="fa-solid fa-paper-plane"></i>
        Đăng ký khảo sát miễn phí
      `;
  }

  // Hiển thị thông báo
  function showContactMessage(type, message) {
    let messageEl = contactForm.querySelector(".sg-contact-message");

    if (!messageEl) {
      messageEl = document.createElement("div");
      messageEl.className = "sg-contact-message";
      contactForm.appendChild(messageEl);
    }

    messageEl.className = `sg-contact-message is-${type}`;
    messageEl.textContent = message;
  }

  // Gửi data lên Google Sheet
  async function sendContactToSheet(payload) {
    const response = await fetch(CONTACT_SHEET_API, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    let data = {};

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("API không trả JSON hợp lệ.");
    }

    if (!data.ok) {
      throw new Error(data.message || "Không gửi được thông tin.");
    }

    return data;
  }

  // Submit form
  contactForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const payload = getContactPayload();
    const validationError = validateContactPayload(payload);

    if (validationError) {
      showContactMessage("error", validationError);
      return;
    }

    try {
      setContactSubmitting(true);
      showContactMessage("loading", "Đang gửi thông tin, vui lòng chờ...");

      await sendContactToSheet(payload);

      showContactMessage(
        "success",
        "Thông tin đã được gửi thành công. Solar Green sẽ liên hệ tư vấn sớm nhất.",
      );

      contactForm.reset();
    } catch (error) {
      console.error("Contact form error:", error);

      showContactMessage(
        "error",
        error.message || "Có lỗi khi gửi thông tin. Vui lòng thử lại.",
      );
    } finally {
      setContactSubmitting(false);
    }
  });
});
