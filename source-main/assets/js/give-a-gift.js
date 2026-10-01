/**
 * Give a Gift / Planting a Seed — danh sách bé, carousel và popup tặng quà.
 *
 * Tính năng giữ nguyên như planting-a-seed.js:
 * dữ liệu lấy từ API sản phẩm, mỗi "product" là một bé,
 * `description` là câu trích, `categories[0]` là nhóm tuổi.
 */

// ==============================================
// HEADER: MENU MOBILE + CUỘN MƯỢT
// ==============================================
(function () {
    const header = document.getElementById('gg-header');
    const toggle = document.getElementById('gg-menu-toggle');

    const setMenu = open => {
        header.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        toggle.textContent = open ? '×' : '☰';
    };

    toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const href = anchor.getAttribute('href');
            if (href === '#' || !href) return;
            const target = document.querySelector(href);
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setMenu(false);
        });
    });
})();

// ==============================================
// DỮ LIỆU
// ==============================================
const API_BASE = 'https://app.bloompod.vn';

// Gói dành cho đơn tặng quà. Giá lấy từ API, phần còn lại cố định.
// Phải khớp với gift_package_id trong order.js.
const IS_PRODUCTION = window.location.hostname === 'bloompod.vn' ||
    window.location.hostname === 'www.bloompod.vn';
const GIFT_PACKAGE_ID = IS_PRODUCTION ? 6 : 5;

const GIFT = {
    name: 'Bloompod Audio Learning Kit',
    forAge: 'For children aged 0 – 3',
    quantity: '01 Bloompod set',
    price: null,
    image: 'assets/images/bloompod_sp.png'
};

const ICON = name => `<svg class="gg-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const money = n => new Intl.NumberFormat('vi-VN').format(n) + ' VND';

/** URL ảnh từ API là đường dẫn tương đối, phải ghép thêm host */
const resolveUrl = path => {
    if (!path) return '';
    return /^https?:\/\//i.test(path) ? path : API_BASE + path;
};

const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

let categories = [];
let children = [];
let activeCategoryId = null;   // null = All Children

const grid = document.querySelector('#gg-grid');
const pills = document.querySelector('#gg-pills');
const sortSelect = document.querySelector('#gg-sort');
const statusText = document.querySelector('#gg-status');
const modal = document.querySelector('#gg-modal');
const modalBody = document.querySelector('#gg-modal-body');
const modalClose = document.querySelector('#gg-modal-close');

async function api(path) {
    const response = await fetch(API_BASE + path);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.json();
    return body.data || [];
}

/** Lấy giá gói tặng quà (total_cost) từ package-info */
async function loadGiftPrice() {
    try {
        const response = await fetch(API_BASE + '/api/profile/package-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', params: { package_id: GIFT_PACKAGE_ID } })
        });
        const body = await response.json();
        const pkg = body?.result?.success ? body.result.package : null;
        if (pkg) GIFT.price = Number(pkg.total_cost);
    } catch (error) {
        console.error('Error loading gift price:', error);
    }
}

/** Bé đã được tặng thì API trả is_visible = false */
const isGifted = child => child.is_visible === false;

const firstCategory = child => (child.categories || [])[0] || null;
const ageLabel = child => (firstCategory(child) || {}).name || '';
const ageOrder = child => (firstCategory(child) || {}).id || 0;

/** Màu nhãn tuổi: xoay vòng 4 màu theo vị trí nhóm tuổi trong danh sách */
const ageTone = child => {
    const category = firstCategory(child);
    const index = category ? categories.findIndex(c => c.id === category.id) : -1;
    return index < 0 ? 0 : index % 4;
};

// ==============================================
// BỘ LỌC + DANH SÁCH
// ==============================================

async function loadCategories() {
    try {
        categories = await api('/api/v1/products/categories');
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
    }

    // "All Children" cố định, các nhóm tuổi phía sau lấy từ API
    pills.innerHTML = '';
    pills.appendChild(makePill('All Children', '', true));
    categories.forEach(category => {
        pills.appendChild(makePill(category.name, category.id, false));
    });
}

function makePill(label, categoryId, isActive) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = isActive ? 'gg-pill is-active' : 'gg-pill';
    button.textContent = label;
    button.dataset.categoryId = categoryId;
    button.setAttribute('aria-pressed', String(isActive));
    return button;
}

async function loadChildren() {
    grid.innerHTML = '';
    statusText.textContent = 'Loading children…';
    try {
        // include_hidden để bé đã được tặng vẫn trả về (kèm is_visible: false),
        // nhờ vậy mới hiện mờ ở cuối danh sách thay vì biến mất
        const params = new URLSearchParams({ include_hidden: '1' });
        if (activeCategoryId) params.set('categoryId', activeCategoryId);
        children = await api('/api/v1/products?' + params.toString());
        statusText.textContent = children.length ? '' : 'No children in this group right now.';
    } catch (error) {
        console.error('Error loading children:', error);
        children = [];
        statusText.textContent = 'We couldn’t load the children right now. Please try again later.';
    }
    render();
}

function render() {
    const list = children.slice();
    const sort = sortSelect.value;

    // API không trả tuổi dạng số, dùng id nhóm tuổi làm thứ tự
    if (sort === 'youngest') list.sort((a, b) => ageOrder(a) - ageOrder(b));
    else if (sort === 'oldest') list.sort((a, b) => ageOrder(b) - ageOrder(a));
    else if (sort === 'name') list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));

    // Bé đã được tặng luôn nằm cuối, bất kể đang sắp xếp kiểu nào
    list.sort((a, b) => Number(isGifted(a)) - Number(isGifted(b)));

    grid.innerHTML = list.map(child => {
        const gifted = isGifted(child);
        return `
        <article class="gg-card${gifted ? ' is-gifted' : ''}">
            <div class="gg-card-media">
                <img src="${escapeHtml(resolveUrl(child.url))}" alt="${escapeHtml(child.name)}" loading="lazy">
                <span class="gg-age gg-age-${ageTone(child)}">${escapeHtml(ageLabel(child))}</span>
            </div>
            <div class="gg-card-body">
                <h3>${escapeHtml(child.name)}</h3>
                <p>“${escapeHtml(child.description)}”</p>
                ${gifted
                    ? `<button class="gg-btn gg-btn-block" type="button" disabled>${ICON('sprout')}Already gifted</button>`
                    : `<button class="gg-btn gg-btn-block" type="button" data-id="${escapeHtml(child.id)}">${ICON('gift')}Gift a Bloompod</button>`}
            </div>
        </article>`;
    }).join('');

}

// ==============================================
// POPUP TẶNG QUÀ
// ==============================================

let lastFocus = null;

function openGift(child) {
    if (!child) return;

    modalBody.innerHTML = `
        <div class="gg-modal-child">
            <img src="${escapeHtml(resolveUrl(child.url))}" alt="${escapeHtml(child.name)}">
            <div>
                <p class="gg-eyebrow">YOU ARE GIFTING</p>
                <h3 id="gg-modal-title">${escapeHtml(child.name)}</h3>
                <span class="gg-age gg-age-${ageTone(child)}">${escapeHtml(ageLabel(child))}</span>
                <p class="gg-modal-quote">“${escapeHtml(child.description)}”</p>
            </div>
        </div>

        <div class="gg-modal-product">
            <img src="${GIFT.image}" alt="${escapeHtml(GIFT.name)}">
            <div>
                <strong>${escapeHtml(GIFT.name)}</strong>
                <p>${escapeHtml(GIFT.forAge)}</p>
                <p>${escapeHtml(GIFT.quantity)}</p>
            </div>
        </div>

        ${GIFT.price ? `<div class="gg-modal-price"><span>Gift price</span><strong>${money(GIFT.price)}</strong></div>` : ''}

        <p class="gg-modal-note">${ICON('sprout')}Bloompod contributes 30% of the product value toward every gift.</p>

        <button class="gg-btn gg-btn-lg gg-btn-block" id="gg-gift-now" type="button">${ICON('gift')}Gift this</button>`;

    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();

    document.querySelector('#gg-gift-now').onclick = () => {
        // Sang trang đặt hàng ở chế độ tặng quà: không hỏi địa chỉ và tuổi bé
        const params = new URLSearchParams({ gift: child.id, child: child.name });
        window.location.href = 'order-en.html?' + params.toString();
    };
}

function closeGift() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
}

// ==============================================
// SỰ KIỆN
// ==============================================

pills.addEventListener('click', event => {
    const button = event.target.closest('.gg-pill');
    if (!button) return;

    pills.querySelectorAll('.gg-pill').forEach(x => {
        x.classList.remove('is-active');
        x.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('is-active');
    button.setAttribute('aria-pressed', 'true');
    activeCategoryId = button.dataset.categoryId || null;
    loadChildren();
});

sortSelect.addEventListener('change', render);

grid.addEventListener('click', event => {
    const button = event.target.closest('[data-id]');
    if (button) openGift(children.find(c => String(c.id) === button.dataset.id));
});


// "Let Us Choose" — để BloomPod chọn giúp một bé chưa được tặng
document.querySelector('#gg-choose-btn').addEventListener('click', () => {
    const available = children.filter(c => !isGifted(c));
    if (!available.length) {
        document.querySelector('#gg-children').scrollIntoView({ behavior: 'smooth' });
        return;
    }
    openGift(available[Math.floor(Math.random() * available.length)]);
});

modalClose.addEventListener('click', closeGift);
modal.addEventListener('click', event => {
    if (event.target === modal) closeGift();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeGift();
});

(async function init() {
    await Promise.all([loadCategories(), loadGiftPrice()]);
    await loadChildren();
})();
