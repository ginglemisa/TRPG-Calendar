import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.TRPG_KA_CONFIG ?? {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const supabase = hasSupabase ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const appState = {
  currentDate: startOfDay(new Date()),
  miniDate: startOfMonth(new Date()),
  view: "month",
  agendaCurrentMonthOnly: true,
  events: [],
  applications: [],
  selectedEvent: null,
  session: null,
  role: "guest",
  ownerNames: {},
  filters: {
    system: "",
    gm: "",
    openSeatsOnly: false,
    availabilityEventId: ""
  },
  availabilityDashboard: {
    events: [],
    loadedGm: "",
    eventsByGmId: {}
  },
  availability: {
    eventId: null,
    data: null,
    selectedPlayerIds: [],
    isLoading: false,
    isCreating: false,
    isClearing: false,
    error: "",
    actionError: "",
    actionMessage: "",
    draft: {
      dateStart: "",
      dateEnd: "",
      playerNames: ""
    }
  },
  playerAvailability: {
    token: "",
    data: null,
    selectedSlots: new Set(),
    savedSlots: new Set(),
    viewMode: "list",
    calendarMonth: "",
    editorDate: "",
    isLoading: false,
    isSaving: false,
    message: "",
    error: ""
  },
  isSavingEvent: false,
  isDeletingEvent: false,
  isApplying: false,
  busyRequestIds: new Set()
};

const AVAILABILITY_QUERY_PARAM = "availability";
const TIME_SLOTS = [
  { key: "morning", label: "上午" },
  { key: "afternoon", label: "下午" },
  { key: "evening", label: "晚上" }
];
const COMMON_SYSTEMS = ["龍與地下城 D&D", "克蘇魯的呼喚 CoC", "探索者協會 PF"];


const DEBUG = new URLSearchParams(window.location.search).has("debug");
const debugState = {
  authRefreshSeq: 0,
  loadDataRequestSeq: 0,
  renderSeq: 0,
  availabilityRenderSeq: 0
};

function debugLog(scope, payload = {}) {
  if (!DEBUG) return;
  const stamp = new Date().toISOString();
  console.debug(`[debug:${scope}]`, { stamp, ...payload });
}

function installGlobalDebugMonitors() {
  window.addEventListener("error", (event) => {
    debugLog("window.error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    debugLog("window.unhandledrejection", {
      reason: String(event.reason)
    });
  });
}

function inspectCdnResourceStatus() {
  if (!DEBUG || typeof performance?.getEntriesByType !== "function") return;
  const resources = performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.includes("unpkg.com") || entry.name.includes("jsdelivr.net"))
    .map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: Math.round(entry.duration),
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize
    }));
  debugLog("cdn.resources", { count: resources.length, resources });
}

const sampleEvents = [
  {
    id: "sample-1",
    title: "港都迷霧調查團",
    host_name: "阿凱",
    system_name: "Call of Cthulhu 7th",
    scenario_name: "鹽埕夜航",
    event_date: toDateInput(new Date()),
    start_time: "19:30",
    end_time: "23:00",
    location_name: "高雄桌遊店",
    map_url: "https://maps.google.com/?q=Kaohsiung",
    line_url: "https://line.me/",
    seats_total: 5,
    description: "港邊傳來不自然的霧聲，調查員將沿著鹽埕老街追查失蹤船員的線索。新手可。",
    gm_notes: "",
    is_date_undecided: false,
    is_registration_closed: false,
    is_public: true
  },
  {
    id: "sample-2",
    title: "劍與魔法短篇",
    host_name: "小歐",
    system_name: "Dungeons & Dragons 5e",
    scenario_name: "燃燒的市集",
    event_date: toDateInput(addDays(new Date(), 3)),
    start_time: "14:00",
    end_time: "18:00",
    location_name: "三多商圈附近",
    map_url: "https://maps.google.com/?q=Sanduo+Shopping+District",
    line_url: "https://line.me/",
    seats_total: 4,
    description: "單次團，角色現場提供，重點是快速進入冒險與角色互動。",
    gm_notes: "",
    is_date_undecided: false,
    is_registration_closed: false,
    is_public: true
  }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  body: document.body,
  periodLabel: $("#periodLabel"),
  agendaMonthToggle: $("#agendaMonthToggle"),
  agendaCurrentMonthOnly: $("#agendaCurrentMonthOnly"),
  miniLabel: $("#miniLabel"),
  calendarGrid: $("#calendarGrid"),
  agendaList: $("#agendaList"),
  statusStrip: $("#statusStrip"),
  systemFilter: $("#systemFilter"),
  gmFilter: $("#gmFilter"),
  availabilityEventFilter: $("#availabilityEventFilter"),
  openSeatsOnly: $("#openSeatsOnly"),
  sidebar: $("#sidebar"),
  requestList: $("#requestList"),
  detailRequestsPanel: $("#detailRequestsPanel"),
  detailRequests: $("#detailRequests"),
  detailLayout: $(".detail-layout"),
  eventDialog: $("#eventDialog"),
  detailDialog: $("#detailDialog"),
  loginDialog: $("#loginDialog"),
  passwordDialog: $("#passwordDialog"),
  eventForm: $("#eventForm"),
  loginForm: $("#loginForm"),
  passwordForm: $("#passwordForm"),
  applyForm: $("#applyForm"),
  applyPanel: $(".apply-panel"),
  applySubmitButton: $("#applySubmitButton"),
  applyFeedbackDialog: $("#applyFeedbackDialog"),
  availabilityPanel: $("#availabilityPanel"),
  availabilityPanelContent: $("#availabilityPanelContent"),
  playerAvailabilityPage: $("#playerAvailabilityPage"),
  loginButton: $("#loginButton"),
  changePasswordButton: $("#changePasswordButton"),
  newEventButton: $("#newEventButton"),
  deleteEventButton: $("#deleteEventButton"),
  editEventButton: $("#editEventButton"),
  detailLineLink: $("#detailLineLink"),
  detailGmNotesPanel: $("#detailGmNotesPanel"),
  detailGmNotes: $("#detailGmNotes")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  installGlobalDebugMonitors();
  inspectCdnResourceStatus();
  const availabilityToken = readAvailabilityToken();
  if (availabilityToken) {
    await initPlayerAvailabilityPage(availabilityToken);
    return;
  }

  bindControls();
  seedIcons();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    appState.session = data.session;
    appState.role = await resolveRole();
    supabase.auth.onAuthStateChange((authEvent, session) => {
      if (authEvent === "INITIAL_SESSION") return;
      scheduleAuthRefresh(session, authEvent);
    });
  } else {
    showStatus("尚未連接 Supabase，現在顯示本機示範資料。部署前請設定 SUPABASE_URL 與 SUPABASE_ANON_KEY。");
  }

  await loadData();
  render();
}

function scheduleAuthRefresh(session, authEvent = "auth") {
  const refreshId = ++debugState.authRefreshSeq;
  appState.session = session;
  appState.role = "guest";
  debugLog("auth.change", { refreshId, authEvent, hasSession: Boolean(session) });
  render();

  window.setTimeout(() => {
    void refreshAuthDependentState(refreshId, authEvent);
  }, 0);
}

async function refreshAuthDependentState(refreshId, authEvent) {
  try {
    const role = await resolveRole();
    if (refreshId !== debugState.authRefreshSeq) {
      debugLog("auth.stale", { refreshId, authEvent, step: "role" });
      return;
    }

    appState.role = role;
    await loadData();
    if (refreshId !== debugState.authRefreshSeq) {
      debugLog("auth.stale", { refreshId, authEvent, step: "data" });
      return;
    }
    render();
  } catch (error) {
    if (refreshId === debugState.authRefreshSeq) {
      showStatus(toReadableError(error, "更新登入狀態"));
      render();
    }
  }
}

function bindControls() {
  $("#prevPeriod").addEventListener("click", () => shiftPeriod(-1));
  $("#nextPeriod").addEventListener("click", () => shiftPeriod(1));
  $("#todayButton").addEventListener("click", () => {
    appState.currentDate = startOfDay(new Date());
    appState.miniDate = startOfMonth(appState.currentDate);
    render();
  });
  $("#miniPrev").addEventListener("click", () => {
    appState.miniDate = addMonths(appState.miniDate, -1);
    renderMiniCalendar();
  });
  $("#miniNext").addEventListener("click", () => {
    appState.miniDate = addMonths(appState.miniDate, 1);
    renderMiniCalendar();
  });
  $("#menuToggle").addEventListener("click", () => els.sidebar.classList.toggle("open"));
  $$(".segmented").forEach((button) => {
    button.addEventListener("click", () => {
      appState.view = button.dataset.view;
      render();
    });
  });
  els.agendaCurrentMonthOnly.addEventListener("change", () => {
    appState.agendaCurrentMonthOnly = els.agendaCurrentMonthOnly.checked;
    renderCalendarSurface();
  });
  els.systemFilter.addEventListener("change", () => {
    appState.filters.system = els.systemFilter.value;
    renderMiniCalendar();
    renderCalendarSurface();
  });
  els.gmFilter.addEventListener("change", () => {
    appState.filters.gm = els.gmFilter.value;
    appState.filters.availabilityEventId = "";
    appState.availability.data = null;
    appState.availabilityDashboard.events = [];
    appState.availabilityDashboard.loadedGm = "";
    renderAvailabilityEventFilter();
    renderMiniCalendar();
    renderCalendarSurface();
  });
  els.availabilityEventFilter?.addEventListener("focus", () => {
    void handleAvailabilityEventFilterOpen();
  });
  els.availabilityEventFilter?.addEventListener("pointerdown", () => {
    void handleAvailabilityEventFilterOpen();
  });
  els.availabilityEventFilter?.addEventListener("change", async () => {
    appState.filters.availabilityEventId = els.availabilityEventFilter.value;
    await refreshAvailabilityCalendarFromFilter();
  });
  els.openSeatsOnly.addEventListener("change", () => {
    appState.filters.openSeatsOnly = els.openSeatsOnly.checked;
    renderMiniCalendar();
    renderCalendarSurface();
  });
  els.loginButton.addEventListener("click", handleLoginButton);
  els.newEventButton.addEventListener("click", () => openEventForm({ event_date: toDateInput(appState.currentDate) }));
  els.changePasswordButton.addEventListener("click", openPasswordDialog);
  els.eventForm.addEventListener("submit", handleEventSubmit);
  $("#eventDateUndecided").addEventListener("change", syncEventFormModeControls);
  $("#eventCommonSystem").addEventListener("change", () => syncEventSystemControl({ carryActiveValue: true }));
  els.deleteEventButton.addEventListener("click", handleDeleteEvent);
  els.loginForm.addEventListener("submit", handleLogin);
  els.passwordForm.addEventListener("submit", handlePasswordUpdate);
  els.applyForm.addEventListener("submit", handleApply);
  els.editEventButton.addEventListener("click", async () => {
    if (!appState.selectedEvent) return;
    const latestEvent = await refreshSelectedEvent();
    if (!latestEvent) {
      showStatus("找不到最新團務資料，請重新整理後再試。");
      return;
    }
    els.detailDialog.close();
    openEventForm(latestEvent);
  });
  $$("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.closeDialog);
      dialog?.close();
    });
  });
  document.addEventListener("click", (event) => {
    if (!els.sidebar.contains(event.target) && !$("#menuToggle").contains(event.target)) {
      els.sidebar.classList.remove("open");
    }
  });
}

async function loadData() {
  const requestId = ++debugState.loadDataRequestSeq;
  const startedAt = performance.now();
  const role = appState.role;
  const sessionUserId = appState.session?.user?.id ?? null;
  const isStaff = role === "admin" || role === "gm";
  debugLog("loadData.start", { requestId, role, hasSupabase: Boolean(supabase) });
  if (!supabase) {
    appState.events = readLocal("trpg-ka-events", sampleEvents);
    appState.applications = readLocal("trpg-ka-applications", []);
    syncSelectedEventAfterDataLoad();
    debugLog("loadData.end", { requestId, source: "local", durationMs: Math.round(performance.now() - startedAt), events: appState.events.length, applications: appState.applications.length });
    return true;
  }

  let eventsQuery = supabase.from("events").select("*").order("is_date_undecided").order("event_date").order("start_time");
  if (!isStaff) {
    eventsQuery = eventsQuery.eq("is_public", true);
  }

  const { data: events, error: eventsError } = await eventsQuery;

  if (!isLatestLoadDataRequest(requestId)) {
    debugLog("loadData.stale", { requestId, step: "events" });
    return false;
  }

  if (eventsError) {
    showStatus(`讀取團務失敗：${eventsError.message}`);
  }

  const appsResult = isStaff
    ? await loadApplicationsForStaff(events ?? [], role, sessionUserId)
    : { data: [], error: null };

  if (!isLatestLoadDataRequest(requestId)) {
    debugLog("loadData.stale", { requestId, step: "applications" });
    return false;
  }

  if (appsResult.error) {
    showStatus(`讀取申請失敗：${appsResult.error.message}`);
  }

  const eventsWithNotes = await attachPrivateNotes(events ?? [], role, sessionUserId, requestId);
  if (!isLatestLoadDataRequest(requestId)) {
    debugLog("loadData.stale", { requestId, step: "notes" });
    return false;
  }

  const ownerNames = await loadOwnerNames(eventsWithNotes, requestId);
  if (!isLatestLoadDataRequest(requestId)) {
    debugLog("loadData.stale", { requestId, step: "owners" });
    return false;
  }

  appState.events = eventsWithNotes;
  appState.applications = appsResult.data ?? [];
  appState.ownerNames = ownerNames;
  syncSelectedEventAfterDataLoad();
  debugLog("loadData.end", { requestId, source: "supabase", durationMs: Math.round(performance.now() - startedAt), events: appState.events.length, applications: appState.applications.length, eventsError: Boolean(eventsError), appsError: Boolean(appsResult.error) });
  return true;
}

async function loadApplicationsForStaff(events, role, sessionUserId) {
  if (!supabase || !(role === "admin" || role === "gm")) return { data: [], error: null };

  let query = supabase
    .from("join_requests")
    .select("*, events(id,title,event_date,start_time,owner_user_id)")
    .order("created_at", { ascending: false });

  if (role === "gm") {
    const eventIds = manageableEvents(events, role, sessionUserId).map((event) => event.id).filter(Boolean);
    if (!eventIds.length) return { data: [], error: null };
    query = query.in("event_id", eventIds);
  }

  return query;
}

function isLatestLoadDataRequest(requestId) {
  return requestId === debugState.loadDataRequestSeq;
}

async function attachPrivateNotes(events, role = appState.role, sessionUserId = appState.session?.user?.id ?? null, requestId = debugState.loadDataRequestSeq) {
  if (!supabase || !(role === "admin" || role === "gm")) return events;
  const eventIds = events.filter((event) => canManageEventFor(event, role, sessionUserId)).map((event) => event.id).filter(Boolean);
  if (!eventIds.length) return events;

  const { data, error } = await supabase.from("event_private_notes").select("event_id, gm_notes").in("event_id", eventIds);
  if (error) {
    if (isLatestLoadDataRequest(requestId)) showStatus(`讀取 GM 小筆記失敗：${error.message}`);
    return events;
  }

  const notesByEventId = Object.fromEntries((data ?? []).map((note) => [note.event_id, note.gm_notes ?? ""]));
  return events.map((event) => (event.id in notesByEventId ? { ...event, gm_notes: notesByEventId[event.id] } : event));
}

async function loadOwnerNames(events, requestId = debugState.loadDataRequestSeq) {
  const fallback = {};
  const ownerIds = [...new Set(events.map((event) => event.owner_user_id).filter(Boolean))];
  if (!supabase || !ownerIds.length) return fallback;

  const [{ data: admins, error: adminsError }, { data: gms, error: gmsError }] = await Promise.all([
    supabase.from("admins").select("user_id, display_name").in("user_id", ownerIds),
    supabase.from("gms").select("user_id, display_name").in("user_id", ownerIds)
  ]);
  if (isLatestLoadDataRequest(requestId)) {
    if (adminsError) showStatus(`讀取管理員名稱失敗：${adminsError.message}`);
    if (gmsError) showStatus(`讀取 GM 名稱失敗：${gmsError.message}`);
  }

  [...(admins ?? []), ...(gms ?? [])].forEach((profile) => {
    fallback[profile.user_id] = profile.display_name;
  });
  return fallback;
}

async function resolveRole() {
  if (!supabase || !appState.session?.user) return "guest";
  const { data: adminData, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", appState.session.user.id)
    .maybeSingle();
  if (adminError) {
    showStatus(`檢查管理權限失敗：${adminError.message}`);
    return "guest";
  }
  if (adminData) return "admin";

  const { data: gmData, error: gmError } = await supabase
    .from("gms")
    .select("user_id")
    .eq("user_id", appState.session.user.id)
    .maybeSingle();
  if (gmError) {
    showStatus(`檢查 GM 權限失敗：${gmError.message}`);
    return "guest";
  }
  return gmData ? "gm" : "guest";
}

function render() {
  const renderId = ++debugState.renderSeq;
  debugLog("render.start", { renderId, view: appState.view, role: appState.role, session: Boolean(appState.session) });
  const isStaff = appState.role === "admin" || appState.role === "gm";
  els.body.classList.toggle("is-admin", isStaff);
  els.body.classList.toggle("has-session", Boolean(appState.session));
  els.loginButton.innerHTML = appState.session
    ? '<i data-lucide="log-out"></i><span>登出</span>'
    : '<i data-lucide="log-in"></i><span>管理登入</span>';
  $$(".segmented").forEach((button) => button.classList.toggle("active", button.dataset.view === appState.view));
  renderSystemFilter();
  renderGmFilter();
  renderAvailabilityEventFilter();
  renderMiniCalendar();
  renderCalendarSurface();
  renderRequests();
  seedIcons();
  debugLog("render.end", { renderId, events: appState.events.length, applications: appState.applications.length });
}

function renderSystemFilter() {
  const systems = [...new Set(viewableEvents().map((event) => event.system_name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant")
  );
  const current = els.systemFilter.value;
  els.systemFilter.innerHTML = '<option value="">全部系統</option>';
  systems.forEach((system) => {
    const option = document.createElement("option");
    option.value = system;
    option.textContent = system;
    els.systemFilter.append(option);
  });
  els.systemFilter.value = systems.includes(current) ? current : "";
  appState.filters.system = els.systemFilter.value;
}

function renderGmFilter() {
  const gmMap = new Map();
  viewableEvents().forEach((event) => {
    if (!event.owner_user_id) return;
    gmMap.set(event.owner_user_id, ownerDisplayName(event));
  });
  const gms = Array.from(gmMap.entries()).sort((a, b) => a[1].localeCompare(b[1], "zh-Hant"));
  const current = els.gmFilter.value;
  els.gmFilter.innerHTML = '<option value="">全部 GM</option>';
  gms.forEach(([gmId, gmName]) => {
    const option = document.createElement("option");
    option.value = gmId;
    option.textContent = gmName;
    els.gmFilter.append(option);
  });
  els.gmFilter.value = gms.some(([gmId]) => gmId === current) ? current : "";
  appState.filters.gm = els.gmFilter.value;
}

function renderCalendarSurface() {
  const availabilityMode = isAvailabilityCalendarMode();
  const labelDate = appState.currentDate;
  const isMonthView = appState.view === "month";
  els.periodLabel.textContent =
    isMonthView
      ? `${labelDate.getFullYear()} 年 ${labelDate.getMonth() + 1} 月`
      : appState.agendaCurrentMonthOnly
        ? `${labelDate.getFullYear()} 年 ${labelDate.getMonth() + 1} 月團務`
        : "所有團務";
  els.agendaMonthToggle.hidden = isMonthView;
  els.agendaCurrentMonthOnly.checked = appState.agendaCurrentMonthOnly;

  toggleViewSurface(els.calendarGrid, isMonthView);
  toggleViewSurface($(".desktop-weekdays"), isMonthView);
  toggleViewSurface(els.agendaList, !isMonthView);

  if (appState.view === "month") {
    renderMonth();
  } else {
    renderAgenda();
  }
}

function renderMonth() {
  els.calendarGrid.innerHTML = "";
  const monthStart = startOfMonth(appState.currentDate);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  days.forEach((day) => {
    const cell = document.createElement("section");
    cell.className = "day-cell";
    cell.classList.toggle("outside", day.getMonth() !== appState.currentDate.getMonth());
    cell.classList.toggle("today", isSameDate(day, new Date()));

    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(day.getDate());
    const availabilityStatus = availabilityDayStatus(toDateInput(day));
    if (isAvailabilityCalendarMode() && availabilityStatus) {
      number.classList.add(`availability-${availabilityStatus.level}`);
      number.title = availabilityStatus.popoverText;
      number.setAttribute("tabindex", "0");
      number.setAttribute("role", "button");
      number.addEventListener("click", () => showAvailabilityDayPopover(cell, day, availabilityStatus));
    }
    dayHeader.append(number);

    if (appState.role === "admin" || appState.role === "gm") {
      const addButton = document.createElement("button");
      addButton.className = "icon-button compact add-day";
      addButton.type = "button";
      addButton.setAttribute("aria-label", `${toDateInput(day)} 開團`);
      addButton.innerHTML = '<i data-lucide="plus"></i>';
      addButton.addEventListener("click", () => openEventForm({ event_date: toDateInput(day) }));
      dayHeader.append(addButton);
    }

    const stack = document.createElement("div");
    stack.className = "event-stack";

    const dayEvents = eventsForDate(day);
    dayEvents.slice(0, 4).forEach((event) => stack.append(createEventChip(event)));
    if (dayEvents.length > 4) {
      const more = document.createElement("button");
      more.className = "more-events";
      more.type = "button";
      more.textContent = `還有 ${dayEvents.length - 4} 團`;
      more.addEventListener("click", () => {
        appState.view = "agenda";
        appState.currentDate = day;
        render();
      });
      stack.append(more);
    }

    cell.append(dayHeader, stack);
    els.calendarGrid.append(cell);
  });
}

function showAvailabilityDayPopover(cell, day, availabilityStatus) {
  document.querySelectorAll(".availability-popover").forEach((popover) => popover.remove());
  document.querySelectorAll(".popover-open").forEach((target) => target.classList.remove("popover-open"));
  cell.classList.add("popover-open");
  const popover = document.createElement("span");
  popover.className = "availability-popover";
  popover.innerHTML = `
    <span class="availability-popover-date">${escapeHtml(formatDateWithWeekday(day))}</span>
    <span>${escapeHtml(availabilityStatus.countText || "")}</span>
    <span>${escapeHtml(availabilityStatus.slotText || "")}</span>
    <span>${escapeHtml(availabilityStatus.detailText || availabilityStatus.popoverText)}</span>
  `;
  cell.append(popover);
  window.setTimeout(() => {
    const close = (event) => {
      if (!cell.contains(event.target)) {
        popover.remove();
        cell.classList.remove("popover-open");
        document.removeEventListener("click", close);
      }
    };
    document.addEventListener("click", close);
  }, 0);
}

function renderAgenda() {
  els.agendaList.innerHTML = "";
  const monthStart = startOfMonth(appState.currentDate);
  const monthEnd = endOfMonth(monthStart);
  const events = filteredEvents().filter((event) => {
    if (!appState.agendaCurrentMonthOnly) return true;
    if (isDateUndecided(event)) return true;
    const eventDate = parseDate(event.event_date);
    return eventDate >= monthStart && eventDate <= monthEnd;
  });

  if (!events.length) {
    els.agendaList.append(emptyState());
    seedIcons();
    return;
  }

  const grouped = groupBy(events, eventDateGroupKey);
  Object.keys(grouped)
    .sort(compareEventGroupKeys)
    .forEach((dateKey) => {
      const row = document.createElement("section");
      row.className = "agenda-day";

      const date = document.createElement("div");
      date.className = "agenda-date";
      date.textContent = dateKey === "undecided" ? "日期未定" : formatDateWithWeekday(parseDate(dateKey));

      const list = document.createElement("div");
      list.className = "agenda-events";
      grouped[dateKey].forEach((event) => list.append(createAgendaEvent(event)));
      row.append(date, list);
      els.agendaList.append(row);
    });
}

function renderMiniCalendar() {
  els.miniLabel.textContent = `${appState.miniDate.getFullYear()} / ${appState.miniDate.getMonth() + 1}`;
  const mini = $("#miniCalendar");
  mini.innerHTML = "";
  const availabilityMode = isAvailabilityCalendarMode();
  const start = startOfWeek(startOfMonth(appState.miniDate));
  Array.from({ length: 42 }, (_, index) => addDays(start, index)).forEach((day) => {
    const button = document.createElement("button");
    button.className = "mini-day";
    button.type = "button";
    button.classList.toggle("outside", day.getMonth() !== appState.miniDate.getMonth());
    button.classList.toggle("active", !availabilityMode && isSameDate(day, appState.currentDate));
    button.classList.toggle("has-events", eventsForDate(day).length > 0);
    const availabilityStatus = availabilityMode ? availabilityDayStatus(toDateInput(day)) : null;
    if (availabilityStatus) {
      button.classList.add(`availability-${availabilityStatus.level}`);
      button.title = [formatDateWithWeekday(day), availabilityStatus.slotText, availabilityStatus.detailText]
        .filter(Boolean)
        .join("\n");
      button.setAttribute("aria-label", `${formatDateWithWeekday(day)} ${availabilityStatus.countText} ${availabilityStatus.slotText}`);
    }
    button.textContent = String(day.getDate());
    button.addEventListener("click", (event) => {
      if (availabilityMode) {
        if (availabilityStatus) {
          event.stopPropagation();
          showAvailabilityDayPopover(button, day, availabilityStatus);
        }
        return;
      }
      appState.currentDate = day;
      appState.miniDate = startOfMonth(day);
      els.sidebar.classList.remove("open");
      render();
    });
    mini.append(button);
  });
}

function renderRequests() {
  if (!(appState.role === "admin" || appState.role === "gm")) return;
  const pending = manageableRequests().filter((request) => request.status === "pending");
  els.requestList.innerHTML = "";
  if (!pending.length) {
    els.requestList.innerHTML = '<p class="muted">目前沒有待處理申請。</p>';
    return;
  }
  pending.slice(0, 8).forEach((request) => els.requestList.append(createRequestItem(request, true)));
}

function isRequestBusy(id) {
  return appState.busyRequestIds.has(id);
}

function setRequestBusy(id, isBusy) {
  if (!id) return;
  if (isBusy) {
    appState.busyRequestIds.add(id);
  } else {
    appState.busyRequestIds.delete(id);
  }
  renderRequestSurfaces();
}

function renderRequestSurfaces() {
  renderRequests();
  if (appState.selectedEvent?.id) {
    renderDetailRequests(appState.selectedEvent.id);
  }
}

function createEventChip(event) {
  const button = document.createElement("button");
  button.className = "event-chip";
  button.type = "button";
  button.classList.toggle("few", remainingSeats(event) > 0 && remainingSeats(event) <= 2);
  button.classList.toggle("full", remainingSeats(event) <= 0);
  button.innerHTML = `<span class="time">${escapeHtml(formatTime(event.start_time))}</span><span class="title">${escapeHtml(
    event.title
  )}</span>`;
  button.addEventListener("click", () => openDetail(event));
  return button;
}

function createAgendaEvent(event) {
  const item = document.createElement("article");
  item.className = "agenda-event";
  item.tabIndex = 0;
  item.innerHTML = `
    <header>
      <div>
        <div class="agenda-event-title">
          <h3>${escapeHtml(event.title)}</h3>
          ${eventLabelMarkup(event)}
        </div>
        <p>${escapeHtml(eventAgendaMeta(event))}</p>
        ${shouldShowOwnerInfo() ? `<span class="owner-label">${escapeHtml(ownerDisplayName(event))}</span>` : ""}
      </div>
      ${seatPill(event)}
    </header>
  `;
  item.addEventListener("click", () => openDetail(event));
  item.addEventListener("keydown", (eventKey) => {
    if (eventKey.key === "Enter") openDetail(event);
  });
  return item;
}

function emptyState() {
  return $("#emptyStateTemplate").content.cloneNode(true);
}

function openDetail(event) {
  appState.selectedEvent = event;
  const mapUrl = safeHttpUrl(event.map_url);
  const lineUrl = safeHttpUrl(event.line_url);
  $("#detailMeta").textContent = `${eventDateLabel(event)} · ${formatTimeRange(event)}`;
  $("#detailTitle").textContent = event.title;
  $("#detailWhen").textContent = eventDateTimeLabel(event);
  $("#detailWhere").innerHTML = mapUrl
    ? `<a href="${escapeAttr(mapUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.location_name)}</a>`
    : escapeHtml(event.location_name);
  $("#detailHost").textContent = event.host_name;
  const ownerName = ownerDisplayName(event);
  $("#detailOwner").textContent = shouldShowOwnerInfo() ? ownerName : "";
  $("#detailOwnerRow").hidden = !shouldShowOwnerInfo();
  $("#detailSystem").textContent = [event.system_name, event.scenario_name].filter(Boolean).join(" / ");
  updateDetailSeats(event);
  $("#detailDescription").textContent = event.description || "尚未填寫簡介。";
  const showGmNotes = canManageEvent(event);
  els.detailGmNotesPanel.hidden = !showGmNotes;
  els.detailGmNotes.textContent = event.gm_notes || "尚未填寫 GM 小筆記。";
  const canManage = canManageEvent(event);
  const registrationClosed = isRegistrationClosed(event);
  els.applyPanel.hidden = registrationClosed && !canManage;
  els.applyForm.hidden = registrationClosed;
  els.detailLayout.classList.toggle("single-column", els.applyPanel.hidden);

  if (lineUrl) {
    els.detailLineLink.classList.remove("missing-link");
    els.detailLineLink.removeAttribute("aria-disabled");
    els.detailLineLink.querySelector("span").innerHTML = "加入 Line 群組";
    els.detailLineLink.href = lineUrl;
    els.detailLineLink.hidden = false;
  } else {
    els.detailLineLink.classList.add("missing-link");
    els.detailLineLink.setAttribute("aria-disabled", "true");
    els.detailLineLink.removeAttribute("href");
    els.detailLineLink.querySelector("span").innerHTML = "<s>加入 Line 群組</s>";
    els.detailLineLink.hidden = false;
  }

  renderDetailRequests(event.id);
  renderAvailabilityPanel(event);
  if (canManage && isDateUndecided(event)) {
    loadAvailabilityPoll(event.id);
  }
  els.editEventButton.hidden = !canManage;
  els.applyForm.reset();
  $("#applicantPlayers").value = 1;
  els.detailDialog.showModal();
  seedIcons();
}

function toggleViewSurface(element, visible) {
  element.hidden = !visible;
  element.style.display = visible ? "" : "none";
}

function renderDetailRequests(eventId) {
  if (!(appState.role === "admin" || appState.role === "gm")) return;
  const event = eventById(eventId);
  const canManage = canManageEvent(event);
  els.detailRequestsPanel.hidden = !canManage;
  if (!canManage) {
    els.detailRequests.innerHTML = "";
    return;
  }
  const list = manageableRequests().filter((request) => request.event_id === eventId);
  els.detailRequests.innerHTML = "";
  if (!list.length) {
    els.detailRequests.innerHTML = '<p class="muted">尚無申請。</p>';
    return;
  }
  list.forEach((request) => els.detailRequests.append(createRequestItem(request, false)));
}

function refreshSelectedEventPanels(event = appState.selectedEvent) {
  if (!event) return;
  updateDetailSeats(event);
  renderDetailRequests(event.id);
  renderAvailabilityPanel(event);
}

function renderAvailabilityPanel(event = appState.selectedEvent) {
  const availabilityRenderId = ++debugState.availabilityRenderSeq;
  debugLog("availability.render.start", { availabilityRenderId, selectedEventId: event?.id ?? null, stateEventId: appState.availability.eventId, isLoading: appState.availability.isLoading });
  if (!els.availabilityPanel || !els.availabilityPanelContent) return;
  const canUseAvailability = canManageEvent(event) && isDateUndecided(event);
  els.availabilityPanel.hidden = !canUseAvailability;
  if (!canUseAvailability) {
    els.availabilityPanelContent.innerHTML = "";
    debugLog("availability.render.skip", { availabilityRenderId, reason: canManageEvent(event) ? "date_is_scheduled" : "cannot_manage" });
    return;
  }

  const state = appState.availability;
  if (!supabase) {
    els.availabilityPanelContent.innerHTML =
      '<p class="muted">可跑團時間調查需要 Supabase RPC 與 RLS，請先設定 Supabase 後使用。</p>';
    return;
  }

  if (state.isLoading || state.eventId !== event.id) {
    debugLog("availability.render.loading", { availabilityRenderId, stateEventId: state.eventId, eventId: event.id, isLoading: state.isLoading });
    els.availabilityPanelContent.innerHTML = '<p class="muted">讀取調查資料中...</p>';
    return;
  }

  if (state.error) {
    debugLog("availability.render.error", { availabilityRenderId, error: state.error });
    els.availabilityPanelContent.innerHTML = `
      <div class="availability-empty">
        <p>${escapeHtml(state.error)}</p>
        <button class="ghost-button" type="button" data-availability-retry>
          <i data-lucide="refresh-cw"></i>
          <span>重新讀取</span>
        </button>
      </div>
    `;
    els.availabilityPanelContent.querySelector("[data-availability-retry]")?.addEventListener("click", () => {
      loadAvailabilityPoll(event.id);
    });
    seedIcons();
    return;
  }

  if (!state.data?.poll) {
    renderCreateAvailabilityPoll(event);
    return;
  }

  renderExistingAvailabilityPoll(event, state.data);
  debugLog("availability.render.end", { availabilityRenderId, mode: state.data?.poll ? "existing" : "create" });
}

function renderCreateAvailabilityPoll(event) {
  const state = appState.availability;
  const defaultStart = state.draft.dateStart || event.event_date || toDateInput(appState.currentDate);
  const defaultEnd = state.draft.dateEnd || event.event_date || toDateInput(appState.currentDate);
  els.availabilityPanelContent.innerHTML = `
    <form class="availability-create-form" id="availabilityCreateForm">
      <div class="form-grid compact-form-grid">
        <label>
          <span>開始日期</span>
          <input id="availabilityDateStart" type="date" value="${escapeAttr(defaultStart)}" required />
        </label>
        <label>
          <span>結束日期</span>
          <input id="availabilityDateEnd" type="date" value="${escapeAttr(defaultEnd)}" required />
        </label>
        <label class="wide">
          <span>玩家名單（每行一位）</span>
          <textarea id="availabilityPlayerNames" rows="5" maxlength="2000" placeholder="阿明&#10;小玉&#10;Chris" required>${escapeHtml(
            state.draft.playerNames
          )}</textarea>
        </label>
      </div>
      <p class="muted">建立後會為每位玩家產生一組私人連結，玩家可用同一連結反覆更新。</p>
      ${state.actionError ? `<p class="form-message">${escapeHtml(state.actionError)}</p>` : ""}
      ${state.actionMessage ? `<p class="success-message">${escapeHtml(state.actionMessage)}</p>` : ""}
      <div class="modal-actions inline-actions">
        <span class="spacer"></span>
        <button class="primary-button" type="submit" ${appState.availability.isCreating ? "disabled" : ""}>
          <i data-lucide="link"></i>
          <span>${appState.availability.isCreating ? "建立中..." : "建立調查"}</span>
        </button>
      </div>
    </form>
  `;
  els.availabilityPanelContent.querySelector("#availabilityCreateForm")?.addEventListener("submit", handleCreateAvailabilityPoll);
  seedIcons();
}

function renderExistingAvailabilityPoll(event, data) {
  const poll = data.poll;
  const players = data.players ?? [];
  const selectedPlayers = selectedAvailabilityPlayers(players);
  const submittedPlayers = players.filter((player) => player.submitted_at);
  const pendingPlayers = players.filter((player) => !player.submitted_at);
  const summary = buildAvailabilitySummary(players, selectedPlayers, poll);

  els.availabilityPanelContent.innerHTML = `
    <div class="availability-toolbar">
      <div>
        <p class="eyebrow">調查區間</p>
        <strong>${escapeHtml(formatDateRange(poll.date_start, poll.date_end))}</strong>
        <p class="muted">${submittedPlayers.length} / ${players.length} 位已提交</p>
      </div>
      <div class="availability-toolbar-actions">
        <button class="ghost-button" type="button" data-refresh-availability ${appState.availability.isClearing ? "disabled" : ""}>
          <i data-lucide="refresh-cw"></i>
          <span>重新讀取</span>
        </button>
        <button class="danger-button" type="button" data-clear-availability ${appState.availability.isClearing ? "disabled" : ""}>
          <i data-lucide="trash-2"></i>
          <span>${appState.availability.isClearing ? "清除中..." : "清除調查"}</span>
        </button>
      </div>
    </div>
    ${appState.availability.actionError ? `<p class="form-message">${escapeHtml(appState.availability.actionError)}</p>` : ""}
    ${appState.availability.actionMessage ? `<p class="success-message">${escapeHtml(appState.availability.actionMessage)}</p>` : ""}

    <div class="availability-links availability-link-box">
      <div class="availability-links-header">
        <div>
          <p class="eyebrow">已產生</p>
          <h4>玩家私人連結</h4>
        </div>
        <span class="pill open">${players.length} 組連結</span>
      </div>
      ${players.map((player) => availabilityLinkRow(player)).join("")}
    </div>

    <div class="availability-status-grid">
      <section>
        <h4>已提交</h4>
        ${submittedPlayers.length ? playerStatusList(submittedPlayers, true) : '<p class="muted">目前尚無玩家提交。</p>'}
      </section>
      <section>
        <h4>未提交</h4>
        ${pendingPlayers.length ? playerStatusList(pendingPlayers, false) : '<p class="muted">所有玩家都已提交。</p>'}
      </section>
    </div>

    <div class="availability-results">
      <section>
        <h4>已提交者 100% 共通</h4>
        ${availabilityResultList(summary.common, "目前沒有完全重疊的時段。")}
      </section>
      <section>
        <h4>多數 / 接近共通</h4>
        ${availabilityResultList(summary.majority, "目前還沒有可統計的時段。")}
      </section>
    </div>

    <div class="availability-filter">
      <div>
        <h4>日曆檢視</h4>
        <p class="muted">未手動篩選時顯示全部玩家；可勾選單一或多位玩家檢查可跑時段。</p>
      </div>
      <button class="mini-action" type="button" data-availability-all>全部玩家</button>
      <div class="availability-filter-list">
        ${players
          .map(
            (player) => `
              <label class="chip-checkbox">
                <input type="checkbox" data-filter-player="${escapeAttr(player.id)}" ${isAvailabilityPlayerSelected(player.id, players) ? "checked" : ""} />
                <span>${escapeHtml(player.display_name)}</span>
              </label>
            `
          )
          .join("")}
      </div>
    </div>

    ${availabilityCalendar(summary.calendarDays, selectedPlayers.length)}

    <div class="availability-player-list">
      <h4>玩家填寫內容</h4>
      ${players.map((player) => playerAvailabilitySummary(player)).join("")}
    </div>
  `;

  els.availabilityPanelContent.querySelector("[data-clear-availability]")?.addEventListener("click", () => {
    handleClearAvailabilityPoll(event.id);
  });
  els.availabilityPanelContent.querySelector("[data-refresh-availability]")?.addEventListener("click", () => {
    loadAvailabilityPoll(event.id);
  });
  els.availabilityPanelContent.querySelector("[data-availability-all]")?.addEventListener("click", () => {
    appState.availability.selectedPlayerIds = [];
    renderAvailabilityPanel(event);
  });
  const filterCheckboxes = els.availabilityPanelContent.querySelectorAll("[data-filter-player]");
  debugLog("availability.bind", { filterCheckboxCount: filterCheckboxes.length });
  filterCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const checkedIds = Array.from(els.availabilityPanelContent.querySelectorAll("[data-filter-player]:checked")).map(
        (input) => input.dataset.filterPlayer
      );
      appState.availability.selectedPlayerIds = checkedIds.length === players.length ? [] : checkedIds;
      renderAvailabilityPanel(event);
    });
  });
  els.availabilityPanelContent.querySelectorAll("[data-copy-token]").forEach((button) => {
    button.addEventListener("click", () => copyAvailabilityLink(button.dataset.copyToken, button));
  });
  els.availabilityPanelContent.querySelectorAll("[data-link-input]").forEach((input) => {
    input.addEventListener("click", () => input.select());
    input.addEventListener("focus", () => input.select());
  });
  seedIcons();
}

function availabilityLinkRow(player) {
  const link = availabilityPersonalLink(player.personal_token);
  return `
    <div class="availability-link-row">
      <div>
        <strong>${escapeHtml(player.display_name)}</strong>
        <label>
          <span>私人連結</span>
          <input type="text" value="${escapeAttr(link)}" readonly data-link-input aria-label="${escapeAttr(player.display_name)} 的私人連結" />
        </label>
      </div>
      <div class="availability-link-actions">
        <button class="ghost-button" type="button" data-copy-token="${escapeAttr(player.personal_token)}">
          <i data-lucide="copy"></i>
          <span>複製連結</span>
        </button>
        <a class="ghost-button" href="${escapeAttr(link)}" target="_blank" rel="noreferrer">
          <i data-lucide="external-link"></i>
          <span>開啟</span>
        </a>
      </div>
    </div>
  `;
}

function playerStatusList(players, showTime) {
  return `
    <ul class="availability-name-list">
      ${players
        .map(
          (player) => `
            <li>
              <span>${escapeHtml(player.display_name)}</span>
              ${showTime ? `<time>${escapeHtml(formatRequestTime(player.submitted_at))}</time>` : ""}
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function availabilityResultList(entries, emptyText) {
  if (!entries.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="availability-result-list">
      ${entries
        .map(
          (entry) => `
            <span class="slot-pill ${entry.isPerfect ? "perfect" : ""}">
              ${escapeHtml(formatDateWithWeekday(parseDate(entry.slot_date)))} ${escapeHtml(slotLabel(entry.slot))}
              <strong>${entry.count}/${entry.total}</strong>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function availabilityCalendar(days, selectedTotal) {
  if (!days.length) return '<p class="muted">調查區間沒有可顯示的日期。</p>';
  return `
    <div class="availability-calendar">
      ${days
        .map(
          (day) => `
            <section class="availability-day">
              <header>
                <strong>${escapeHtml(formatDateWithWeekday(parseDate(day.date)))}</strong>
                <span>${escapeHtml(day.date)}</span>
              </header>
              <div class="availability-slot-grid">
                ${TIME_SLOTS.map((slot) => {
                  const count = day.counts[slot.key] ?? 0;
                  const isActive = count > 0;
                  const isPerfect = selectedTotal > 0 && count === selectedTotal;
                  return `
                    <div class="availability-slot-count ${isActive ? "active" : ""} ${isPerfect ? "perfect" : ""}">
                      <span>${escapeHtml(slot.label)}</span>
                      <strong>${count}/${selectedTotal}</strong>
                    </div>
                  `;
                }).join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function playerAvailabilitySummary(player) {
  if (!player.submitted_at) {
    return `
      <article class="availability-player-summary">
        <header>
          <strong>${escapeHtml(player.display_name)}</strong>
          <span class="pill">未提交</span>
        </header>
        <p class="muted">尚未填寫可跑時間。</p>
      </article>
    `;
  }

  const groupedSlots = groupBy(player.slots ?? [], (slot) => slot.slot_date);
  const rows = Object.keys(groupedSlots)
    .sort()
    .map((dateKey) => {
      const labels = groupedSlots[dateKey].map((slot) => slotLabel(slot.slot)).join("、");
      return `<li>${escapeHtml(formatDateWithWeekday(parseDate(dateKey)))}：${escapeHtml(labels)}</li>`;
    })
    .join("");

  return `
    <article class="availability-player-summary">
      <header>
        <strong>${escapeHtml(player.display_name)}</strong>
        <span class="pill open">已提交</span>
      </header>
      ${rows ? `<ul>${rows}</ul>` : '<p class="muted">已提交，但沒有選擇任何時段。</p>'}
    </article>
  `;
}

async function loadAvailabilityPoll(eventId) {
  const targetEvent = eventById(eventId) ?? (appState.selectedEvent?.id === eventId ? appState.selectedEvent : null);
  if (targetEvent && !isDateUndecided(targetEvent)) {
    appState.availability.eventId = null;
    appState.availability.data = null;
    appState.availability.error = "";
    renderAvailabilityPanel(targetEvent);
    return;
  }
  appState.availability.eventId = eventId;
  appState.availability.isLoading = true;
  appState.availability.error = "";
  appState.availability.actionError = "";
  appState.availability.actionMessage = "";
  renderAvailabilityPanel();

  if (!supabase) {
    appState.availability.isLoading = false;
    appState.availability.error = "尚未設定 Supabase，無法讀取調查。";
    renderAvailabilityPanel();
    return;
  }

  try {
    const { data, error } = await supabase.rpc("get_availability_poll", { target_event_id: eventId });
    if (appState.availability.eventId !== eventId) return;

    if (error) {
      appState.availability.error = toReadableError(error, "讀取可跑團調查");
      return;
    }

    appState.availability.data = withAvailabilitySummary(data);
    appState.availability.selectedPlayerIds = appState.availability.selectedPlayerIds.filter((id) =>
      (data.players ?? []).some((player) => player.id === id)
    );
  } catch (error) {
    if (appState.availability.eventId === eventId) {
      appState.availability.error = toReadableError(error, "讀取可跑團調查");
    }
  } finally {
    if (appState.availability.eventId === eventId) {
      appState.availability.isLoading = false;
      renderAvailabilityPanel();
      if (appState.filters.availabilityEventId === eventId) {
        renderAvailabilityCalendarViews();
      }
    }
  }
}

async function handleCreateAvailabilityPoll(event) {
  event.preventDefault();
  const selectedEvent = appState.selectedEvent;
  if (!selectedEvent || appState.availability.isCreating) return;
  if (!isDateUndecided(selectedEvent)) {
    appState.availability.actionError = "建立調查失敗：只有日期未定的團務可以使用可跑團時間調查。";
    renderAvailabilityPanel(selectedEvent);
    return;
  }

  const dateStart = $("#availabilityDateStart").value;
  const dateEnd = $("#availabilityDateEnd").value;
  const playerNamesText = $("#availabilityPlayerNames").value;
  appState.availability.draft = {
    dateStart,
    dateEnd,
    playerNames: playerNamesText
  };
  appState.availability.actionError = "";
  appState.availability.actionMessage = "";

  const names = $("#availabilityPlayerNames").value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);

  if (!dateStart || !dateEnd || dateStart > dateEnd) {
    appState.availability.actionError = "建立調查失敗：日期區間不正確。";
    renderAvailabilityPanel(selectedEvent);
    return;
  }
  if (!names.length) {
    appState.availability.actionError = "建立調查失敗：請至少輸入一位玩家。";
    renderAvailabilityPanel(selectedEvent);
    return;
  }
  if (!supabase) {
    appState.availability.actionError = "建立調查失敗：尚未設定 Supabase 連線。";
    renderAvailabilityPanel(selectedEvent);
    return;
  }

  appState.availability.isCreating = true;
  renderAvailabilityPanel(selectedEvent);

  try {
    const { data, error } = await supabase.rpc("create_availability_poll", {
      target_event_id: selectedEvent.id,
      poll_date_start: dateStart,
      poll_date_end: dateEnd,
      player_names: names
    });

    if (error) {
      appState.availability.actionError = toReadableError(error, "建立可跑團調查");
      showStatus(appState.availability.actionError);
      renderAvailabilityPanel(selectedEvent);
      return;
    }

    appState.availability.data = withAvailabilitySummary(data);
    appState.availability.selectedPlayerIds = [];
    appState.availability.draft = { dateStart: "", dateEnd: "", playerNames: "" };
    appState.availability.actionError = "";
    appState.availability.actionMessage = "調查已建立，玩家私人連結就在下方。";
    resetAvailabilityDashboardOptions();
    showStatus("可跑團時間調查已建立，玩家私人連結已顯示在調查面板中。", "success");
    if (appState.filters.availabilityEventId === selectedEvent.id) {
      renderAvailabilityCalendarViews();
    }
    renderAvailabilityPanel(selectedEvent);
    els.availabilityPanel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (error) {
    appState.availability.actionError = toReadableError(error, "建立可跑團調查");
    showStatus(appState.availability.actionError);
    renderAvailabilityPanel(selectedEvent);
  } finally {
    appState.availability.isCreating = false;
    renderAvailabilityPanel(selectedEvent);
  }
}

async function handleClearAvailabilityPoll(eventId) {
  if (appState.availability.isClearing) return;
  const ok = confirm("確定清除這個可跑團時間調查？玩家連結、玩家名單與所有已填寫時段都會永久刪除。");
  if (!ok) return;

  appState.availability.actionError = "";
  appState.availability.actionMessage = "";
  appState.availability.isClearing = true;
  renderAvailabilityPanel();

  try {
    const { error } = await supabase.rpc("clear_availability_poll", { target_event_id: eventId });
    if (error) {
      appState.availability.actionError = toReadableError(error, "清除可跑團調查");
      showStatus(appState.availability.actionError);
      return;
    }

    appState.availability.data = withAvailabilitySummary({ event: appState.availability.data?.event ?? null, poll: null, players: [] });
    appState.availability.selectedPlayerIds = [];
    appState.availability.actionMessage = "調查已清除，舊玩家連結已失效。";
    resetAvailabilityDashboardOptions();
    if (appState.filters.availabilityEventId === eventId) {
      appState.filters.availabilityEventId = "";
      renderAvailabilityCalendarViews();
    }
    showStatus("可跑團時間調查已清除，舊玩家連結已失效。", "success");
  } catch (error) {
    appState.availability.actionError = toReadableError(error, "清除可跑團調查");
    showStatus(appState.availability.actionError);
  } finally {
    appState.availability.isClearing = false;
    renderAvailabilityPanel();
  }
}

async function copyAvailabilityLink(token, button) {
  const link = availabilityPersonalLink(token);
  const label = button.querySelector("span");
  const previous = label?.textContent ?? "複製";
  button.disabled = true;
  if (label) label.textContent = "複製中...";
  try {
    await navigator.clipboard.writeText(link);
    if (label) label.textContent = "已複製";
    showStatus("玩家私人連結已複製。", "success");
    window.setTimeout(() => {
      button.disabled = false;
      if (label) label.textContent = previous;
    }, 1100);
  } catch {
    button.disabled = false;
    if (label) label.textContent = previous;
    window.prompt("無法直接複製，請手動複製這個連結：", link);
  }
}

function createRequestItem(request, compact) {
  const item = document.createElement("article");
  item.className = "request-item";
  const eventTitle = request.events?.title ?? eventById(request.event_id)?.title ?? "團務";
  const requestBusy = isRequestBusy(request.id);
  item.innerHTML = `
    <header>
      <strong>${escapeHtml(request.applicant_name)}</strong>
      <span class="pill">${escapeHtml(statusText(request.status))}</span>
    </header>
    ${compact ? `<p>${escapeHtml(eventTitle)}</p>` : ""}
    <p>提出時間：${escapeHtml(request.time_label ?? formatRequestTime(request.created_at))}</p>
    <p>${escapeHtml(request.contact_info)} · ${Number(request.players_count)} 人</p>
    ${request.note ? `<p>${escapeHtml(request.note)}</p>` : ""}
    <div class="request-actions">
      <button class="mini-action" type="button" data-status="approved" ${requestBusy ? "disabled" : ""}>核准</button>
      <button class="mini-action" type="button" data-action="delete" ${requestBusy ? "disabled" : ""}>刪除</button>
      <button class="mini-action" type="button" data-status="declined" ${requestBusy ? "disabled" : ""}>婉拒</button>
    </div>
  `;
  item.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => updateRequestStatus(request.id, button.dataset.status));
  });
  item.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteRequest(request.id));
  return item;
}

function openEventForm(event = {}) {
  if (event.id && !canManageEvent(event)) {
    showStatus("你沒有權限編輯這個團務。");
    return;
  }
  $("#eventFormTitle").textContent = event.id ? "編輯團務" : "開團";
  $("#eventId").value = event.id ?? "";
  $("#eventDateUndecided").checked = isDateUndecided(event);
  $("#eventHidden").checked = event.is_public === false;
  $("#eventRegistrationClosed").checked = isRegistrationClosed(event);
  $("#eventDate").value = isDateUndecided(event) ? "" : event.event_date ?? toDateInput(appState.currentDate);
  $("#eventStartTime").value = event.start_time?.slice(0, 5) ?? "";
  $("#eventEndTime").value = event.end_time?.slice(0, 5) ?? "";
  $("#eventSeats").value = event.seats_total ?? 4;
  $("#eventTitle").value = event.title ?? "";
  $("#eventHost").value = event.host_name ?? "";
  setEventSystemValue(event.system_name ?? "");
  $("#eventScenario").value = event.scenario_name ?? "";
  $("#eventLocation").value = event.location_name ?? "";
  $("#eventMapUrl").value = event.map_url ?? "";
  $("#eventLineUrl").value = event.line_url ?? "";
  $("#eventDescription").value = event.description ?? "";
  $("#eventGmNotes").value = event.gm_notes ?? "";
  syncEventFormModeControls();
  els.deleteEventButton.hidden = !event.id;
  els.eventDialog.showModal();
  seedIcons();
}

function setEventSystemValue(systemName) {
  const commonSystemToggle = $("#eventCommonSystem");
  const systemInput = $("#eventSystem");
  const systemPreset = $("#eventSystemPreset");
  const useCommonSystem = !systemName || COMMON_SYSTEMS.includes(systemName);

  commonSystemToggle.checked = useCommonSystem;
  systemInput.value = systemName;
  systemPreset.value = COMMON_SYSTEMS.includes(systemName) ? systemName : "";
  syncEventSystemControl();
}

function syncEventSystemControl({ carryActiveValue = false } = {}) {
  const commonSystemToggle = $("#eventCommonSystem");
  const systemInput = $("#eventSystem");
  const systemPreset = $("#eventSystemPreset");
  const useCommonSystem = commonSystemToggle.checked;

  if (carryActiveValue) {
    if (useCommonSystem && COMMON_SYSTEMS.includes(systemInput.value.trim())) {
      systemPreset.value = systemInput.value.trim();
    }
    if (!useCommonSystem && !systemInput.value.trim() && systemPreset.value) {
      systemInput.value = systemPreset.value;
    }
  }

  systemInput.hidden = useCommonSystem;
  systemInput.disabled = useCommonSystem;
  systemInput.required = !useCommonSystem;
  systemPreset.hidden = !useCommonSystem;
  systemPreset.disabled = !useCommonSystem;
  systemPreset.required = useCommonSystem;
}

function getEventSystemValue() {
  return ($("#eventCommonSystem").checked ? $("#eventSystemPreset") : $("#eventSystem")).value.trim();
}

function syncEventFormModeControls() {
  const dateInput = $("#eventDate");
  const dateUndecided = $("#eventDateUndecided").checked;
  dateInput.required = !dateUndecided;
  dateInput.disabled = dateUndecided;
  if (dateUndecided) {
    dateInput.value = "";
  } else if (!dateInput.value) {
    dateInput.value = toDateInput(appState.currentDate);
  }
}

function setEventFormSubmitting(isSubmitting) {
  appState.isSavingEvent = isSubmitting;
  const submitButton = els.eventForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = isSubmitting;
    const label = submitButton.querySelector("span");
    if (label) label.textContent = isSubmitting ? "儲存中..." : "儲存";
  }
  els.deleteEventButton.disabled = isSubmitting || appState.isDeletingEvent;
}

function setEventDeleting(isDeleting) {
  appState.isDeletingEvent = isDeleting;
  els.deleteEventButton.disabled = isDeleting || appState.isSavingEvent;
  const deleteLabel = els.deleteEventButton?.querySelector("span");
  if (deleteLabel) deleteLabel.textContent = isDeleting ? "刪除中..." : "刪除";
  const submitButton = els.eventForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = isDeleting || appState.isSavingEvent;
}

async function refreshSelectedEvent() {
  if (!appState.selectedEvent?.id) return null;
  const id = appState.selectedEvent.id;
  if (supabase) {
    const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (error) {
      showStatus(`讀取最新團務資料失敗：${error.message}`);
      return null;
    }
    if (!data) return null;
    const [eventWithNotes] = await attachPrivateNotes([data]);
    appState.selectedEvent = eventWithNotes;
    return eventWithNotes;
  }
  const localEvent = eventById(id);
  if (!localEvent) return null;
  appState.selectedEvent = localEvent;
  return localEvent;
}

async function handleEventSubmit(event) {
  event.preventDefault();
  if (!(appState.role === "admin" || appState.role === "gm")) return;
  if (appState.isSavingEvent) return;

  const mapUrlInput = $("#eventMapUrl");
  const lineUrlInput = $("#eventLineUrl");
  const mapUrl = mapUrlInput.value.trim();
  const lineUrl = lineUrlInput.value.trim();
  if (!mapUrlInput.checkValidity()) {
    mapUrlInput.reportValidity();
    showStatus("Google Map 連結格式不正確，請輸入完整網址（含 https://）。");
    return;
  }
  if (!lineUrlInput.checkValidity()) {
    lineUrlInput.reportValidity();
    showStatus("Line 連結格式不正確，請輸入完整網址（含 https://）。");
    return;
  }
  if (mapUrl && !safeHttpUrl(mapUrl)) {
    showStatus("Google Map 連結僅支援 http:// 或 https:// 網址。");
    return;
  }
  if (lineUrl && !safeHttpUrl(lineUrl)) {
    showStatus("Line 連結僅支援 http:// 或 https:// 網址。");
    return;
  }

  const id = $("#eventId").value;
  const dateUndecided = $("#eventDateUndecided").checked;
  const eventDate = $("#eventDate").value;
  const systemName = getEventSystemValue();
  const gmNotes = $("#eventGmNotes").value.trim();
  if (!dateUndecided && !eventDate) {
    $("#eventDate").reportValidity();
    showStatus("儲存失敗：請選擇日期，或勾選日期未定。");
    return;
  }
  if (!systemName) {
    ($("#eventCommonSystem").checked ? $("#eventSystemPreset") : $("#eventSystem")).reportValidity();
    showStatus("儲存失敗：請選擇或輸入系統。");
    return;
  }

  const payload = {
    title: $("#eventTitle").value.trim(),
    host_name: $("#eventHost").value.trim(),
    system_name: systemName,
    scenario_name: $("#eventScenario").value.trim(),
    event_date: dateUndecided ? null : eventDate,
    is_date_undecided: dateUndecided,
    start_time: $("#eventStartTime").value || null,
    end_time: $("#eventEndTime").value || null,
    location_name: $("#eventLocation").value.trim(),
    map_url: mapUrl ? safeHttpUrl(mapUrl) : null,
    line_url: lineUrl ? safeHttpUrl(lineUrl) : null,
    seats_total: Number($("#eventSeats").value),
    description: $("#eventDescription").value.trim(),
    is_registration_closed: $("#eventRegistrationClosed").checked,
    is_public: !$("#eventHidden").checked
  };
  if (!id && appState.session?.user?.id) {
    payload.owner_user_id = appState.session.user.id;
  }

  setEventFormSubmitting(true);
  try {
    if (supabase) {
      if (id) {
        const latest = await refreshSelectedEventById(id);
        if (!latest) {
          showStatus("儲存失敗：資料可能已被刪除或你沒有檢視權限。");
          return;
        }
        if (!canManageEvent(latest)) {
          showStatus("儲存失敗：你沒有權限編輯這個團務。");
          return;
        }
      }
      const query = id
        ? supabase.from("events").update(payload).eq("id", id).select("id")
        : supabase.from("events").insert(payload).select("id");
      const { data, error } = await query;
      if (error) {
        showStatus(toReadableError(error, "儲存團務"));
        return;
      }
      if (!data || data.length === 0) {
        showStatus("儲存失敗：沒有權限、資料不存在或資料已被其他操作變更。");
        return;
      }
      await savePrivateNotes(data[0].id, gmNotes);
    } else {
      const localEvents = [...appState.events];
      if (id) {
        const index = localEvents.findIndex((item) => item.id === id);
        if (index < 0) {
          showStatus("儲存失敗：找不到要更新的團務，請重新整理後再試。");
          return;
        }
        localEvents[index] = { ...localEvents[index], ...payload, gm_notes: gmNotes };
      } else {
        localEvents.push({ id: crypto.randomUUID(), ...payload, gm_notes: gmNotes });
      }
      writeLocal("trpg-ka-events", localEvents);
    }

    els.eventDialog.close();
    await loadData();
    if (id) {
      const fresh = await refreshSelectedEventById(id);
      if (!fresh) showStatus("儲存成功，但重新讀取最新資料時找不到該筆團務。", "success");
    }
    showStatus(id ? "團務已更新。" : "團務已建立。", "success");
    render();
  } catch (error) {
    showStatus(toReadableError(error, "儲存團務"));
  } finally {
    setEventFormSubmitting(false);
  }
}

async function savePrivateNotes(eventId, gmNotes) {
  if (!supabase || !eventId) return;
  const { error } = await supabase
    .from("event_private_notes")
    .upsert({ event_id: eventId, gm_notes: gmNotes }, { onConflict: "event_id" });
  if (error) throw error;
}

async function handleDeleteEvent() {
  const id = $("#eventId").value;
  if (appState.isDeletingEvent) return;
  if (!id || !confirm("確定刪除這個團務？")) return;
  const event = eventById(id);
  if (event && !canManageEvent(event)) {
    showStatus("你沒有權限刪除這個團務。");
    return;
  }

  setEventDeleting(true);
  try {
    if (supabase) {
      const latest = await refreshSelectedEventById(id);
      if (!latest) {
        showStatus("刪除失敗：資料可能已被刪除或你沒有檢視權限。");
        return;
      }
      if (!canManageEvent(latest)) {
        showStatus("刪除失敗：你沒有權限刪除這個團務。");
        return;
      }
      const { data, error } = await supabase.from("events").delete().eq("id", id).select("id");
      if (error) {
        showStatus(toReadableError(error, "刪除團務"));
        return;
      }
      if (!data || data.length === 0) {
        showStatus("刪除失敗：沒有權限、資料不存在或資料已被其他操作變更。");
        return;
      }
    } else {
      writeLocal(
        "trpg-ka-events",
        appState.events.filter((event) => event.id !== id)
      );
    }

    els.eventDialog.close();
    clearSelectedEvent();
    if (appState.filters.availabilityEventId === id) {
      appState.filters.availabilityEventId = "";
    }
    resetAvailabilityDashboardOptions();
    await loadData();
    showStatus("團務已刪除。", "success");
    render();
  } catch (error) {
    showStatus(toReadableError(error, "刪除團務"));
  } finally {
    setEventDeleting(false);
  }
}

async function handleApply(event) {
  event.preventDefault();
  if (!appState.selectedEvent) return;
  if (isRegistrationClosed(appState.selectedEvent)) {
    showStatus("這個團務目前已關閉報名。");
    return;
  }
  if (appState.isApplying) return;
  setApplySubmitting(true);

  try {
    const payload = {
      event_id: appState.selectedEvent.id,
      applicant_name: $("#applicantName").value.trim(),
      contact_info: $("#applicantContact").value.trim(),
      players_count: Number($("#applicantPlayers").value),
      note: $("#applicantNote").value.trim(),
      time_label: formatRequestTime(new Date().toISOString()),
      status: "pending"
    };

    if (supabase) {
      const { error } = await supabase.from("join_requests").insert(payload);
      if (error) {
        showStatus(toReadableError(error, "送出申請"));
        return;
      }
    } else {
      const applications = readLocal("trpg-ka-applications", []);
      applications.push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload });
      writeLocal("trpg-ka-applications", applications);
    }

    els.applyForm.reset();
    $("#applicantPlayers").value = 1;
    showStatus("已送出申請。");
    els.applyFeedbackDialog?.showModal();
    await loadData();
    render();
  } catch (error) {
    showStatus(toReadableError(error, "送出申請"));
  } finally {
    setApplySubmitting(false);
  }
}

function setApplySubmitting(isSubmitting) {
  appState.isApplying = isSubmitting;
  if (!els.applySubmitButton) return;
  els.applySubmitButton.disabled = isSubmitting;
  const label = els.applySubmitButton.querySelector("span");
  if (label) {
    label.textContent = isSubmitting ? "送出中..." : "送出申請";
  }
}

async function refreshSelectedEventById(id) {
  if (!id) return null;
  if (supabase) {
    const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (error) {
      showStatus(toReadableError(error, "讀取團務"));
      return null;
    }
    if (!data) return null;
    const [eventWithNotes] = await attachPrivateNotes([data]);
    return eventWithNotes;
  }
  return eventById(id) ?? null;
}

function toReadableError(error, action = "操作") {
  const message = error?.message || "未知錯誤";
  const code = error?.code || "";
  const lower = message.toLowerCase();
  const knownMessages = {
    permission_denied: `${action}失敗：權限不足。`,
    event_not_found: `${action}失敗：找不到團務，資料可能已被刪除。`,
    availability_poll_exists: `${action}失敗：這個團務已經有可跑團時間調查。`,
    availability_poll_not_found: `${action}失敗：調查不存在，可能已被清除。`,
    availability_requires_undecided_date: `${action}失敗：只有日期未定的團務可以使用可跑團時間調查。`,
    availability_link_invalid: `${action}失敗：連結不存在、已失效或調查已被清除。`,
    invalid_poll_date_range: `${action}失敗：日期區間不正確。`,
    availability_players_required: `${action}失敗：請至少提供一位玩家。`,
    too_many_availability_players: `${action}失敗：玩家數量過多。`,
    availability_player_name_too_long: `${action}失敗：玩家名稱過長。`,
    invalid_availability_slots: `${action}失敗：時段資料格式不正確。`,
    invalid_slot_date: `${action}失敗：時段日期格式不正確。`,
    invalid_slot_name: `${action}失敗：時段名稱不正確。`,
    slot_date_out_of_range: `${action}失敗：選取日期不在調查區間內。`
  };
  const knownKey = Object.keys(knownMessages).find((key) => lower.includes(key));
  if (knownKey) return knownMessages[knownKey];
  if (lower.includes("events_date_required_unless_undecided")) {
    return `${action}失敗：請選擇日期，或勾選日期未定。`;
  }
  if (code === "PGRST116" || lower.includes("jwt expired") || lower.includes("refresh token")) {
    return `${action}失敗：登入已過期，請重新登入後再試。`;
  }
  if (lower.includes("permission") || lower.includes("not allowed") || lower.includes("row-level security")) {
    return `${action}失敗：權限不足。`;
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return `${action}失敗：網路連線異常，請檢查網路後重試。`;
  }
  return `${action}失敗：${message}`;
}


function setLoginSubmitting(isSubmitting) {
  if (!els.loginForm) return;
  const submitButton = els.loginForm.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  const label = submitButton.querySelector("span");
  if (label) label.textContent = isSubmitting ? "登入中..." : "登入";
}

function setPasswordSubmitting(isSubmitting) {
  if (!els.passwordForm) return;
  const submitButton = els.passwordForm.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  const label = submitButton.querySelector("span");
  if (label) label.textContent = isSubmitting ? "更新中..." : "更新密碼";
}

function setLogoutSubmitting(isSubmitting) {
  if (!els.loginButton) return;
  els.loginButton.disabled = isSubmitting;
  const label = els.loginButton.querySelector("span");
  if (label) label.textContent = isSubmitting ? "登出中..." : "登出";
}

async function handleLogin(event) {
  event.preventDefault();
  $("#loginMessage").textContent = "";

  if (!supabase) {
    $("#loginMessage").textContent = "尚未設定 Supabase 連線。";
    return;
  }

  setLoginSubmitting(true);
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: $("#loginEmail").value.trim(),
      password: $("#loginPassword").value
    });

    if (error) {
      $("#loginMessage").textContent = error.message;
      showStatus("登入失敗，請確認帳密後重試。");
      return;
    }

    els.loginDialog.close();
    showStatus("登入成功。", "success");
  } catch (error) {
    $("#loginMessage").textContent = toReadableError(error, "登入");
    showStatus(toReadableError(error, "登入"));
  } finally {
    setLoginSubmitting(false);
  }
}

async function handleLoginButton() {
  if (appState.session && supabase) {
    const shouldLogout = window.confirm("確定要登出嗎？");
    if (!shouldLogout) {
      showStatus("已取消登出。");
      return;
    }

    setLogoutSubmitting(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showStatus(`登出失敗：${error.message}`);
        return;
      }
      showStatus("已登出。", "success");
    } catch (error) {
      showStatus(toReadableError(error, "登出"));
    } finally {
      setLogoutSubmitting(false);
    }
    return;
  }
  els.loginDialog.showModal();
}

function openPasswordDialog() {
  if (!appState.session) {
    showStatus("請先登入後再修改密碼。");
    return;
  }
  $("#passwordMessage").textContent = "";
  els.passwordForm.reset();
  els.passwordDialog.showModal();
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  $("#passwordMessage").textContent = "";

  if (!supabase || !appState.session) {
    $("#passwordMessage").textContent = "目前尚未登入。";
    return;
  }

  const newPassword = $("#newPassword").value;
  const confirmPassword = $("#confirmPassword").value;

  if (newPassword !== confirmPassword) {
    $("#passwordMessage").textContent = "兩次輸入的新密碼不一致。";
    return;
  }

  setPasswordSubmitting(true);
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      $("#passwordMessage").textContent = error.message;
      return;
    }

    els.passwordDialog.close();
    showStatus("密碼已更新。", "success");
  } catch (error) {
    $("#passwordMessage").textContent = toReadableError(error, "更新密碼");
  } finally {
    setPasswordSubmitting(false);
  }
}

async function initPlayerAvailabilityPage(token) {
  appState.playerAvailability.token = token;
  els.body.classList.add("availability-route");
  document.querySelector(".app-shell")?.setAttribute("hidden", "");
  els.playerAvailabilityPage.hidden = false;

  if (!supabase) {
    appState.playerAvailability.error = "此連結需要 Supabase 連線，目前尚未設定。";
    renderPlayerAvailabilityPage();
    return;
  }

  appState.playerAvailability.isLoading = true;
  renderPlayerAvailabilityPage();
  await loadPlayerAvailability(token);
}

async function loadPlayerAvailability(token) {
  try {
    const { data, error } = await supabase.rpc("get_player_availability", { target_token: token });
    if (error) {
      appState.playerAvailability.error = toReadableError(error, "讀取可跑團連結");
      return;
    }

    appState.playerAvailability.data = data;
    appState.playerAvailability.selectedSlots = slotsToSelection(data.slots ?? []);
    appState.playerAvailability.savedSlots = new Set(appState.playerAvailability.selectedSlots);
    appState.playerAvailability.calendarMonth = data.poll?.date_start?.slice(0, 7) ?? "";
    appState.playerAvailability.error = "";
  } catch (error) {
    appState.playerAvailability.error = toReadableError(error, "讀取可跑團連結");
  } finally {
    appState.playerAvailability.isLoading = false;
    renderPlayerAvailabilityPage();
  }
}

function renderPlayerAvailabilityPage() {
  const state = appState.playerAvailability;
  if (!els.playerAvailabilityPage) return;

  if (state.isLoading) {
    els.playerAvailabilityPage.innerHTML = `
      <section class="player-card">
        <p class="eyebrow">可跑團時間調查</p>
        <h1>讀取中...</h1>
        <p class="muted">正在確認你的私人連結。</p>
      </section>
    `;
    seedIcons();
    return;
  }

  if (state.error || !state.data) {
    els.playerAvailabilityPage.innerHTML = `
      <section class="player-card">
        <p class="eyebrow">可跑團時間調查</p>
        <h1>連結無法使用</h1>
        <p class="form-message">${escapeHtml(state.error || "這個連結不存在或調查已被清除。")}</p>
        <a class="ghost-button" href="${escapeAttr(location.pathname)}">
          <i data-lucide="calendar-days"></i>
          <span>回到約團月曆</span>
        </a>
      </section>
    `;
    seedIcons();
    return;
  }

  const data = state.data;
  const dates = datesBetween(data.poll.date_start, data.poll.date_end);
  els.playerAvailabilityPage.innerHTML = `
    <section class="player-card wide-player-card">
      <header class="player-page-header">
        <div>
          <p class="eyebrow">可跑團時間調查</p>
          <h1>${escapeHtml(data.event.title)}</h1>
          <p class="muted">${escapeHtml([data.event.system_name, data.event.scenario_name].filter(Boolean).join(" / "))}</p>
          <p class="muted">「整天」會同時選取上午、下午、晚上。再次儲存會覆蓋你前一次填寫的內容。</p>
          <p class="success-message">已儲存，你可以之後用同一個連結再回來更新。</p>
        </div>
      </header>

      <div class="player-context">
        <div>
          <span>填寫者</span>
          <strong>${escapeHtml(data.player.display_name)}</strong>
        </div>
        <div>
          <span>團務時間</span>
          <strong>${escapeHtml(formatEventContext(data.event))}</strong>
        </div>
        <div>
          <span>可選區間</span>
          <strong>${escapeHtml(formatDateRange(data.poll.date_start, data.poll.date_end))}</strong>
        </div>
      </div>

      <form id="playerAvailabilityForm" class="player-availability-form">
        <div class="player-toolbar">
          <button class="ghost-button" type="button" id="playerMonthModeButton">月曆模式</button>
          <button class="primary-button" type="button" id="playerSaveCloseButton" ${state.isSaving ? "disabled" : ""}>
            <i data-lucide="save"></i><span>${state.isSaving ? "儲存中..." : "儲存並關閉"}</span>
          </button>
        </div>
        ${renderPlayerModeContent(dates)}
        ${state.viewMode === "calendar" ? playerDateModal(dates) : ""}
        ${state.error ? `<p class="form-message">${escapeHtml(state.error)}</p>` : ""}
      </form>
    </section>
  `;

  bindPlayerAvailabilityInteractions();
  seedIcons();
}


function renderPlayerModeContent(dates) {
  const state = appState.playerAvailability;
  if (state.viewMode === "calendar") return playerCalendarView(dates);
  return `<div class="player-date-list">${dates.map((dateKey) => playerDateRow(dateKey)).join("")}</div>`;
}

function bindPlayerAvailabilityInteractions() {
  const state = appState.playerAvailability;
  els.playerAvailabilityPage.querySelector("#playerMonthModeButton")?.addEventListener("click", () => { state.viewMode = state.viewMode === "calendar" ? "list" : "calendar"; state.editorDate = ""; renderPlayerAvailabilityPage(); });
  els.playerAvailabilityPage.querySelector("#playerSaveCloseButton")?.addEventListener("click", handlePlayerSaveAndClose);
  els.playerAvailabilityPage.querySelectorAll("[data-player-slot]").forEach((checkbox) => checkbox.addEventListener("change", () => { setPlayerSlot(checkbox.dataset.date, checkbox.dataset.playerSlot, checkbox.checked); renderPlayerAvailabilityPage(); }));
  els.playerAvailabilityPage.querySelectorAll("[data-all-day]").forEach((checkbox) => { const dateKey=checkbox.dataset.date; const c=TIME_SLOTS.filter((slot)=>hasPlayerSlot(dateKey,slot.key)).length; checkbox.indeterminate=c>0&&c<TIME_SLOTS.length; checkbox.addEventListener("change",()=>{ TIME_SLOTS.forEach((slot)=>setPlayerSlot(dateKey,slot.key,checkbox.checked)); renderPlayerAvailabilityPage(); }); });
  els.playerAvailabilityPage.querySelectorAll("[data-calendar-date]").forEach((button)=>button.addEventListener("click",()=>{ if(button.disabled)return; state.editorDate=button.dataset.calendarDate; renderPlayerAvailabilityPage(); }));
  els.playerAvailabilityPage.querySelectorAll("[data-modal-pick-slot]").forEach((button)=>button.addEventListener("click",()=>{ applyDateSelection(state.editorDate,button.dataset.modalPickSlot); renderPlayerAvailabilityPage(); }));
  els.playerAvailabilityPage.querySelector("[data-close-date-modal]")?.addEventListener("click",()=>{ state.editorDate=""; renderPlayerAvailabilityPage(); });
  els.playerAvailabilityPage.querySelector("[data-date-modal-backdrop]")?.addEventListener("click",(event)=>{ if (event.target !== event.currentTarget) return; state.editorDate=""; renderPlayerAvailabilityPage(); });
  els.playerAvailabilityPage.querySelector("#playerPrevMonth")?.addEventListener("click",()=>{ state.calendarMonth=toDateInput(addMonths(parseDate(`${state.calendarMonth}-01`),-1)).slice(0,7); state.editorDate=""; renderPlayerAvailabilityPage();});
  els.playerAvailabilityPage.querySelector("#playerNextMonth")?.addEventListener("click",()=>{ state.calendarMonth=toDateInput(addMonths(parseDate(`${state.calendarMonth}-01`),1)).slice(0,7); state.editorDate=""; renderPlayerAvailabilityPage();});
}

function playerCalendarView(dates){ const state=appState.playerAvailability; const month=state.calendarMonth||dates[0].slice(0,7); const first=parseDate(`${month}-01`); const start=addDays(first,-first.getDay()); const end=addDays(start,41); const allowed=new Set(dates); const cells=[]; for(let d=new Date(start); d<=end; d=addDays(d,1)){ const key=toDateInput(d); const inMonth=key.startsWith(month); const disabled=!allowed.has(key); const selected=TIME_SLOTS.filter((slot)=>hasPlayerSlot(key,slot.key)).length; cells.push(`<button type="button" class="player-cal-day ${inMonth?"":"muted-day"} ${selected?"has-choice":""}" data-calendar-date="${key}" ${disabled?"disabled":""}><span>${d.getDate()}</span>${selected?`<small>${selected}/3</small>`:""}</button>`);} return `<div class="player-calendar-wrap"><div class="player-cal-head"><button type="button" class="icon-button" id="playerPrevMonth">◀</button><strong>${month}</strong><button type="button" class="icon-button" id="playerNextMonth">▶</button></div><div class="player-cal-grid">${cells.join("")}</div></div>`;}
function applyDateSelection(dateKey,slot){ if(!dateKey) return; if(slot==="all"){ TIME_SLOTS.forEach((s)=>setPlayerSlot(dateKey,s.key,true)); return; } setPlayerSlot(dateKey,slot,!hasPlayerSlot(dateKey,slot)); }
function playerDateModal(dates){ const state=appState.playerAvailability; if(!state.editorDate || !dates.includes(state.editorDate)) return ""; const dateKey=state.editorDate; const allSelected=TIME_SLOTS.every((slot)=>hasPlayerSlot(dateKey,slot.key)); return `<div class="player-date-modal-backdrop" data-date-modal-backdrop><div class="player-date-modal"><header><strong>${escapeHtml(formatDateWithWeekday(parseDate(dateKey)))}</strong><button type="button" class="icon-button compact" data-close-date-modal>✕</button></header><div class="player-modal-vshape"><button type="button" class="ghost-button ${allSelected ? "active" : ""}" data-modal-pick-slot="all">整天</button><div><button type="button" class="ghost-button ${hasPlayerSlot(dateKey, "morning") ? "active" : ""}" data-modal-pick-slot="morning">上午</button><button type="button" class="ghost-button ${hasPlayerSlot(dateKey, "afternoon") ? "active" : ""}" data-modal-pick-slot="afternoon">下午</button><button type="button" class="ghost-button ${hasPlayerSlot(dateKey, "evening") ? "active" : ""}" data-modal-pick-slot="evening">晚上</button></div></div><p class="muted">可連續點選多個時段，完成後再關閉視窗。</p></div></div>`; }
async function handlePlayerSaveAndClose(){ const ok=await savePlayerAvailability(); if(!ok)return; window.close(); if(!window.closed){ appState.playerAvailability.message="已儲存，請手動關閉此分頁。"; renderPlayerAvailabilityPage(); }}
function playerDateRow(dateKey) {
  const allSelected = TIME_SLOTS.every((slot) => hasPlayerSlot(dateKey, slot.key));
  return `
    <fieldset class="player-date-row">
      <legend>${escapeHtml(formatDateWithWeekday(parseDate(dateKey)))}</legend>
      <label class="slot-checkbox">
        <input type="checkbox" data-all-day data-date="${escapeAttr(dateKey)}" ${allSelected ? "checked" : ""} />
        <span>整天</span>
      </label>
      ${TIME_SLOTS.map(
        (slot) => `
          <label class="slot-checkbox">
            <input type="checkbox" data-player-slot="${escapeAttr(slot.key)}" data-date="${escapeAttr(dateKey)}" ${
              hasPlayerSlot(dateKey, slot.key) ? "checked" : ""
            } />
            <span>${escapeHtml(slot.label)}</span>
          </label>
        `
      ).join("")}
    </fieldset>
  `;
}

async function handlePlayerAvailabilitySave(event) {
  event.preventDefault();
  await savePlayerAvailability();
}

async function savePlayerAvailability() {
  const state = appState.playerAvailability;
  if (state.isSaving || !state.token) return;

  state.isSaving = true;
  state.message = "";
  state.error = "";
  renderPlayerAvailabilityPage();

  try {
    const selectedSlots = Array.from(state.selectedSlots)
      .map((key) => {
        const [slotDate, slot] = key.split("|");
        return { slot_date: slotDate, slot };
      })
      .sort((a, b) => `${a.slot_date}-${slotOrder(a.slot)}`.localeCompare(`${b.slot_date}-${slotOrder(b.slot)}`));

    const { data, error } = await supabase.rpc("submit_player_availability", {
      target_token: state.token,
      selected_slots: selectedSlots
    });

    if (error) {
      state.error = toReadableError(error, "儲存可跑時間");
      if (isAvailabilityLinkInvalid(error)) {
        state.data = null;
        state.selectedSlots = new Set();
      }
      renderPlayerAvailabilityPage();
      return false;
    }

    state.data = data;
    state.selectedSlots = slotsToSelection(data.slots ?? []);
    state.savedSlots = new Set(state.selectedSlots);
    state.message = "已儲存，你可以之後用同一個連結再回來更新。";
    return true;
  } catch (error) {
    state.error = toReadableError(error, "儲存可跑時間");
    return false;
  } finally {
    state.isSaving = false;
    renderPlayerAvailabilityPage();
  }
  return true;
}


function hasPlayerSlot(dateKey, slot) {
  return appState.playerAvailability.selectedSlots.has(selectionKey(dateKey, slot));
}

function setPlayerSlot(dateKey, slot, selected) {
  const key = selectionKey(dateKey, slot);
  appState.playerAvailability.message = "";
  if (selected) {
    appState.playerAvailability.selectedSlots.add(key);
  } else {
    appState.playerAvailability.selectedSlots.delete(key);
  }
}

async function updateRequestStatus(id, status) {
  if (!(appState.role === "admin" || appState.role === "gm")) return;
  if (isRequestBusy(id)) return;
  const request = appState.applications.find((item) => item.id === id);
  const event = request ? eventById(request.event_id) : null;
  if (!request || !canManageRequest(request)) {
    showStatus("更新申請失敗：你沒有權限管理這筆申請。");
    return;
  }

  if (status === "approved" && request && event && request.status !== "approved") {
    const available = remainingSeats(event);
    const requestedPlayers = Number(request.players_count || 1);
    if (requestedPlayers > available) {
      showStatus(`名額不足：目前只剩 ${Math.max(0, available)} 人，這筆申請是 ${requestedPlayers} 人。`);
      return;
    }
  }

  setRequestBusy(id, true);
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("join_requests")
        .update({ status })
        .eq("id", id)
        .eq("event_id", request.event_id)
        .select("id");
      if (error) {
        showStatus(toReadableError(error, "更新申請"));
        return;
      }
      if (!data || data.length === 0) {
        showStatus("更新申請失敗：沒有權限、資料不存在或資料已被其他操作變更。");
        return;
      }
    } else {
      const applications = appState.applications.map((request) => (request.id === id ? { ...request, status } : request));
      writeLocal("trpg-ka-applications", applications);
    }

    await loadData();
    const freshEvent = syncSelectedEventAfterDataLoad();
    if (freshEvent) {
      refreshSelectedEventPanels(freshEvent);
    }
    render();
  } catch (error) {
    showStatus(toReadableError(error, "更新申請"));
  } finally {
    setRequestBusy(id, false);
  }
}

async function deleteRequest(id) {
  if (!(appState.role === "admin" || appState.role === "gm")) return;
  if (isRequestBusy(id)) return;
  const request = appState.applications.find((item) => item.id === id);
  if (!request || !canManageRequest(request)) {
    showStatus("刪除申請失敗：你沒有權限管理這筆申請。");
    return;
  }
  if (!confirm("確定刪除這筆申請？此動作無法復原。")) return;

  setRequestBusy(id, true);
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("join_requests")
        .delete()
        .eq("id", id)
        .eq("event_id", request.event_id)
        .select("id");
      if (error) {
        showStatus(toReadableError(error, "刪除申請"));
        return;
      }
      if (!data || data.length === 0) {
        showStatus("刪除申請失敗：沒有權限、資料不存在或資料已被其他操作變更。");
        return;
      }
    } else {
      const applications = appState.applications.filter((request) => request.id !== id);
      writeLocal("trpg-ka-applications", applications);
    }

    await loadData();
    const freshEvent = syncSelectedEventAfterDataLoad();
    if (freshEvent) {
      refreshSelectedEventPanels(freshEvent);
    }
    showStatus("申請已刪除。", "success");
    render();
  } catch (error) {
    showStatus(toReadableError(error, "刪除申請"));
  } finally {
    setRequestBusy(id, false);
  }
}

function shiftPeriod(direction) {
  appState.currentDate = addMonths(appState.currentDate, direction);
  appState.miniDate = startOfMonth(appState.currentDate);
  render();
}

function filteredEvents() {
  return viewableEvents()
    .filter((event) => !appState.filters.system || event.system_name === appState.filters.system)
    .filter((event) => !appState.filters.gm || event.owner_user_id === appState.filters.gm)
    .filter(
      (event) =>
        !appState.filters.openSeatsOnly || (remainingSeats(event) > 0 && !isRegistrationClosed(event))
    )
    .sort(compareEvents);
}

function eventsForDate(date) {
  const key = toDateInput(date);
  return filteredEvents().filter((event) => isCalendarVisibleEvent(event) && event.event_date === key);
}

function viewableEvents() {
  return appState.events.filter((event) => event.is_public !== false || canManageEvent(event));
}

function isCalendarVisibleEvent(event) {
  return event.is_public !== false && !isDateUndecided(event) && Boolean(event.event_date);
}

function isDateUndecided(event) {
  if (!event) return false;
  return event.is_date_undecided === true || (Boolean(event.id) && !event.event_date);
}

function isHiddenEvent(event) {
  return event?.is_public === false;
}

function isRegistrationClosed(event) {
  return event?.is_registration_closed === true;
}

function eventDateGroupKey(event) {
  return isDateUndecided(event) || !event.event_date ? "undecided" : event.event_date;
}

function compareEventGroupKeys(a, b) {
  if (a === b) return 0;
  if (a === "undecided") return 1;
  if (b === "undecided") return -1;
  return a.localeCompare(b);
}

function compareEvents(a, b) {
  const dateA = isDateUndecided(a) ? "9999-12-31" : a.event_date || "9999-12-31";
  const dateB = isDateUndecided(b) ? "9999-12-31" : b.event_date || "9999-12-31";
  return (
    dateA.localeCompare(dateB) ||
    (a.start_time || "").localeCompare(b.start_time || "") ||
    (a.title || "").localeCompare(b.title || "", "zh-Hant")
  );
}

function remainingSeats(event) {
  return Number(event.seats_total) - approvedPlayers(event);
}

function approvedPlayers(event) {
  if (event.approved_players_count !== undefined && event.approved_players_count !== null) {
    const publicCount = Number(event.approved_players_count);
    if (Number.isFinite(publicCount)) return publicCount;
  }

  const approved = appState.applications
    .filter((request) => request.event_id === event.id && request.status === "approved")
    .reduce((sum, request) => sum + Number(request.players_count || 1), 0);
  return approved;
}

function updateDetailSeats(event) {
  $("#detailSeats").textContent = `總名額 ${event.seats_total} 人，已核准 ${approvedPlayers(event)} 人，尚可申請 ${Math.max(
    0,
    remainingSeats(event)
  )} 人`;
}

function selectedAvailabilityPlayers(players) {
  const selectedIds = appState.availability.selectedPlayerIds;
  if (!selectedIds.length) return players;
  return players.filter((player) => selectedIds.includes(player.id));
}

function isAvailabilityPlayerSelected(playerId, players) {
  const selectedIds = appState.availability.selectedPlayerIds;
  return !selectedIds.length || selectedIds.includes(playerId) || selectedIds.length === players.length;
}

function buildAvailabilitySummary(players, selectedPlayers, poll) {
  const selectedTotal = selectedPlayers.length;
  const submittedSelected = selectedPlayers.filter((player) => player.submitted_at);
  const submittedCounts = countAvailabilitySlots(submittedSelected, submittedSelected.length);
  const selectedCounts = countAvailabilitySlots(selectedPlayers, selectedTotal);

  const common = Object.values(submittedCounts)
    .filter((entry) => submittedSelected.length > 0 && entry.count === submittedSelected.length)
    .sort(sortAvailabilityEntries)
    .slice(0, 12);

  const majority = Object.values(selectedCounts)
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || sortAvailabilityEntries(a, b))
    .slice(0, 12);

  const calendarDays = datesBetween(poll.date_start, poll.date_end).map((dateKey) => {
    const counts = {};
    const missing = {};
    TIME_SLOTS.forEach((slot) => {
      const count = selectedCounts[selectionKey(dateKey, slot.key)]?.count ?? 0;
      counts[slot.key] = count;
      missing[slot.key] = Math.max(0, selectedTotal - count);
    });
    return { date: dateKey, counts, missing };
  });

  return { common, majority, calendarDays, players };
}

function countAvailabilitySlots(players, total) {
  const counts = {};
  players.forEach((player) => {
    const seen = new Set();
    (player.slots ?? []).forEach((slot) => {
      const key = selectionKey(slot.slot_date, slot.slot);
      if (seen.has(key)) return;
      seen.add(key);
      counts[key] ??= {
        key,
        slot_date: slot.slot_date,
        slot: slot.slot,
        count: 0,
        total,
        isPerfect: false
      };
      counts[key].count += 1;
    });
  });
  Object.values(counts).forEach((entry) => {
    entry.isPerfect = total > 0 && entry.count === total;
  });
  return counts;
}

function sortAvailabilityEntries(a, b) {
  return a.slot_date.localeCompare(b.slot_date) || slotOrder(a.slot) - slotOrder(b.slot);
}

function slotOrder(slot) {
  return TIME_SLOTS.findIndex((item) => item.key === slot);
}

function slotLabel(slot) {
  return TIME_SLOTS.find((item) => item.key === slot)?.label ?? slot;
}

function selectionKey(dateKey, slot) {
  return `${dateKey}|${slot}`;
}

function slotsToSelection(slots) {
  return new Set((slots ?? []).map((slot) => selectionKey(slot.slot_date, slot.slot)));
}

function isAvailabilityLinkInvalid(error) {
  return (error?.message || "").toLowerCase().includes("availability_link_invalid");
}

function datesBetween(startDate, endDate) {
  const dates = [];
  let cursor = parseDate(startDate);
  const end = parseDate(endDate);
  while (cursor <= end) {
    dates.push(toDateInput(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function formatDateRange(startDate, endDate) {
  if (startDate === endDate) return formatDateWithWeekday(parseDate(startDate));
  return `${formatDateWithWeekday(parseDate(startDate))} - ${formatDateWithWeekday(parseDate(endDate))}`;
}

function formatEventContext(event) {
  return eventDateTimeLabel(event);
}

function eventDateLabel(event) {
  return isDateUndecided(event) || !event?.event_date ? "日期未定" : formatDateWithWeekday(parseDate(event.event_date));
}

function eventDateTimeLabel(event) {
  return `${eventDateLabel(event)} ${formatTimeRange(event)}`;
}

function eventAgendaMeta(event) {
  return [formatTimeRange(event), event.location_name, event.system_name].filter(Boolean).join(" · ");
}

function eventLabelMarkup(event) {
  const labels = [];
  if (isDateUndecided(event)) labels.push('<span class="event-label undecided">日期未定</span>');
  if (isHiddenEvent(event)) labels.push('<span class="event-label hidden-event">本團隱藏</span>');
  if (isRegistrationClosed(event)) labels.push('<span class="event-label registration-closed">關閉報名</span>');
  return labels.length ? `<span class="event-labels">${labels.join("")}</span>` : "";
}

function availabilityPersonalLink(token) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(AVAILABILITY_QUERY_PARAM, token);
  return url.toString();
}

function readAvailabilityToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get(AVAILABILITY_QUERY_PARAM) || params.get("poll_token") || "";
}

function eventById(id) {
  return appState.events.find((event) => event.id === id);
}

function canManageEvent(event) {
  return canManageEventFor(event, appState.role, appState.session?.user?.id ?? null);
}

function manageableEvents(events = appState.events, role = appState.role, sessionUserId = appState.session?.user?.id ?? null) {
  return events.filter((event) => canManageEventFor(event, role, sessionUserId));
}

function canManageEventFor(event, role, sessionUserId) {
  if (!event) return false;
  if (role === "admin") return true;
  if (role !== "gm") return false;
  return event.owner_user_id && event.owner_user_id === sessionUserId;
}

function eventForRequest(request) {
  return eventById(request?.event_id) ?? request?.events ?? null;
}

function canManageRequest(request) {
  return canManageEventFor(eventForRequest(request), appState.role, appState.session?.user?.id ?? null);
}

function manageableRequests() {
  return appState.applications.filter((request) => canManageRequest(request));
}

function syncSelectedEventAfterDataLoad() {
  if (!appState.selectedEvent?.id) return null;

  const freshEvent = eventById(appState.selectedEvent.id);
  if (freshEvent) {
    appState.selectedEvent = freshEvent;
    return freshEvent;
  }

  clearSelectedEvent();
  return null;
}

function clearSelectedEvent() {
  appState.selectedEvent = null;
  appState.availability.eventId = null;
  appState.availability.data = null;
  appState.availability.selectedPlayerIds = [];
  appState.availability.isLoading = false;
  appState.availability.isCreating = false;
  appState.availability.isClearing = false;
  appState.availability.error = "";
  appState.availability.actionError = "";
  appState.availability.actionMessage = "";
  if (els.detailDialog?.open) els.detailDialog.close();
}

function ownerDisplayName(event) {
  if (!event?.owner_user_id) return "未設定";
  return appState.ownerNames[event.owner_user_id] ?? "未知帳號";
}

function shouldShowOwnerInfo() {
  return true;
}

function renderAvailabilityCalendarViews() {
  renderMiniCalendar();
  renderCalendarSurface();
}

function withAvailabilitySummary(data) {
  if (!data) return data;
  const players = data.players ?? [];
  const summary = data.poll ? buildAvailabilitySummary(players, players, data.poll) : null;
  return { ...data, summary };
}

function resetAvailabilityDashboardOptions() {
  appState.availabilityDashboard.events = [];
  appState.availabilityDashboard.loadedGm = "";
  appState.availabilityDashboard.eventsByGmId = {};
  renderAvailabilityEventFilter();
}

function renderAvailabilityEventFilter() {
  if (!els.availabilityEventFilter) return;
  const role = appState.role;
  const gmUnselected = role === "admin" && !appState.filters.gm;
  els.availabilityEventFilter.disabled = gmUnselected;
  if (gmUnselected) {
    els.availabilityEventFilter.innerHTML = '<option value="">請先選擇GM</option>';
    return;
  }
  if (!appState.availabilityDashboard.events.length) {
    els.availabilityEventFilter.innerHTML = '<option value="">請選擇團務</option>';
    return;
  }
  const options = ['<option value="">請選擇團務</option>'];
  appState.availabilityDashboard.events.forEach((event) => {
    options.push(`<option value="${escapeAttr(event.id)}">${escapeHtml(event.title || "未命名團務")}</option>`);
  });
  els.availabilityEventFilter.innerHTML = options.join("");
  els.availabilityEventFilter.value = appState.filters.availabilityEventId;
}

async function ensureAvailabilityOptionsLoaded() {
  if (!supabase || !els.availabilityEventFilter || els.availabilityEventFilter.disabled) return;
  const role = appState.role;
  const gmId = role === "admin" ? appState.filters.gm : appState.session?.user?.id;
  if (!gmId) return;
  if (appState.availabilityDashboard.eventsByGmId[gmId]) {
    appState.availabilityDashboard.events = appState.availabilityDashboard.eventsByGmId[gmId];
    appState.availabilityDashboard.loadedGm = gmId;
    renderAvailabilityEventFilter();
    return;
  }
  const ownerUserIds = [gmId].filter(Boolean);
  if (!ownerUserIds.length) return;
  const { data } = await supabase.from("availability_polls").select("event_id").in("owner_user_id", ownerUserIds);
  const pollEventIds = new Set((data ?? []).map((item) => item.event_id));
  appState.availabilityDashboard.events = manageableEvents().filter((event) => pollEventIds.has(event.id));
  appState.availabilityDashboard.loadedGm = gmId;
  appState.availabilityDashboard.eventsByGmId[gmId] = appState.availabilityDashboard.events;
  renderAvailabilityEventFilter();
}

async function handleAvailabilityEventFilterOpen() {
  await ensureAvailabilityOptionsLoaded();
  if (!appState.filters.availabilityEventId) return;
  await loadSelectedAvailabilityForCalendar();
  renderAvailabilityCalendarViews();
}

async function refreshAvailabilityCalendarFromFilter() {
  appState.availability.data = null;
  renderAvailabilityCalendarViews();
  await loadSelectedAvailabilityForCalendar();
  renderAvailabilityCalendarViews();
}

async function loadSelectedAvailabilityForCalendar() {
  appState.availability.data = null;
  if (!appState.filters.availabilityEventId || !supabase) return;
  const { data, error } = await supabase.rpc("get_availability_poll", { target_event_id: appState.filters.availabilityEventId });
  if (error) {
    showStatus(toReadableError(error, "讀取約時間日曆"));
    return;
  }
  appState.availability.data = withAvailabilitySummary(data);
}

function isAvailabilityCalendarMode() {
  return Boolean(appState.filters.availabilityEventId && appState.availability.data?.poll);
}

function availabilityDayStatus(dateKey) {
  const days = appState.availability.data?.summary?.calendarDays ?? [];
  const day = days.find((item) => item.date === dateKey);
  if (!day) return null;
  const counts = TIME_SLOTS.map((slot) => day.counts[slot.key] ?? 0);
  const best = Math.max(...counts);
  if (best <= 0) return null;
  const total = appState.availability.data?.players?.length ?? 0;
  const miss = Math.max(0, total - best);
  const countText = `可跑團人數：${best}/${total}`;
  if (miss === 0) {
    const slotText = formatBestSlotText(day, best);
    return {
      level: "green",
      popoverText: "可開團時段：" + slotText,
      countText,
      slotText: `最佳時段：${slotText}`,
      detailText: "誰不能跑：無"
    };
  }
  const label = miss === 1 ? "yellow" : "red";
  const slotText = formatBestSlotText(day, best);
  return {
    level: label,
    popoverText: `缺 ${miss} 人（最佳時段：${slotText}）`,
    countText,
    slotText: `最佳時段：${slotText}`,
    detailText: buildMissingPlayersText(dateKey, best)
  };
}

function slotLabelsForCount(day, count) {
  return TIME_SLOTS.filter((slot) => (day.counts[slot.key] ?? 0) === count).map((slot) => slot.label).join("、");
}

function formatBestSlotText(day, count) {
  const labels = TIME_SLOTS.filter((slot) => (day.counts[slot.key] ?? 0) === count).map((slot) => slot.label);
  if (labels.length === TIME_SLOTS.length) return "整天";
  return labels.join("、");
}

function buildMissingPlayersText(dateKey, bestCount) {
  const pollData = appState.availability.data;
  if (!pollData?.players?.length) return "尚無玩家資料";
  const day = pollData.summary?.calendarDays?.find((item) => item.date === dateKey);
  const bestSlots = TIME_SLOTS.filter((slot) => (day?.counts?.[slot.key] ?? 0) === bestCount);
  if (bestSlots.length === TIME_SLOTS.length) {
    const missingNames = new Set();
    pollData.players.forEach((player) => {
      const selectedKeys = new Set((player.slots ?? []).map((item) => selectionKey(item.slot_date, item.slot)));
      const isAvailableAllDay = TIME_SLOTS.every((slot) => selectedKeys.has(selectionKey(dateKey, slot.key)));
      if (!isAvailableAllDay) missingNames.add(player.display_name || "未命名玩家");
    });
    return missingNames.size ? `誰不能跑：${Array.from(missingNames).join("、")}` : "誰不能跑：無";
  }
  const rows = bestSlots.map((slot) => {
    const missingNames = pollData.players
      .filter((player) => {
        const selectedKeys = new Set((player.slots ?? []).map((item) => selectionKey(item.slot_date, item.slot)));
        return !selectedKeys.has(selectionKey(dateKey, slot.key));
      })
      .map((player) => player.display_name || "未命名玩家");

    return `${slot.label}：${missingNames.length ? missingNames.join("、") : "無"}`;
  });
  return rows.length ? `誰不能跑：${rows.join("；")}` : "誰不能跑：尚無資料";
}

function formatRequestTime(isoString) {
  if (!isoString) return "未提供";
  const value = new Date(isoString);
  if (Number.isNaN(value.getTime())) return "未提供";
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const min = String(value.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function seatPill(event) {
  const remaining = remainingSeats(event);
  const className = remaining > 0 ? "open" : "full";
  const text = remaining > 0 ? `餘 ${remaining}` : "額滿";
  return `<span class="pill ${className}">${text}</span>`;
}

function statusText(status) {
  return {
    pending: "待處理",
    approved: "已核准",
    declined: "已婉拒"
  }[status] ?? status;
}

function showStatus(message) {
  els.statusStrip.textContent = message;
  els.statusStrip.hidden = false;
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => {
    els.statusStrip.hidden = true;
  }, 6000);
}

function readLocal(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

function startOfWeek(date) {
  return addDays(startOfDay(date), -date.getDay());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateWithWeekday(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "日期未定";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatTime(value) {
  return value ? value.slice(0, 5) : "";
}

function formatTimeRange(event) {
  const range = [formatTime(event.start_time), formatTime(event.end_time)].filter(Boolean).join(" - ");
  return range || "時間未定";
}

function safeHttpUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char];
  });
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function seedIcons() {
  window.lucide?.createIcons();
}
