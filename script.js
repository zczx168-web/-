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
  button.addEventListener('click', () => toggleWatch(button));
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

let selectedPlan = { code: 'monthly', name: '月度研究', price: '29.9' };
const paymentStep = document.querySelector('#paymentStep');
const confirmSubscribe = document.querySelector('#confirmSubscribe');
const paymentAmount = document.querySelector('#paymentAmount');
const paymentQr = document.querySelector('#paymentQr');
const paymentMethodLabel = document.querySelector('#paymentMethodLabel');
const paymentDone = document.querySelector('#paymentDone');
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
    selectedPlan = {
      code: button.dataset.planCode,
      name: button.dataset.plan,
      price: button.dataset.price,
    };
    updatePaymentDetails();
  });
});
confirmSubscribe.addEventListener('click', () => {
  paymentStep.hidden = false;
  confirmSubscribe.hidden = true;
});
paymentDone.addEventListener('click', submitPaymentRequest);
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
const edition = document.querySelector('.edition');
const membershipBadge = document.querySelector('#membershipBadge');
const memberContentState = document.querySelector('#memberContentState');
const memberContentList = document.querySelector('#memberContentList');
const planNames = { weekly: '周报体验', monthly: '月度研究', quarterly: '季度研究' };
let currentSession = null;
let currentSubscription = null;
let currentPaymentRequest = null;

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value));
}

function setWatchButtonState(button, saved) {
  button.classList.toggle('saved', saved);
  button.textContent = saved ? '★' : '☆';
  button.setAttribute('aria-pressed', String(saved));
}

function renderMembershipState(subscription, paymentRequest) {
  const active = subscription && (!subscription.ends_at || new Date(subscription.ends_at) > new Date());
  currentSubscription = active ? subscription : null;
  if (active) {
    const planName = planNames[subscription.plan_code] || '会员';
    const endsAt = subscription.ends_at ? ` · 有效期至 ${formatDate(subscription.ends_at)}` : '';
    edition.innerHTML = `<i></i>${planName}会员`;
    membershipBadge.textContent = `${planName}有效`;
    memberContentState.textContent = `当前已开通${planName}${endsAt}，以下内容仅对会员开放。`;
    return;
  }
  if (paymentRequest?.status === 'pending') {
    edition.innerHTML = '<i></i>订阅待核验';
    membershipBadge.textContent = '待审核';
    memberContentState.textContent = '付款申请已提交，人工核验通过后即可查看会员内容。';
    return;
  }
  edition.innerHTML = '<i></i>正式版';
  membershipBadge.textContent = currentSession ? '未订阅' : '登录后查看';
  memberContentState.textContent = currentSession
    ? '当前账号尚未开通会员，订阅审核通过后这里会显示晨报、数据卡和研究报告。'
    : '登录并完成订阅审核后，这里会显示晨报、数据卡和研究报告。';
}

function renderMemberContent(items) {
  memberContentList.replaceChildren();
  items.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'member-content-item';
    const meta = document.createElement('span');
    meta.textContent = `${item.category || '研究'} · ${formatDate(item.published_at)}`;
    const title = document.createElement('h3');
    title.textContent = item.title;
    const summary = document.createElement('p');
    summary.textContent = item.summary || item.body || '暂无摘要';
    article.append(meta, title, summary);
    memberContentList.append(article);
  });
}

async function loadMemberContent(session) {
  renderMemberContent([]);
  if (!session || !supabaseClient || !currentSubscription) return;
  const { data, error } = await supabaseClient
    .from('content')
    .select('id,title,summary,body,category,published_at,visibility')
    .eq('visibility', 'member')
    .order('published_at', { ascending: false })
    .limit(20);
  if (error) {
    memberContentState.textContent = '会员内容暂时无法加载，请稍后刷新。';
    return;
  }
  if (!data?.length) {
    memberContentState.textContent = '会员内容正在整理，发布后会显示在这里。';
    return;
  }
  memberContentState.textContent = '已按发布时间更新会员专属研究内容。';
  renderMemberContent(data);
}

async function loadWatchlist(session) {
  if (!session || !supabaseClient) {
    document.querySelectorAll('.save-button').forEach((button) => setWatchButtonState(button, false));
    return;
  }
  const { data, error } = await supabaseClient.from('watchlists').select('label').eq('user_id', session.user.id);
  if (error) return;
  const saved = new Set((data || []).map((item) => item.label));
  document.querySelectorAll('.save-button').forEach((button) => {
    const label = button.closest('.brief-row')?.dataset.title;
    setWatchButtonState(button, saved.has(label));
  });
}

async function toggleWatch(button) {
  if (!currentSession || !supabaseClient) {
    showToast('请先登录后管理关注清单');
    openModal('loginModal');
    return;
  }
  const label = button.closest('.brief-row')?.dataset.title;
  if (!label) return;
  const saved = button.classList.contains('saved');
  button.disabled = true;
  const result = saved
    ? await supabaseClient.from('watchlists').delete().eq('user_id', currentSession.user.id).eq('label', label)
    : await supabaseClient.from('watchlists').insert({ user_id: currentSession.user.id, label, kind: 'brief' });
  button.disabled = false;
  if (result.error) {
    showToast(`操作失败：${result.error.message}`);
    return;
  }
  setWatchButtonState(button, !saved);
  showToast(!saved ? '已加入我的关注' : '已取消关注');
}

async function refreshAccount(session) {
  currentSession = session;
  if (!session || !supabaseClient) {
    currentPaymentRequest = null;
    renderMembershipState(null, null);
    await loadWatchlist(null);
    await loadMemberContent(null);
    return;
  }
  const [subscriptionResult, paymentResult] = await Promise.all([
    supabaseClient.from('subscriptions').select('plan_code,status,starts_at,ends_at').eq('user_id', session.user.id).eq('status', 'active').order('ends_at', { ascending: false }).limit(1),
    supabaseClient.from('payment_requests').select('plan_code,status,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1),
  ]);
  currentPaymentRequest = paymentResult.data?.[0] || null;
  renderMembershipState(subscriptionResult.data?.[0] || null, currentPaymentRequest);
  await Promise.all([loadWatchlist(session), loadMemberContent(session)]);
}

async function submitPaymentRequest() {
  if (!supabaseClient) {
    localStorage.setItem('coalPending', JSON.stringify(selectedPlan));
    closeModal('subscribeModal');
    showToast(`已记录${selectedPlan.name}付款申请（本地演示）`);
    return;
  }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = currentSession || sessionData.session;
  if (!session) {
    closeModal('subscribeModal');
    openModal('loginModal');
    loginStatus.textContent = '请先登录，再提交付款申请';
    return;
  }
  paymentDone.disabled = true;
  const { error } = await supabaseClient.from('payment_requests').insert({
    user_id: session.user.id,
    plan_code: selectedPlan.code,
    amount: Number(selectedPlan.price),
    payment_time: new Date().toISOString(),
    note: '用户通过网页提交付款核验',
  });
  paymentDone.disabled = false;
  if (error) {
    showToast(`提交失败：${error.message}`);
    return;
  }
  localStorage.setItem('coalPending', JSON.stringify(selectedPlan));
  currentPaymentRequest = { plan_code: selectedPlan.code, status: 'pending' };
  renderMembershipState(null, currentPaymentRequest);
  closeModal('subscribeModal');
  paymentStep.hidden = true;
  confirmSubscribe.hidden = false;
  showToast(`已提交${selectedPlan.name}付款申请，等待人工核验`);
}

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
  const { data, error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'email' });
  verifyLoginCode.disabled = false;
  if (error) {
    loginStatus.textContent = '验证码无效或已过期，请重新获取';
    return;
  }
  closeModal('loginModal');
  renderAuthState(data.session);
  showToast('登录成功');
});
signOutButton.addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  renderAuthState(null);
  showToast('已退出登录');
});
if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data }) => {
    renderAuthState(data.session);
    refreshAccount(data.session);
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    renderAuthState(session);
    refreshAccount(session);
  });
} else {
  renderAuthState(null);
}
document.querySelector('#clearWatch').addEventListener('click', async () => {
  if (!currentSession || !supabaseClient) {
    showToast('请先登录后管理关注清单');
    return;
  }
  const { error } = await supabaseClient.from('watchlists').delete().eq('user_id', currentSession.user.id);
  if (error) {
    showToast(`清空失败：${error.message}`);
    return;
  }
  document.querySelectorAll('.save-button').forEach((button) => setWatchButtonState(button, false));
  showToast('关注列表已清空');
});
document.querySelector('.add-watch').addEventListener('click', async () => {
  if (!currentSession || !supabaseClient) {
    showToast('请先登录后添加关注');
    return;
  }
  const label = window.prompt('输入要关注的合约或关键词');
  if (!label?.trim()) return;
  const { error } = await supabaseClient.from('watchlists').insert({
    user_id: currentSession.user.id,
    label: label.trim(),
    kind: 'keyword',
  });
  showToast(error ? `添加失败：${error.message}` : `已关注${label.trim()}`);
});

if (localStorage.getItem('coalPending')) document.querySelector('.edition').innerHTML = '<i></i>订阅待核验';
