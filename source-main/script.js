
const modal = document.getElementById('giftModal');
const modalText = document.getElementById('modalText');

function openModal(child) {
  modalText.textContent = child
    ? `You are choosing to gift a Bloompod to ${child}. Thank you for helping plant a seed for their future.`
    : `You are choosing to let us select a child for your gift. Thank you for helping plant a seed for their future.`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}

document.querySelectorAll('.gift-btn').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.child));
});
document.getElementById('letChooseBtn').addEventListener('click', () => openModal(''));
document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

const filters = document.querySelectorAll('.filter');
const cardsEls = document.querySelectorAll('.child-card');
filters.forEach(filter => {
  filter.addEventListener('click', () => {
    filters.forEach(f => f.classList.remove('active'));
    filter.classList.add('active');
    const type = filter.dataset.filter;
    cardsEls.forEach(card => {
      const age = card.dataset.age;
      let show = type === 'all';
      if (type === '0') show = age.includes('0–1');
      if (type === '1') show = age === '1 year';
      if (type === '2') show = age === '2 years';
      card.style.display = show ? '' : 'none';
    });
  });
});

document.querySelector('.sort-select').addEventListener('change', e => {
  const grid = document.getElementById('childrenGrid');
  const cards = Array.from(grid.children);
  if (e.target.value.startsWith('Name')) {
    cards.sort((a,b) => a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent));
  } else {
    const rank = s => s.includes('0–1') ? 0 : s.includes('1 year') ? 1 : 2;
    cards.sort((a,b) => rank(a.dataset.age)-rank(b.dataset.age));
  }
  cards.forEach(c => grid.appendChild(c));
});

document.querySelector('.mobile-menu').addEventListener('click', () => {
  const nav = document.querySelector('.nav');
  const actions = document.querySelector('.header-actions');
  const open = nav.style.display === 'flex';
  nav.style.display = open ? '' : 'flex';
  actions.style.display = open ? '' : 'flex';
  if (!open) {
    nav.style.position='absolute';
    nav.style.top='68px';
    nav.style.left='0';
    nav.style.right='0';
    nav.style.padding='15px 5%';
    nav.style.background='#fffef9';
    nav.style.flexDirection='column';
    nav.style.alignItems='flex-start';
    actions.style.position='absolute';
    actions.style.top='68px';
    actions.style.right='5%';
  }
});
