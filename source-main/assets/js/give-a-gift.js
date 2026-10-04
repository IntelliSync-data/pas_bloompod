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

// Trang đặt hàng nằm ở site khác nên để nguyên đường dẫn tuyệt đối
const ORDER_URL = 'https://website-demo.xn--hthng-171byc.vn/bloom/order-en.html';

const GIFT = {
    name: 'Bloompod Audio Learning Kit',
    forAge: 'For children aged 0 – 3',
    quantity: '01 Bloompod set',
    price: null,
    image: 'assets/images/bloompod_sp.png'
};

const ICON = name => `<svg class="gg-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

// Tỉ giá chỉ để hiện giá tham khảo bằng USD. Phải khớp với "Exchange Rate"
// trong Settings của isd_profile_management (mặc định 25.000). API package-info
// chưa trả tỉ giá nên tạm để ở đây.
const USD_RATE = 25000;

const nf = new Intl.NumberFormat('en-US');

const money = n => {
    const vnd = nf.format(n) + ' VND';
    const usd = Math.round(Number(n) / USD_RATE);
    return usd > 0 ? `${vnd} ~ $${nf.format(usd)}` : vnd;
};

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
    // Giữ nguyên thứ tự API trả về (sort_order bên Odoo), chỉ đẩy bé đã được
    // tặng xuống cuối danh sách
    const list = children.slice();
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
                    ? `<button class="" type="button" disabled>${ICON('sprout')}Already gifted</button>`
                    : `<button class="gg-btn gg-btn-block" type="button" data-id="${escapeHtml(child.id)}">${ICON('gift')}Gift a Bloompod</button>`}
            </div>
        </article>`;
    }).join('');

}

// ==============================================
// POPUP TẶNG QUÀ
// ==============================================

let lastFocus = null;

/** Phần dưới của popup giống nhau ở cả hai kiểu tặng, chỉ khác khối giới thiệu bé */
function showGiftModal(childBlock, onConfirm) {
    modalBody.innerHTML = `
        ${childBlock}

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

    document.querySelector('#gg-gift-now').addEventListener('click', onConfirm);

    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
}

function goToOrder(child) {
    const params = new URLSearchParams({ gift: child.id, child: child.name });
    window.location.href = ORDER_URL + '?' + params.toString();
}

/** Tặng cho đúng một bé: popup hiện ảnh, tên, nhóm tuổi và câu trích của bé đó */
function openGift(child) {
    if (!child) return;

    showGiftModal(`
        <div class="gg-modal-child">
            <img src="${escapeHtml(resolveUrl(child.url))}" alt="${escapeHtml(child.name)}">
            <div>
                <p class="gg-eyebrow">YOU ARE GIFTING</p>
                <h3 id="gg-modal-title">${escapeHtml(child.name)}</h3>
                <span class="gg-age gg-age-${ageTone(child)}">${escapeHtml(ageLabel(child))}</span>
                <p class="gg-modal-quote">“${escapeHtml(child.description)}”</p>
            </div>
        </div>`, () => goToOrder(child));
}

/**
 * "Let Us Choose": popup không nêu bé nào. Bấm "Gift this" mới lấy bé đầu tiên
 * chưa được tặng - cũng chính là bé đầu tiên đang hiện trên trang, vì danh sách
 * giữ nguyên thứ tự API và bé đã được tặng bị đẩy xuống cuối.
 */
function openGiftAnyChild() {
    showGiftModal(`
        <div class="gg-modal-child">
            <div>
                <p class="gg-eyebrow">YOU ARE GIFTING</p>
                <h3 id="gg-modal-title">A child chosen by Bloompod</h3>
                <p class="gg-modal-quote">Your gift goes to the next child on our list who is still
                    waiting for one.</p>
            </div>
        </div>`, event => {
        const child = children.find(c => !isGifted(c));
        if (!child) {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'No child is waiting right now';
            return;
        }
        goToOrder(child);
    });
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

grid.addEventListener('click', event => {
    const button = event.target.closest('[data-id]');
    if (!button) return;

    openGift(children.find(c => String(c.id) === button.dataset.id));
});



// "Let Us Choose" — popup không nêu tên bé, chọn bé lúc bấm Gift this
document.querySelector('#gg-choose-btn').addEventListener('click', event => {
    // Thẻ <a href="#gg-children">, không chặn thì vừa mở popup vừa cuộn trang
    event.preventDefault();
    openGiftAnyChild();
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
