const API_BASE = "https://solar.natriion.com/wp-json/sgs/v1";
// Fallback nếu /wp-json/ bị lỗi:
// const API_BASE = "https://solar.natriion.com/index.php?rest_route=/sgs/v1";

const form = document.querySelector("#solarComboForm");
const resultBox = document.querySelector("#resultBox");
const submitBtn = document.querySelector("#submitBtn");

const provinceSelect = document.querySelector("#provinceSelect");
const customerTypeSelect = document.querySelector("#customerTypeSelect");
const tierField = document.querySelector("#tierField");
const tierSelect = document.querySelector("#tierSelect");
const systemTypeSelect = document.querySelector("#systemTypeSelect");
const phaseSelect = document.querySelector("#phaseSelect");
const batterySelect = document.querySelector("#batterySelect");
const batteryField = document.querySelector("#batteryField");
const daytimeRatio = document.querySelector("#daytimeRatio");
const daytimeValue = document.querySelector("#daytimeValue");
// const monthlyBillInput = document.querySelector("#monthlyBillInput");
const monthlyBillInput = document.querySelector('[name="monthly_bill"]');

let optionMatrix = {};
let allOptions = {};

document.addEventListener("DOMContentLoaded", initSolarComboTool);

async function initSolarComboTool() {
  bindEvents();
  await loadOptions();
  syncFieldsByCustomerType();
}

// function bindEvents() {
//   daytimeRatio.addEventListener("input", () => {
//     daytimeValue.textContent = daytimeRatio.value;
//   });

//   customerTypeSelect.addEventListener("change", syncFieldsByCustomerType);
//   systemTypeSelect.addEventListener("change", syncFieldsBySystemType);

//   form.addEventListener("submit", async (event) => {
//     event.preventDefault();
//     await handleSubmit();
//   });
// }
function bindEvents() {
  daytimeRatio.addEventListener("input", () => {
    daytimeValue.textContent = daytimeRatio.value;
  });

  if (monthlyBillInput) {
    monthlyBillInput.addEventListener("input", handleMonthlyBillInput);
    monthlyBillInput.addEventListener("blur", handleMonthlyBillBlur);
    monthlyBillInput.addEventListener("focus", handleMonthlyBillFocus);
  }

  customerTypeSelect.addEventListener("change", syncFieldsByCustomerType);
  systemTypeSelect.addEventListener("change", syncFieldsBySystemType);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleSubmit();
  });
}
function parseCurrencyValue(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function formatCurrencyInput(value) {
  const number = parseCurrencyValue(value);

  if (!number) return "";

  return `${number.toLocaleString("vi-VN")} đ`;
}

function handleMonthlyBillInput(event) {
  const input = event.target;
  const number = parseCurrencyValue(input.value);

  input.value = number ? number.toLocaleString("vi-VN") : "";
}

function handleMonthlyBillBlur(event) {
  const input = event.target;

  input.value = formatCurrencyInput(input.value);
}

function handleMonthlyBillFocus(event) {
  const input = event.target;

  const number = parseCurrencyValue(input.value);
  input.value = number ? String(number) : "";
}

async function loadOptions() {
  try {
    setSelectLoading(true);
    const data = await apiGet("/options");

    if (!data.ok) throw new Error("Không lấy được dữ liệu options");

    allOptions = data;
    optionMatrix = data.option_matrix || {};

    fillSelect(provinceSelect, data.provinces || [], "Chọn tỉnh/thành");
    fillSelect(customerTypeSelect, data.customer_types || [], "Chọn đối tượng");

    fillSelect(tierSelect, [], "Chọn phân khúc");
    fillSelect(systemTypeSelect, [], "Chọn loại hệ thống");
    fillSelect(phaseSelect, [], "Chọn pha điện");
    fillSelect(batterySelect, [], "Để hệ thống tự chọn");
  } catch (error) {
    console.error(error);
    showError(
      "Không tải được dữ liệu form từ API. Kiểm tra plugin hoặc link /options.",
    );
    setFallbackOptions();
  } finally {
    setSelectLoading(false);
  }
}

function setSelectLoading(isLoading) {
  [
    provinceSelect,
    customerTypeSelect,
    tierSelect,
    systemTypeSelect,
    phaseSelect,
    batterySelect,
  ].forEach((select) => {
    if (select) select.disabled = isLoading;
  });
}

function setFallbackOptions() {
  fillSelect(
    provinceSelect,
    ["TP. Hồ Chí Minh", "Đồng Nai", "Bình Dương", "Đà Nẵng", "Hà Nội"],
    "Chọn tỉnh/thành",
  );
  fillSelect(
    customerTypeSelect,
    ["Gia đình", "Doanh nghiệp", "Công nghiệp"],
    "Chọn đối tượng",
  );

  optionMatrix = {
    "Gia đình": {
      tiers: ["Tiêu chuẩn", "Cao cấp"],
      system_types: ["Hệ lưu trữ", "Hệ không lưu trữ"],
      phases: ["1 pha", "3 pha"],
      battery_options: [5.12, 6.9, 10],
      by_system_type: {
        "Hệ lưu trữ": {
          tiers: ["Tiêu chuẩn", "Cao cấp"],
          phases: ["1 pha", "3 pha"],
          battery_options: [5.12, 6.9, 10],
        },
        "Hệ không lưu trữ": {
          tiers: ["Tiêu chuẩn", "Cao cấp"],
          phases: ["1 pha", "3 pha"],
          battery_options: [],
        },
      },
    },
  };

  syncFieldsByCustomerType();
}

function fillSelect(select, items = [], placeholder = "Chọn", labelFormatter) {
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.appendChild(empty);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = labelFormatter ? labelFormatter(item) : item;
    select.appendChild(option);
  });
}

function syncFieldsByCustomerType() {
  const customerType = customerTypeSelect.value;
  const matrix = optionMatrix[customerType] || {};
  const isFamily = customerType === "Gia đình";

  const oldSystemType = systemTypeSelect.value;
  const oldTier = tierSelect.value;
  const oldPhase = phaseSelect.value;

  const systemTypes = matrix.system_types || [];
  fillSelect(
    systemTypeSelect,
    systemTypes,
    systemTypes.length ? "Chọn loại hệ thống" : "Chưa có gói phù hợp",
  );
  systemTypeSelect.disabled = !systemTypes.length;

  if (systemTypes.includes(oldSystemType)) {
    systemTypeSelect.value = oldSystemType;
  }

  tierField.style.display = isFamily ? "grid" : "none";
  tierSelect.required = isFamily;
  tierSelect.disabled = !isFamily;

  if (isFamily) {
    const tiers = matrix.tiers || [];
    fillSelect(
      tierSelect,
      tiers,
      tiers.length ? "Chọn phân khúc" : "Chưa có phân khúc",
    );
    tierSelect.disabled = !tiers.length;
    if (tiers.includes(oldTier)) {
      tierSelect.value = oldTier;
    }
  } else {
    fillSelect(tierSelect, [], "");
    tierSelect.value = "";
  }

  const phases = matrix.phases || [];
  fillSelect(
    phaseSelect,
    phases,
    phases.length ? "Chọn pha điện" : "Chưa có dữ liệu pha",
  );
  phaseSelect.disabled = !phases.length;
  if (phases.includes(oldPhase)) {
    phaseSelect.value = oldPhase;
  }

  syncFieldsBySystemType();
}

function syncFieldsBySystemType() {
  const customerType = customerTypeSelect.value;
  const systemType = systemTypeSelect.value;
  const matrix = optionMatrix[customerType] || {};
  const systemMatrix = matrix.by_system_type?.[systemType] || null;

  // Quan trọng:
  // Khi đổi Loại hệ thống, không được reset Điện sử dụng và Phân khúc gói.
  // Hai field đó độc lập với loại hệ thống trong UI hiện tại.
  // Chỉ cập nhật lại field Dung lượng pin theo customer_type + system_type.
  const batteryOptions = systemMatrix?.battery_options || [];
  const needBattery = systemType === "Hệ lưu trữ" || systemType === "Độc lập";

  if (needBattery) {
    const currentBattery = batterySelect.value;

    fillSelect(
      batterySelect,
      batteryOptions.filter((value) => Number(value) > 0),
      batteryOptions.length ? "Để hệ thống tự chọn" : "Chưa có dung lượng pin",
      (value) => `${formatNumber(value)} kWh`,
    );

    if (
      [...batterySelect.options].some(
        (option) => option.value === currentBattery,
      )
    ) {
      batterySelect.value = currentBattery;
    }

    batteryField.style.display = "grid";
    batterySelect.disabled = !batteryOptions.length;
  } else {
    fillSelect(batterySelect, [], "");
    batterySelect.value = "";
    batteryField.style.display = "none";
    batterySelect.disabled = true;
  }
}

async function handleSubmit() {
  const payload = getPayload();
  const validationError = validatePayload(payload);

  if (validationError) {
    showError(validationError);
    return;
  }

  try {
    setSubmitting(true);
    showLoading();

    const data = await apiPost("/calculate-quote", payload);

    if (!data.ok) {
      throw new Error(data.errors?.[0] || "Không tính được combo phù hợp");
    }

    renderResult(data);
  } catch (error) {
    console.error(error);
    showError(error.message || "Có lỗi khi tính combo. Vui lòng thử lại.");
  } finally {
    setSubmitting(false);
  }
}

function getPayload() {
  const formData = new FormData(form);
  const customerType = String(formData.get("customer_type") || "").trim();
  const systemType = String(formData.get("system_type") || "").trim();

  return {
    full_name: String(formData.get("full_name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    province: String(formData.get("province") || "").trim(),
    customer_type: customerType,
    monthly_bill: parseCurrencyValue(formData.get("monthly_bill")),
    daytime_ratio: Number(formData.get("daytime_ratio") || 70),
    phase: String(formData.get("phase") || "").trim(),
    tier:
      customerType === "Gia đình"
        ? String(formData.get("tier") || "").trim()
        : "",
    system_type: systemType,
    battery_kwh:
      systemType === "Hệ lưu trữ" || systemType === "Độc lập"
        ? Number(formData.get("battery_kwh") || 0)
        : 0,
    source_page: window.location.href,
  };
}

function validatePayload(payload) {
  if (!payload.full_name) return "Vui lòng nhập họ và tên.";
  if (!payload.phone) return "Vui lòng nhập số điện thoại/Zalo.";
  if (!payload.province) return "Vui lòng chọn tỉnh/thành.";
  if (!payload.customer_type) return "Vui lòng chọn đối tượng sử dụng.";

  if (!payload.monthly_bill || payload.monthly_bill < 1000000) {
    return "Tiền điện trung bình/tháng cần từ 1.000.000đ trở lên để hệ thống tính combo phù hợp.";
  }

  if (!payload.phase) return "Vui lòng chọn điện sử dụng.";

  if (payload.customer_type === "Gia đình" && !payload.tier) {
    return "Vui lòng chọn phân khúc gói.";
  }

  if (!payload.system_type) {
    return "Chưa có loại hệ thống phù hợp trong dữ liệu cho nhóm khách này.";
  }

  return "";
}

function getBenefitAfterPayback(calc) {
  if (Number(calc.benefit_after_payback) > 0) {
    return Number(calc.benefit_after_payback);
  }

  const systemLifetimeYears = Number(calc.system_lifetime_years || 25);
  const paybackYears = Number(calc.payback_years || 0);
  const yearlySaving = Number(calc.est_yearly_saving || 0);

  return Math.max(0, (systemLifetimeYears - paybackYears) * yearlySaving);
}

function renderResult(data) {
  console.log(data);
  const combo = data.combo || {};
  const calc = data.calculation || {};
  const normalized = data.input_normalized || {};
  const benefitAfterPayback = getBenefitAfterPayback(calc);
  const isFamily =
    normalized.customer_type === "Gia đình" ||
    combo.customer_type === "Gia đình";

  resultBox.className = "sgs-result";
  resultBox.innerHTML = `
    <div class="sgs-result-top">
      <span class="sgs-result-label">Combo phù hợp nhất</span>
      <h3>${escapeHtml(combo.display_name || "Gói solar đề xuất")}</h3>
      <div class="sgs-price">
        <strong>${formatVND(combo.est_price_vnd)}</strong>
      </div>
      <p class="sgs-result-note">
        ${escapeHtml(combo.note || "Gói được chọn dựa trên hóa đơn điện, khu vực và loại hệ thống khách chọn.")}
      </p>
    </div>

    <div class="sgs-metrics">
      <div class="sgs-metric">
        <span>Công suất hệ thống đề xuất</span>
        <strong>${formatNumber(calc.recommended_kwp)} kWp</strong>
      </div>
      <div class="sgs-metric">
        <span>Tiết kiệm dự kiến/tháng</span>
        <strong>${formatVND(calc.est_monthly_saving)}</strong>
      </div>
      <div class="sgs-metric">
        <span>Hoàn vốn dự kiến</span>
        <strong>${formatNumber(calc.payback_years)} năm</strong>
      </div>
      <div class="sgs-metric">
        <span>Lợi ích sau hoàn vốn</span>
        <strong>${formatVND(benefitAfterPayback)}</strong>
      </div>
    </div>

    <div class="sgs-detail">
      <h4>Thông tin kỹ thuật gói</h4>
      <div class="sgs-detail-grid">
        ${detailItem("Mã combo", combo.package_id)}
        ${detailItem("Đối tượng", combo.customer_type)}
        ${detailItem("Loại hệ thống", combo.system_type)}
        ${isFamily ? detailItem("Phân khúc", combo.tier) : ""}
        ${detailItem("Pha điện", combo.phase)}
        ${detailItem("Công suất gói chọn", `${formatNumber(combo.kwp_dc)} kWp`)}
        ${detailItem("Công suất đề xuất", `${formatNumber(normalized.recommended_kwp || calc.recommended_kwp)} kWp`)}
        ${detailItem("Số tấm pin", combo.panel_qty ? `${combo.panel_qty} tấm` : "Đang cập nhật")}
        ${detailItem("Model tấm pin", combo.panel_model || "Đang cập nhật")}
        ${detailItem("Inverter", combo.inverter_model || "Đang cập nhật")}
        ${detailItem("Pin lưu trữ", combo.battery_kwh ? `${formatNumber(combo.battery_kwh)} kWh` : "Không có")}
        ${detailItem("Diện tích mái cần có", combo.roof_area_m2 ? `${formatNumber(combo.roof_area_m2)} m²` : "Cần khảo sát")}
      </div>
    </div>

    <div class="sgs-detail">
      <h4>Phân tích sản lượng</h4>
      <div class="sgs-detail-grid">
        ${detailItem("Sản lượng tỉnh", `${formatNumber(calc.kwh_per_kwp_month)} kWh/kWp/tháng`)}
        ${detailItem("Điện tiêu thụ/tháng", `${formatNumber(calc.monthly_kwh)} kWh`)}
        ${detailItem("Điện ban ngày", `${formatNumber(calc.daytime_kwh)} kWh`)}
        ${detailItem("Sản lượng solar/tháng", `${formatNumber(calc.solar_monthly_kwh)} kWh`)}
        ${Number(calc.direct_solar_kwh || 0) > 0 ? detailItem("Điện dùng trực tiếp", `${formatNumber(calc.direct_solar_kwh)} kWh`) : ""}
        ${Number(calc.battery_saved_kwh || 0) > 0 ? detailItem("Điện dùng qua pin", `${formatNumber(calc.battery_saved_kwh)} kWh`) : ""}
        ${Number(calc.total_coverage_percent || 0) > 0 ? detailItem("Tỷ lệ đáp ứng tổng nhu cầu", `${formatNumber(calc.total_coverage_percent)}%`) : ""}
        ${detailItem("Tiết kiệm dự kiến/năm", formatVND(calc.est_yearly_saving))}
        ${detailItem("Lợi ích sau hoàn vốn", formatVND(benefitAfterPayback))}
      </div>
    </div>

    <div class="sgs-disclaimer">
      ${escapeHtml("Bảng phân tích chỉ mang tính tham khảo, báo giá và thời gian hoàn vốn chính xác phụ thuộc vào thực tế khảo sát.")}
    </div>

    <div class="sgs-lead-id">Mã lượt khảo sát: ${escapeHtml(data.lead_id || "")}</div>
  `;
}

function detailItem(label, value) {
  return `
    <div class="sgs-detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Đang cập nhật")}</strong>
    </div>
  `;
}

function showLoading() {
  resultBox.className = "sgs-loading";
  resultBox.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center;">
      <div class="sgs-spinner"></div>
      <img src="./assets/dance2.gif" alt="" width="250"/>
      <h3 style="margin-top:20px">Hệ thống đang chọn gói phù hợp nhất với nhu cầu của bạn</h3>
    </div>
  `;
}

function showError(message) {
  resultBox.className = "";
  resultBox.innerHTML = `
    <div class="sgs-error">
      <strong>Chưa thể tính giá.</strong><br>
      ${escapeHtml(message)}
    </div>
  `;
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.querySelector("span").textContent = isSubmitting
    ? "Đang phân tích..."
    : "Phân tích & tính giá combo";
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `API lỗi ${res.status}`);
  }

  return data;
}

async function apiPost(path, payload) {
  const url = `${API_BASE}${path}`;

  console.log("POST URL:", url);
  console.log("POST PAYLOAD:", payload);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("RAW RESPONSE:", text);

  let data = {};
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("API không trả JSON. Kiểm tra lỗi PHP/plugin.");
  }

  if (!res.ok || !data.ok) {
    throw new Error(
      data.errors?.[0] || data.message || `API lỗi ${res.status}`,
    );
  }

  return data;
}

function formatVND(value) {
  const number = Number(value || 0);

  return number.toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  const number = Number(value || 0);

  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
