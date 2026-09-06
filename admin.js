const adminConfig = window.SUPABASE_CONFIG || {};
const adminClient = window.supabase && adminConfig.url && adminConfig.publishableKey
  ? window.supabase.createClient(adminConfig.url, adminConfig.publishableKey)
  : null;

const authView = document.querySelector('#adminAuthView');
const appView = document.querySelector('#adminAppView');
const emailInput = document.querySelector('#adminEmail');
const codeField = document.querySelector('#adminCodeField');
const codeInput = document.querySelector('#adminCode');
const sendCodeButton = document.querySelector('#adminSendCode');
const verifyCodeButton = document.querySelector('#adminVerifyCode');
const authStatus = document.querySelector('#adminAuthStatus');
const accountLabel = document.querySelector('#adminAccount');
const signOutButton = document.querySelector('#adminSignOut');
const listStatus = document.querySelector('#adminListStatus');
const rowsContainer = document.querySelector('#adminRequestRows');
const emptyState = document.querySelector('#adminEmpty');
const searchInput = document.querySelector('#adminSearch');
const toast = document.querySelector('#adminToast');
const statusLabels = { pending: '待处理', approved: '已通过', rejected: '已拒绝' };
const allowedDomains = ['qq.com', 'foxmail.com', '163.com', '126.com', '139.com', '189.cn', 'wo.cn', 'aliyun.com'];
let currentSession = null;
let currentStatus = 'pending';
let requests = [];
let toastTimer;

function setStatus(element, message, type = 'normal') {
  element.textContent = message;
  element.classList.toggle('error', type === 'error');
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function isAllowedEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.includes(domain));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `¥${amount.toFixed(2)}` : '—';
}

function addCell(row, className, text) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  row.append(cell);
  return cell;
}

function renderRows() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = requests.filter((item) => {
    if (!query) return true;
    return [item.email, item.id, item.plan_name, item.plan_code].some((value) => String(value || '').toLowerCase().includes(query));
  });
  rowsContainer.replaceChildren();
  visible.forEach((item) => {
    const row = document.createElement('tr');
    const userCell = document.createElement('td');
    userCell.className = 'request-user';
    const email = document.createElement('strong');
    email.textContent = item.email || '未找到邮箱';
    const id = document.createElement('span');
    id.textContent = item.id;
    userCell.append(email, id);
    row.append(userCell);
    const planCell = document.createElement('td');
    planCell.className = 'request-plan';
    const planName = document.createElement('strong');
    planName.textContent = item.plan_name || item.plan_code || '—';
    const planCode = document.createElement('span');
    planCode.textContent = item.plan_code || '—';
    planCell.append(planName, planCode);
    row.append(planCell);
    addCell(row, 'request-amount', formatAmount(item.amount));
    addCell(row, 'request-time', formatDate(item.created_at));
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `status-pill status-${item.status}`;
    status.textContent = statusLabels[item.status] || item.status || '未知';
    statusCell.append(status);
    row.append(statusCell);
    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    if (item.status === 'pending') {
      const approve = document.createElement('button');
      approve.className = 'row-action approve';
      approve.type = 'button';
      approve.dataset.action = 'approve';
      approve.dataset.requestId = item.id;
      approve.textContent = '同意并开通';
      const reject = document.createElement('button');
      reject.className = 'row-action';
      reject.type = 'button';
      reject.dataset.action = 'reject';
      reject.dataset.requestId = item.id;
      reject.textContent = '拒绝';
      actions.append(approve, reject);
    } else {
      const subscription = document.createElement('span');
      subscription.className = 'request-time';
      subscription.textContent = item.subscription_status === 'active' ? `有效至 ${formatDate(item.subscription_ends_at)}` : '—';
      actions.append(subscription);
    }
    actionCell.append(actions);
    row.append(actionCell);
    rowsContainer.append(row);
  });
  emptyState.hidden = visible.length > 0;
  document.querySelector('#visibleCount').textContent = visible.length;
}

async function loadRequests() {
  if (!adminClient || !currentSession) return;
  setStatus(listStatus, '正在加载申请...');
  const { data, error } = await adminClient.rpc('admin_list_payment_requests', { p_status: currentStatus });
  if (error) {
    requests = [];
    renderRows();
    setStatus(listStatus, error.message.includes('not_authorized') ? '当前账号尚未加入客服白名单，请联系管理员。' : `加载失败：${error.message}`, 'error');
    return;
  }
  requests = Array.isArray(data) ? data : [];
  renderRows();
  const pending = currentStatus === 'pending' ? requests.length : await loadPendingCount();
  document.querySelector('#pendingCount').textContent = pending;
  setStatus(listStatus, requests.length ? `已加载 ${requests.length} 条申请` : '当前筛选没有申请');
}

async function loadPendingCount() {
  const { data, error } = await adminClient.rpc('admin_list_payment_requests', { p_status: 'pending' });
  return error || !Array.isArray(data) ? 0 : data.length;
}

async function handleSession(session) {
  currentSession = session;
  const email = session?.user?.email || '';
  authView.hidden = Boolean(session);
  appView.hidden = !session;
  signOutButton.hidden = !session;
  accountLabel.hidden = !session;
  accountLabel.textContent = email;
  if (session) {
    document.querySelector('#staffRole').textContent = '客服';
    await loadRequests();
  }
}

sendCodeButton.addEventListener('click', async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !emailInput.checkValidity()) {
    setStatus(authStatus, '请输入有效的客服邮箱', 'error');
    emailInput.focus();
    return;
  }
  if (!isAllowedEmail(email)) {
    setStatus(authStatus, '目前仅支持 QQ、163、126、139、189 等国内邮箱', 'error');
    return;
  }
  if (!adminClient) {
    setStatus(authStatus, 'Supabase 尚未配置', 'error');
    return;
  }
  sendCodeButton.disabled = true;
  setStatus(authStatus, '验证码发送中...');
  const { error } = await adminClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  sendCodeButton.disabled = false;
  if (error) {
    setStatus(authStatus, `发送失败：${error.message}`, 'error');
    return;
  }
  codeField.hidden = false;
  verifyCodeButton.hidden = false;
  codeInput.focus();
  setStatus(authStatus, '验证码已发送，请查收中文邮件');
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 8);
});

verifyCodeButton.addEventListener('click', async () => {
  const email = emailInput.value.trim().toLowerCase();
  const token = codeInput.value.trim();
  if (!/^\d{8}$/.test(token)) {
    setStatus(authStatus, '请输入 8 位验证码', 'error');
    codeInput.focus();
    return;
  }
  verifyCodeButton.disabled = true;
  setStatus(authStatus, '正在验证...');
  const { data, error } = await adminClient.auth.verifyOtp({ email, token, type: 'email' });
  verifyCodeButton.disabled = false;
  if (error) {
    setStatus(authStatus, '验证码无效或已过期，请重新获取', 'error');
    return;
  }
  await handleSession(data.session);
});

signOutButton.addEventListener('click', async () => {
  await adminClient?.auth.signOut();
  showToast('已退出登录');
  await handleSession(null);
});

document.querySelectorAll('.admin-filter').forEach((button) => {
  button.addEventListener('click', async () => {
    document.querySelectorAll('.admin-filter').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    currentStatus = button.dataset.status;
    await loadRequests();
  });
});
searchInput.addEventListener('input', renderRows);
document.querySelector('#adminRefresh').addEventListener('click', loadRequests);

rowsContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const requestId = button.dataset.requestId;
  const action = button.dataset.action;
  if (action === 'reject' && !window.confirm('确认拒绝这条会员申请吗？')) return;
  button.disabled = true;
  const functionName = action === 'approve' ? 'admin_approve_payment_request' : 'admin_reject_payment_request';
  const params = { p_request_id: requestId };
  if (action === 'reject') params.p_note = '客服审核未通过';
  const { error } = await adminClient.rpc(functionName, params);
  button.disabled = false;
  if (error) {
    showToast(`操作失败：${error.message}`);
    return;
  }
  showToast(action === 'approve' ? '会员已开通，用户刷新页面即可生效' : '申请已拒绝');
  await loadRequests();
});

if (adminClient) {
  adminClient.auth.getSession().then(({ data }) => handleSession(data.session));
  adminClient.auth.onAuthStateChange((_event, session) => handleSession(session));
} else {
  setStatus(authStatus, 'Supabase 尚未配置', 'error');
}
