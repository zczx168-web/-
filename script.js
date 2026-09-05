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

const modalIds = ['methodModal', 'subscribeModal', 'loginModal'];
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
const paymentQr = document.querySelector('#paymentQr');
const paymentMethodLabel = document.querySelector('#paymentMethodLabel');
const paymentQrByPrice = {
  '9.9': { src: 'assets/payment-9-9.jpg', label: '周报体验' },
  '29.9': { src: 'assets/payment-29-9.jpg', label: '月度研究' },
  '79': { src: 'assets/payment-79.jpg', label: '季度研究' },
};
function updatePaymentDetails() {
  const details = paymentQrByPrice[selectedPlan.price];
  paymentAmount.textContent = `¥${selectedPlan.price}`;
  paymentMethodLabel.textContent = details.label;
  paymentQr.src = details.src;
  paymentQr.alt = `微信支付二维码，金额${selectedPlan.price}元`;
}
document.querySelectorAll('.plan-option').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.plan-option').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    selectedPlan = { name: button.dataset.plan, price: button.dataset.price };
    updatePaymentDetails();
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
  document.querySelector('.edition').innerHTML = '<i></i>订阅待核验';
});
const loginButton = document.querySelector('#loginButton');
const loginEmail = document.querySelector('#loginEmail');
const sendLoginLink = document.querySelector('#sendLoginLink');
const loginCodeField = document.querySelector('#loginCodeField');
const loginCode = document.querySelector('#loginCode');
const verifyLoginCode = document.querySelector('#verifyLoginCode');
const signOutButton = document.querySelector('#signOutButton');
const loginStatus = document.querySelector('#loginStatus');
loginCode.addEventListener('input', () => {
  const digitsOnly = loginCode.value.replace(/\D/g, '').slice(0, 8);
  if (loginCode.value !== digitsOnly) loginCode.value = digitsOnly;
});
const domesticEmailDomains = [
  'qq.com', 'foxmail.com', '163.com', '126.com', 'yeah.net', '139.com',
  '189.cn', 'wo.cn', 'aliyun.com', 'sina.com', 'sina.cn', 'sohu.com',
  '21cn.com', '263.net', 'mail.com.cn',
];
const authRedirectUrl = 'https://zczx168-web.github.io/-/';
const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseClient = window.supabase && supabaseConfig.url && supabaseConfig.publishableKey
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;

function renderAuthState(session) {
  const email = session?.user?.email;
  loginButton.textContent = email ? '已登录' : '登录';
  signOutButton.hidden = !email;
  sendLoginLink.hidden = Boolean(email);
  loginEmail.hidden = Boolean(email);
  loginCodeField.hidden = Boolean(email);
  verifyLoginCode.hidden = Boolean(email);
  loginStatus.textContent = email ? `当前账号：${email}` : '';
}

loginButton.addEventListener('click', () => openModal('loginModal'));
sendLoginLink.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  if (!email || !loginEmail.checkValidity()) {
    loginStatus.textContent = '请输入有效的邮箱地址';
    loginEmail.focus();
    return;
  }
  const domain = email.toLowerCase().split('@').pop();
  const isDomesticEmail = domesticEmailDomains.some((allowedDomain) => (
    domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
  ));
  if (!isDomesticEmail) {
    loginStatus.textContent = '目前仅支持 QQ、163、126、139、189 等国内邮箱';
    loginEmail.focus();
    return;
  }
  if (!supabaseClient) {
    loginStatus.textContent = '邮箱登录尚未配置 Supabase 项目';
    return;
  }
  sendLoginLink.disabled = true;
  loginStatus.textContent = '验证码发送中...';
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl },
  });
  sendLoginLink.disabled = false;
  if (error) {
    loginStatus.textContent = `发送失败：${error.message}`;
    return;
  }
  loginCodeField.hidden = false;
  verifyLoginCode.hidden = false;
  loginCode.focus();
  loginStatus.textContent = '验证码已发送，请查收中文邮件';
});
verifyLoginCode.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const token = loginCode.value.trim();
  if (!email || !loginEmail.checkValidity() || !/^\d{8}$/.test(token)) {
    loginStatus.textContent = '请输入有效邮箱和 8 位验证码';
    loginCode.focus();
    return;
  }
  if (!supabaseClient) {
    loginStatus.textContent = '邮箱登录尚未配置 Supabase 项目';
    return;
  }
  verifyLoginCode.disabled = true;
  loginStatus.textContent = '正在验证...';
  const { error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'email' });
  verifyLoginCode.disabled = false;
  loginStatus.textContent = error ? '验证码无效或已过期，请重新获取' : '登录成功';
});
signOutButton.addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  renderAuthState(null);
  showToast('已退出登录');
});
if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data }) => renderAuthState(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => renderAuthState(session));
} else {
  renderAuthState(null);
}
document.querySelector('#clearWatch').addEventListener('click', () => showToast('关注列表已清空'));
document.querySelector('.add-watch').addEventListener('click', () => showToast('添加合约功能将在接入数据源后开放'));

if (localStorage.getItem('coalPending')) document.querySelector('.edition').innerHTML = '<i></i>订阅待核验';
