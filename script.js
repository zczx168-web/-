const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

const rows = [...document.querySelectorAll('.brief-row')];
const search = document.querySelector('#briefSearch');
let activeFilter = 'all';
function renderBriefs() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  rows.forEach((row) => {
    const matchesFilter = activeFilter === 'all' || row.dataset.type === activeFilter;
    const matchesSearch = !query || row.dataset.title.toLowerCase().includes(query);
    row.hidden = !(matchesFilter && matchesSearch);
    if (!row.hidden) visible += 1;
  });
  document.querySelector('#emptyState').hidden = visible > 0;
}
document.querySelectorAll('.filter-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    activeFilter = button.dataset.filter;
    renderBriefs();
  });
});
search.addEventListener('input', renderBriefs);

document.querySelectorAll('.save-button').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('saved');
    button.textContent = button.classList.contains('saved') ? '★' : '☆';
    showToast(button.classList.contains('saved') ? '已加入我的关注' : '已取消关注');
  });
});

const modalIds = ['methodModal', 'subscribeModal'];
function openModal(id) {
  if (id === 'subscribeModal' && paymentStep) {
    paymentStep.hidden = true;
    confirmSubscribe.hidden = false;
  }
  document.querySelector(`#${id}`).hidden = false;
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  document.querySelector(`#${id}`).hidden = true;
  document.body.classList.remove('modal-open');
}
document.querySelector('#openMethod').addEventListener('click', () => openModal('methodModal'));
document.querySelectorAll('.subscribe-trigger').forEach((button) => button.addEventListener('click', () => openModal('subscribeModal')));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(backdrop.id); }));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') modalIds.forEach((id) => { if (!document.querySelector(`#${id}`).hidden) closeModal(id); });
});

let selectedPlan = { name: '月度研究', price: '29.9' };
const paymentStep = document.querySelector('#paymentStep');
const confirmSubscribe = document.querySelector('#confirmSubscribe');
const paymentAmount = document.querySelector('#paymentAmount');
document.querySelectorAll('.plan-option').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.plan-option').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    selectedPlan = { name: button.dataset.plan, price: button.dataset.price };
    paymentAmount.textContent = `¥${selectedPlan.price}`;
  });
});
confirmSubscribe.addEventListener('click', () => {
  paymentStep.hidden = false;
  confirmSubscribe.hidden = true;
});
document.querySelector('#paymentDone').addEventListener('click', () => {
  localStorage.setItem('coalPending', JSON.stringify(selectedPlan));
  closeModal('subscribeModal');
  paymentStep.hidden = true;
  confirmSubscribe.hidden = false;
  showToast(`已提交${selectedPlan.name}付款申请，等待人工核验`);
  document.querySelector('.edition').innerHTML = '<i></i>待人工核验';
});
document.querySelector('#loginButton').addEventListener('click', () => showToast('登录功能将在接入 Supabase Auth 后开放'));
document.querySelector('#clearWatch').addEventListener('click', () => showToast('关注列表已清空（测试）'));
document.querySelector('.add-watch').addEventListener('click', () => showToast('添加合约功能将在接入数据源后开放'));

if (localStorage.getItem('coalPending')) document.querySelector('.edition').innerHTML = '<i></i>待人工核验';
