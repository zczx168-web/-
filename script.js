const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

const search = document.querySelector('#briefSearch');
let activeFilter = 'all';
function renderBriefs() {
  const query = search.value.trim().toLowerCase();
  const rows = [...document.querySelectorAll('.brief-row')];
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

const briefList = document.querySelector('#briefList');
const briefAutoMeta = document.querySelector('#briefAutoMeta');
const categoryLabels = { supply: '供应', demand: '需求', policy: '政策与口岸', market: '市场' };
const fallbackBriefItems = [...briefList.querySelectorAll('.brief-row')].map((row) => ({
  title: row.querySelector('h3')?.textContent.trim() || row.dataset.title || '焦煤市场动态',
  summary: row.querySelector('.brief-copy p')?.textContent.trim() || '公开行业信息整理',
  category: row.dataset.type || 'policy',
  fallbackTime: row.querySelector('.brief-time')?.textContent.trim() || '周五',
  source: '周五收盘前精选',
}));

function renderBriefEmpty(message) {
  briefList.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'brief-live-empty';
  empty.textContent = message;
  briefList.append(empty);
  document.querySelector('#emptyState').hidden = true;
}

function renderAutoBrief(data) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const allItems = Array.isArray(data.items) ? data.items : [];
  const recentItems = allItems.filter((item) => {
      const timestamp = Date.parse(item.publishedAt || item.published_at || '');
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= Date.now() + 60 * 60 * 1000;
  });
  const archivedItems = allItems
    .filter((item) => Number.isFinite(Date.parse(item.publishedAt || item.published_at || '')))
    .sort((a, b) => Date.parse(b.publishedAt || b.published_at) - Date.parse(a.publishedAt || a.published_at))
    .slice(0, 8);
  const displayItems = recentItems.length ? recentItems : (archivedItems.length ? archivedItems : fallbackBriefItems);
  const archiveMode = !recentItems.length;
  if (!displayItems.length) {
    renderBriefEmpty('最近没有可用的公开资讯');
    briefAutoMeta.textContent = '暂无更新';
    return;
  }
  briefList.replaceChildren();
  displayItems.forEach((item) => {
    const row = document.createElement('article');
    const category = item.category || 'policy';
    row.className = 'brief-row';
    row.dataset.type = category;
    row.dataset.title = item.title;
    const publishedAt = new Date(item.publishedAt || item.published_at || '');
    const time = item.fallbackTime || (Number.isNaN(publishedAt.getTime())
      ? '周五'
      : archiveMode
        ? publishedAt.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        : publishedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }));
    const timeEl = document.createElement('span');
    timeEl.className = 'brief-time';
    if (archiveMode) timeEl.classList.add('brief-time-archive');
    timeEl.textContent = time;
    const copy = document.createElement('div');
    copy.className = 'brief-copy';
    const heading = document.createElement('div');
    const tag = document.createElement('span');
    tag.className = `tag tag-${category}`;
    tag.textContent = categoryLabels[category] || '资讯';
    const title = document.createElement('h3');
    if (item.url) {
      const titleLink = document.createElement('a');
      titleLink.className = 'brief-title-link';
      titleLink.href = item.url;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.textContent = item.title;
      title.append(titleLink);
    } else {
      title.textContent = item.title;
    }
    heading.append(tag, title);
    const summary = document.createElement('p');
    summary.append(document.createTextNode(item.summary || `来源：${item.source || '公开信息'}`));
    if (item.url) {
      const sourceLink = document.createElement('a');
      sourceLink.className = 'brief-source-link';
      sourceLink.href = item.url;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      sourceLink.textContent = `查看${item.source || '来源'}`;
      summary.append(document.createTextNode(' '), sourceLink);
    }
    copy.append(heading, summary);
    const save = document.createElement('button');
    save.className = 'save-button';
    save.type = 'button';
    save.setAttribute('aria-label', `收藏${item.title}`);
    save.textContent = '☆';
    row.append(timeEl, copy, save);
    briefList.append(row);
  });
  if (archiveMode) {
    briefAutoMeta.textContent = '周末模式 · 显示周五收盘前精选';
  } else {
    briefAutoMeta.textContent = data.generatedAt ? `自动汇总 · ${new Date(data.generatedAt).toLocaleString('zh-CN')}` : '自动汇总';
  }
  bindSaveButtons();
  renderBriefs();
}

async function loadAutoBrief() {
  try {
    const response = await fetch(`data/daily-brief.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderAutoBrief(await response.json());
  } catch (error) {
    renderBriefEmpty('暂时无法获取最近24小时资讯，请稍后刷新');
    briefAutoMeta.textContent = '最近24小时 · 获取失败';
  }
}

function bindSaveButtons() {
  document.querySelectorAll('.save-button').forEach((button) => {
    if (button.dataset.watchBound) return;
    button.dataset.watchBound = 'true';
    button.addEventListener('click', () => toggleWatch(button));
  });
}
bindSaveButtons();

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
document.querySelectorAll('.free-trial-trigger').forEach((button) => button.addEventListener('click', () => {
  openModal('subscribeModal');
  document.querySelector('.plan-option[data-plan-code="weekly"]')?.click();
}));
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
const paymentMethods = paymentStep.querySelector('.payment-methods');
const paymentQrBox = paymentStep.querySelector('.qr-placeholder');
const paymentInstructions = paymentStep.querySelector('.payment-instructions');
const subscribeFootnote = document.querySelector('#subscribeFootnote');
const paymentQrByPrice = {
  '29.9': { src: 'assets/payment-29-9.jpg', label: '月度研究' },
  '79': { src: 'assets/payment-79.jpg', label: '季度研究' },
};
function updatePaymentDetails() {
  const isFreeTrial = Number(selectedPlan.price) === 0;
  const details = paymentQrByPrice[selectedPlan.price];
  paymentAmount.textContent = `¥${selectedPlan.price}`;
  confirmSubscribe.textContent = isFreeTrial ? '查看免费体验' : '查看付款方式';
  paymentDone.textContent = isFreeTrial ? '申请7天免费体验' : '我已完成付款，提交核验';
  paymentMethods.hidden = isFreeTrial;
  paymentQrBox.hidden = isFreeTrial;
  if (isFreeTrial) {
    paymentMethodLabel.textContent = '免费体验';
    paymentInstructions.replaceChildren();
    ['本套餐无需付款', '点击下方按钮提交体验申请', '人工开通后可使用7天会员内容'].forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      paymentInstructions.append(item);
    });
    subscribeFootnote.textContent = '免费体验申请由客服人工开通，提交后请留意会员状态变化。';
    return;
  }
  paymentMethodLabel.textContent = details.label;
  paymentQr.src = details.src;
  paymentQr.alt = `微信支付二维码，金额${selectedPlan.price}元`;
  paymentInstructions.replaceChildren();
  ['扫描对应套餐的微信支付收款码', '付款金额需与上方套餐一致', '付款后通过运营指定渠道发送付款时间和昵称'].forEach((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    paymentInstructions.append(item);
  });
  subscribeFootnote.textContent = '月度和季度套餐采用人工核验；后续可接入微信支付或支付宝商户接口。';
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
const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseClient = window.supabase && supabaseConfig.url && supabaseConfig.publishableKey
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;
const edition = document.querySelector('.edition');
const membershipBadge = document.querySelector('#membershipBadge');
const refreshMembershipButton = document.querySelector('#refreshMembershipButton');
const accountNotice = document.querySelector('#accountNotice');
const accountNoticeTitle = document.querySelector('#accountNoticeTitle');
const accountNoticeText = document.querySelector('#accountNoticeText');
const accountNoticeRefresh = document.querySelector('#accountNoticeRefresh');
const memberContentState = document.querySelector('#memberContentState');
const memberContentList = document.querySelector('#memberContentList');
const planNames = { weekly: '7天免费体验', monthly: '月度研究', quarterly: '季度研究' };
let currentSession = null;
let currentSubscription = null;
let currentPaymentRequest = null;

function formatAuthError(error, action = '发送验证码') {
  const message = String(error?.message || '');
  if (/rate limit|too many|频繁/i.test(message)) return '发送过于频繁，请等待几分钟后再试。';
  if (/redirect|url|allow list|allowlist/i.test(message)) return '登录跳转地址尚未配置，请联系管理员检查 Supabase 设置。';
  if (/smtp|email|mail|sending/i.test(message)) return '邮件服务暂时不可用，请检查 SMTP 设置或稍后重试。';
  return `${action}失败，请稍后重试。${message ? `（${message}）` : ''}`;
}

function renderAccountNotice(kind, title, text) {
  if (!currentSession) {
    accountNotice.hidden = true;
    return;
  }
  accountNotice.dataset.kind = kind;
  accountNoticeTitle.textContent = title;
  accountNoticeText.textContent = text;
  accountNotice.hidden = false;
}

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
    memberContentState.textContent = `当前已开通${planName}${endsAt}，会员权限已同步，可直接查看以下内容。`;
    renderAccountNotice('active', '会员已开通', `${planName}${endsAt}，会员内容已解锁。`);
    return;
  }
  if (paymentRequest?.status === 'pending') {
    edition.innerHTML = '<i></i>订阅待核验';
    membershipBadge.textContent = '待审核';
    memberContentState.textContent = '付款申请已提交，客服确认后点击“刷新状态”即可同步会员权限。';
    renderAccountNotice('pending', '申请已提交', '客服正在核验，确认后点击“刷新状态”即可同步权限。');
    return;
  }
  if (paymentRequest?.status === 'rejected') {
    edition.innerHTML = '<i></i>申请需补充';
    membershipBadge.textContent = '待处理';
    memberContentState.textContent = '本次申请未通过，请联系客服核对付款信息后重新提交。';
    renderAccountNotice('rejected', '申请未通过', '请联系客服核对付款信息后重新提交申请。');
    return;
  }
  edition.innerHTML = '<i></i>正式版';
  membershipBadge.textContent = currentSession ? '未订阅' : '登录后查看';
  memberContentState.textContent = currentSession
    ? '当前账号尚未开通会员，订阅审核通过后这里会显示晨报、数据卡和研究报告。'
    : '登录并完成订阅审核后，这里会显示晨报、数据卡和研究报告。';
  if (currentSession) {
    renderAccountNotice('neutral', '尚未开通会员', '可选择7天免费体验，或提交月度、季度订阅申请。');
  }
}

function parseMorningBrief(item) {
  const fallback = { conclusion: item.summary || item.body || '暂无晨报摘要' };
  if (!item.body) return fallback;
  try {
    const parsed = JSON.parse(item.body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function appendBriefSection(container, label, value) {
  if (!value) return;
  const section = document.createElement('section');
  section.className = 'morning-brief-section';
  const heading = document.createElement('span');
  heading.textContent = label;
  const text = document.createElement('p');
  text.textContent = Array.isArray(value) ? value.join('；') : String(value);
  section.append(heading, text);
  container.append(section);
}

function renderMorningBrief(item) {
  const brief = parseMorningBrief(item);
  const article = document.createElement('article');
  article.className = 'morning-brief-card';
  const meta = document.createElement('div');
  meta.className = 'morning-brief-meta';
  meta.textContent = `今日晨报 · ${formatDate(item.published_at)}`;
  const title = document.createElement('h3');
  title.textContent = item.title;
  const sections = document.createElement('div');
  sections.className = 'morning-brief-grid';
  appendBriefSection(sections, '今日结论', brief.conclusion);
  appendBriefSection(sections, '隔夜重点', brief.overnight);
  appendBriefSection(sections, '供应端', brief.supply);
  appendBriefSection(sections, '进口端', brief.imports || brief.import);
  appendBriefSection(sections, '需求端', brief.demand);
  appendBriefSection(sections, '今日观察', brief.watch || brief.observation);
  article.append(meta, title, sections);
  return article;
}

function parseMemberBody(item) {
  if (!item.body) return {};
  if (typeof item.body === 'object') return item.body;
  try {
    const parsed = JSON.parse(item.body);
    return parsed && typeof parsed === 'object' ? parsed : { text: String(item.body) };
  } catch {
    return { text: String(item.body) };
  }
}

function appendMemberMeta(article, item) {
  const meta = document.createElement('span');
  meta.className = 'member-item-meta';
  meta.textContent = `${item.category || '研究'} · ${formatDate(item.published_at)}`;
  article.append(meta);
}

function appendMemberHeading(article, item) {
  const title = document.createElement('h3');
  title.textContent = item.title;
  article.append(title);
  if (item.summary) {
    const summary = document.createElement('p');
    summary.className = 'member-item-summary';
    summary.textContent = item.summary;
    article.append(summary);
  }
}

function appendMemberLabeledText(article, className, label, value) {
  if (!value) return;
  const block = document.createElement('div');
  block.className = className;
  const heading = document.createElement('b');
  heading.textContent = label;
  block.append(heading, document.createTextNode(String(value)));
  article.append(block);
}

function renderDataCard(item) {
  const body = parseMemberBody(item);
  const article = document.createElement('article');
  article.className = 'member-content-item member-content-rich member-content-data-card';
  appendMemberMeta(article, item);
  appendMemberHeading(article, item);
  const asOf = document.createElement('div');
  asOf.className = 'member-rich-note';
  asOf.textContent = body.asOf ? `数据截至：${body.asOf}` : '数据口径：公开周度资料整理';
  article.append(asOf);
  const metrics = document.createElement('div');
  metrics.className = 'data-card-metrics';
  (body.metrics || []).forEach((metric) => {
    const card = document.createElement('div');
    card.className = 'data-card-metric';
    const label = document.createElement('span');
    label.textContent = metric.label || '指标';
    const value = document.createElement('strong');
    value.textContent = metric.value || '-';
    const change = document.createElement('small');
    change.textContent = metric.change || '';
    if (metric.tone) change.dataset.tone = metric.tone;
    const note = document.createElement('p');
    note.textContent = metric.note || '';
    card.append(label, value, change, note);
    metrics.append(card);
  });
  if (metrics.children.length) article.append(metrics);
  appendMemberLabeledText(article, 'member-rich-takeaway', '研究解读', body.takeaway);
  return article;
}

function renderEventCard(item) {
  const body = parseMemberBody(item);
  const article = document.createElement('article');
  article.className = 'member-content-item member-content-rich member-content-event';
  appendMemberMeta(article, item);
  appendMemberHeading(article, item);
  if (body.priority) {
    const priority = document.createElement('div');
    priority.className = `event-priority event-priority-${body.priorityTone || 'medium'}`;
    priority.textContent = `关注级别：${body.priority}`;
    article.append(priority);
  }
  const timeline = document.createElement('div');
  timeline.className = 'event-timeline';
  (body.timeline || []).forEach((event) => {
    const row = document.createElement('div');
    row.className = 'event-timeline-row';
    const time = document.createElement('time');
    time.textContent = event.time || '';
    const copy = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = event.title || '';
    const detail = document.createElement('p');
    detail.textContent = event.detail || '';
    copy.append(heading, detail);
    row.append(time, copy);
    timeline.append(row);
  });
  if (timeline.children.length) article.append(timeline);
  appendMemberLabeledText(article, 'member-rich-takeaway', '下一观察点', body.next);
  return article;
}

function renderReportCard(item) {
  const body = parseMemberBody(item);
  const article = document.createElement('article');
  article.className = 'member-content-item member-content-rich member-content-report';
  appendMemberMeta(article, item);
  appendMemberHeading(article, item);
  if (body.abstract) {
    const abstract = document.createElement('p');
    abstract.className = 'report-abstract';
    abstract.textContent = body.abstract;
    article.append(abstract);
  }
  const sections = document.createElement('div');
  sections.className = 'report-sections';
  (body.sections || []).forEach((section) => {
    const block = document.createElement('section');
    const heading = document.createElement('strong');
    heading.textContent = section.heading || '要点';
    const text = document.createElement('p');
    text.textContent = section.body || '';
    block.append(heading, text);
    sections.append(block);
  });
  if (sections.children.length) article.append(sections);
  if (Array.isArray(body.highlights) && body.highlights.length) {
    const highlights = document.createElement('ul');
    highlights.className = 'report-highlights';
    body.highlights.forEach((highlight) => {
      const li = document.createElement('li');
      li.textContent = highlight;
      highlights.append(li);
    });
    article.append(highlights);
  }
  return article;
}

function renderMemberItem(item) {
  if (item.category === 'briefing') return renderMorningBrief(item);
  if (item.category === 'data-card') return renderDataCard(item);
  if (item.category === 'event') return renderEventCard(item);
  if (item.category === 'report') return renderReportCard(item);
  const article = document.createElement('article');
  article.className = 'member-content-item';
  appendMemberMeta(article, item);
  appendMemberHeading(article, item);
  return article;
}

let memberContentItems = [];
let activeMemberCategory = 'all';
const memberCategoryLabels = { all: '会员研究内容', briefing: '每日焦煤晨报', 'data-card': '供需数据卡', event: '事件提醒', report: '研究报告库' };
const memberContentTitle = document.querySelector('#member-content h2');

function renderMemberContentList() {
  memberContentList.replaceChildren();
  const items = activeMemberCategory === 'all'
    ? memberContentItems
    : memberContentItems.filter((item) => item.category === activeMemberCategory);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'member-content-empty';
    empty.textContent = currentSubscription
      ? '该会员板块暂未发布内容，请稍后再来查看。'
      : '登录并完成订阅审核后，这里会显示会员专属内容。';
    memberContentList.append(empty);
    return;
  }
  const latestBrief = items.find((item) => item.category === 'briefing');
  if (latestBrief) memberContentList.append(renderMorningBrief(latestBrief));
  items.filter((item) => item !== latestBrief).forEach((item) => {
    memberContentList.append(renderMemberItem(item));
  });
}

function renderMemberContent(items) {
  memberContentItems = items;
  renderMemberContentList();
}

function selectMemberCategory(category) {
  activeMemberCategory = category;
  if (memberContentTitle) memberContentTitle.textContent = memberCategoryLabels[category] || '会员研究内容';
  document.querySelectorAll('.member-content-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.memberCategory === category);
  });
  renderMemberContentList();
  document.querySelector('#member-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.member-content-tab').forEach((button) => {
  button.addEventListener('click', () => {
    selectMemberCategory(button.dataset.memberCategory);
  });
});
document.querySelectorAll('.service-item-link').forEach((button) => {
  button.addEventListener('click', () => selectMemberCategory(button.dataset.memberCategory));
});
document.querySelectorAll('.customer-service-trigger').forEach((button) => {
  button.addEventListener('click', () => {
    closeModal('subscribeModal');
    document.querySelector('#customer-service')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

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
  const visibleData = (data || []).filter((item) => item.category !== 'qa');
  if (!visibleData.length) {
    memberContentState.textContent = '会员内容正在整理，发布后会显示在这里。';
    return;
  }
  memberContentState.textContent = '已按发布时间更新会员专属研究内容。';
  renderMemberContent(visibleData);
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
  if (isLocalMemberPreview) {
    const saved = button.classList.contains('saved');
    setWatchButtonState(button, !saved);
    showToast(!saved ? `预览：已加入${label}` : `预览：已取消${label}`);
    return;
  }
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
  const isFreeTrial = Number(selectedPlan.price) === 0;
  const requestLabel = isFreeTrial ? '免费体验申请' : '付款申请';
  if (isLocalMemberPreview) {
    localStorage.setItem('coalPending', JSON.stringify(selectedPlan));
    closeModal('subscribeModal');
    showToast(`预览：已记录${selectedPlan.name}${requestLabel}`);
    return;
  }
  if (!supabaseClient) {
    localStorage.setItem('coalPending', JSON.stringify(selectedPlan));
    closeModal('subscribeModal');
    showToast(`已记录${selectedPlan.name}${requestLabel}（本地演示）`);
    return;
  }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = currentSession || sessionData.session;
  if (!session) {
    closeModal('subscribeModal');
    openModal('loginModal');
    loginStatus.textContent = isFreeTrial ? '请先登录，再提交免费体验申请' : '请先登录，再提交付款申请';
    return;
  }
  paymentDone.disabled = true;
  const { error } = await supabaseClient.from('payment_requests').insert({
    user_id: session.user.id,
    plan_code: selectedPlan.code,
    amount: Number(selectedPlan.price),
    payment_time: new Date().toISOString(),
    note: isFreeTrial ? '用户通过网页申请7天免费体验' : '用户通过网页提交付款核验',
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
  showToast(`已提交${selectedPlan.name}${requestLabel}，等待人工开通`);
}

function renderAuthState(session) {
  const email = session?.user?.email;
  loginButton.textContent = email ? '已登录' : '登录';
  signOutButton.hidden = !email;
  refreshMembershipButton.hidden = !email;
  sendLoginLink.hidden = Boolean(email);
  loginEmail.hidden = Boolean(email);
  loginCodeField.hidden = Boolean(email);
  verifyLoginCode.hidden = Boolean(email);
  loginStatus.textContent = email ? `当前账号：${email}` : '';
}

refreshMembershipButton.addEventListener('click', async () => {
  if (!currentSession) {
    openModal('loginModal');
    return;
  }
  if (isLocalMemberPreview) {
    showToast('预览：会员权限已同步');
    return;
  }
  refreshMembershipButton.disabled = true;
  refreshMembershipButton.textContent = '刷新中...';
  await refreshAccount(currentSession);
  refreshMembershipButton.disabled = false;
  refreshMembershipButton.textContent = '刷新状态';
  showToast(currentSubscription ? '会员权限已同步' : '暂未检测到已开通的会员权限');
});
accountNoticeRefresh.addEventListener('click', () => refreshMembershipButton.click());

function renderLocalMemberPreview() {
  const previewSession = { user: { id: 'local-preview', email: 'member-preview@local.test' } };
  const previewSubscription = {
    plan_code: 'monthly',
    status: 'active',
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const previewBrief = {
    id: 'preview-brief',
    title: '今日焦煤晨报：供应恢复节奏仍是核心变量',
    summary: '国内供应增量有限，进口补充边际改善，短期关注需求承接。',
    category: 'briefing',
    visibility: 'member',
    published_at: new Date().toISOString(),
    body: JSON.stringify({
      conclusion: '国内煤矿复产继续推进，但实际增量仍需验证，焦煤短期以高位震荡为主。',
      overnight: ['财联社焦煤产业链消息已纳入24小时采集', '公开来源暂无重大政策变化'],
      supply: '主产区复产节奏偏慢，优质主焦煤供应保持偏紧。',
      imports: '口岸通关边际改善，蒙煤补充能否持续仍需观察。',
      demand: '焦化刚需仍有支撑，钢厂利润限制原料继续提价空间。',
      watch: ['口岸日通关量', '煤矿实际产量', '焦炭提涨执行情况'],
    }),
  };
  const previewItems = [previewBrief,
    {
      title: '本周供需数据卡：供应增量仍待确认',
      summary: '把矿山、口岸、库存和焦化利润放在同一张表里，先看边际变化再看绝对值。',
      category: 'data-card',
      published_at: new Date().toISOString(),
      body: JSON.stringify({
        asOf: '2026-09-06（示例口径）',
        metrics: [
          { label: '主产区开工', value: '72.4%', change: '周环比 +1.8 个百分点', note: '复产名单增加，但有效产量释放滞后', tone: 'up' },
          { label: '甘其毛都通关', value: '701.5 车/日', change: '较上周 +46 车', note: '恢复仍低于高位区间，蒙煤补充有限', tone: 'up' },
          { label: '焦煤矿山库存', value: '偏低', change: '连续第 3 周去库', note: '低硫主焦资源更紧，配煤成本有支撑', tone: 'down' },
          { label: '焦化利润', value: '约 86 元/吨', change: '周环比 -18 元', note: '利润收窄会限制焦炭继续提涨', tone: 'down' },
        ],
        takeaway: '供应端的修复暂时没有转化为稳定增量，盘面上行仍需要需求端配合；若通关连续两周站稳 750 车以上，供应偏紧交易才会明显降温。',
      }),
    },
    {
      title: '事件提醒：焦炭提涨执行与口岸通关',
      summary: '把未来 7 天可能改变焦煤定价的事件按时间和影响路径排好。',
      category: 'event',
      published_at: new Date().toISOString(),
      body: JSON.stringify({
        priority: '中高',
        priorityTone: 'high',
        timeline: [
          { time: '09-07', title: '口岸通关数据', detail: '关注甘其毛都日通关是否连续高于 700 车，决定进口煤边际补充强弱。' },
          { time: '09-08', title: '焦炭提涨执行', detail: '核对钢厂接受范围和落地幅度，若仅局部执行，对焦煤拉动有限。' },
          { time: '09-09', title: '主产区复产反馈', detail: '跟踪山西、内蒙古复产矿的实际出煤量，区分“复产”与“复产不复量”。' },
          { time: '09-12', title: '钢厂铁水与利润', detail: '铁水回落且钢厂利润转负时，焦化补库节奏可能放缓。' },
        ],
        next: '如果通关回升而矿端库存仍下降，优先关注结构性紧缺；如果通关和复产同步放量，则观察 JM 近月升水能否收敛。',
      }),
    },
    {
      title: '周报：焦煤供应收缩的传导路径',
      summary: '从矿端扰动到盘面结构，复盘本周供给收缩如何传导到焦化和钢厂。',
      category: 'report',
      published_at: new Date(Date.now() - 86400000).toISOString(),
      body: JSON.stringify({
        abstract: '本周核心矛盾仍在供应端：国内复产节奏慢于预期，进口补充尚未形成连续增量，焦化刚需暂时托住价格。',
        sections: [
          { heading: '一、供应：恢复有量差', body: '样本矿山开工率回升，但精煤产量恢复慢于原煤，优质低硫主焦仍是最先收紧的品种。' },
          { heading: '二、进口：增量看通关连续性', body: '单日通关反弹不能等同于进口趋势反转，需要连续 5 个交易日维持在 700 车以上才有实质缓解。' },
          { heading: '三、需求：刚需尚在，利润约束增强', body: '钢厂铁水维持高位提供焦炭采购支撑，但焦化利润回落会抑制高价原料的追涨。' },
          { heading: '四、盘面：近月强于远月', body: '近月升水反映现货偏紧，远月交易复产预期；若供应兑现，月差有收敛空间。' },
        ],
        highlights: ['偏多条件：矿端库存继续去化、通关低于 700 车、焦炭提涨全面落地。', '转弱条件：复产矿连续放量、通关站上 750 车、铁水快速回落。'],
      }),
    },
  ];
  currentSession = previewSession;
  renderAuthState(previewSession);
  renderMembershipState(previewSubscription, null);
  memberContentState.textContent = '本地会员预览：已验证登录状态、会员权限和晨报完整内容。';
  renderMemberContent(previewItems);
  const previewCategory = new URLSearchParams(window.location.search).get('category');
  const validCategories = ['briefing', 'data-card', 'event', 'report'];
  if (validCategories.includes(previewCategory)) {
    activeMemberCategory = previewCategory;
    if (memberContentTitle) memberContentTitle.textContent = memberCategoryLabels[previewCategory] || '会员研究内容';
    document.querySelectorAll('.member-content-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.memberCategory === previewCategory);
    });
    renderMemberContentList();
  }
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
  let error;
  try {
    ({ error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    }));
  } catch (requestError) {
    error = requestError;
  }
  sendLoginLink.disabled = false;
  if (error) {
    loginStatus.textContent = formatAuthError(error);
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
  let data;
  let error;
  try {
    ({ data, error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'email' }));
  } catch (requestError) {
    error = requestError;
  }
  verifyLoginCode.disabled = false;
  if (error) {
    loginStatus.textContent = /expired|invalid|token|验证码/i.test(String(error.message || ''))
      ? '验证码无效或已过期，请重新获取'
      : formatAuthError(error, '登录验证');
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
const isLocalMemberPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get('preview') === 'member';
if (isLocalMemberPreview) {
  renderLocalMemberPreview();
} else if (supabaseClient) {
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
  if (isLocalMemberPreview) {
    document.querySelectorAll('.save-button').forEach((button) => setWatchButtonState(button, false));
    showToast('预览：关注清单已清空');
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
  if (isLocalMemberPreview) {
    showToast(`预览：已关注${label.trim()}`);
    return;
  }
  const { error } = await supabaseClient.from('watchlists').insert({
    user_id: currentSession.user.id,
    label: label.trim(),
    kind: 'keyword',
  });
  showToast(error ? `添加失败：${error.message}` : `已关注${label.trim()}`);
});

loadAutoBrief();
if (localStorage.getItem('coalPending')) document.querySelector('.edition').innerHTML = '<i></i>订阅待核验';
