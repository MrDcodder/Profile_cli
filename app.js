const USERNAME = "MrDcodder";
const REFRESH_INTERVAL = 5 * 60 * 1000;
const IP_REFRESH_INTERVAL = 15 * 60 * 1000;
const CACHE_KEY = "mrdcodder-profile-v1";
const PREFERRED_REPOSITORIES = [
  "Mini_Social_Media_App_URITOMO",
  "E-Commerce_Full_stack",
  "E-commerce_Site",
  "BridgeAura_Inernship_Project",
];
const FALLBACK_PROFILE = {
  name: "Diwyesh Nerkar",
  login: USERNAME,
  bio: "Full-stack developer and Computer Engineering student at AIEM. I build web apps end to end: interfaces, APIs, auth, and databases.",
  location: "AIEM",
  html_url: `https://github.com/${USERNAME}`,
  avatar_url: "",
  public_repos: null,
  followers: null,
};
const FALLBACK_REPOSITORIES = [
  {
    name: "Mini_Social_Media_App_URITOMO",
    description: "Full-stack social app with profiles, posts, messaging, search, and notifications.",
    language: "TypeScript",
    html_url: `https://github.com/${USERNAME}/Mini_Social_Media_App_URITOMO`,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["Express", "SQLite", "JWT", "Tailwind"],
  },
  {
    name: "E-Commerce_Full_stack",
    description: "Full-stack store with product listings, a cart, authentication, and order management.",
    language: "TypeScript",
    html_url: `https://github.com/${USERNAME}/E-Commerce_Full_stack`,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["TypeScript", "Express", "SQLite"],
  },
  {
    name: "E-commerce_Site",
    description: "Electronics storefront project with a product-browsing experience and backend.",
    language: "JavaScript",
    html_url: `https://github.com/${USERNAME}/E-commerce_Site`,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["HTML", "CSS", "JavaScript"],
  },
  {
    name: "BridgeAura_Inernship_Project",
    description: "Internship project at BridgeAura by Fluxatic Global.",
    language: "TypeScript",
    html_url: `https://github.com/${USERNAME}/BridgeAura_Inernship_Project`,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["TypeScript"],
  },
];

const state = {
  profile: FALLBACK_PROFILE,
  repositories: FALLBACK_REPOSITORIES,
  activeProject: null,
  isMinimized: false,
  isMaximized: false,
  lastUpdated: null,
  toastTimeout: null,
  windowTop: null,
};

const elements = {
  aboutLauncher: document.querySelector("#about-launcher"),
  aboutLink: document.querySelector("#about-link"),
  appWindow: document.querySelector("#app-window"),
  avatar: document.querySelector("#avatar"),
  avatarFallback: document.querySelector("#avatar-fallback"),
  cardName: document.querySelector("#card-name"),
  clock: document.querySelector("#clock"),
  closeWindow: document.querySelector("#close-window"),
  connectionState: document.querySelector("#connection-state"),
  desktopHint: document.querySelector("#desktop-hint"),
  dock: document.querySelector("#dock"),
  dockAbout: document.querySelector("#dock-about"),
  dockProjects: document.querySelector("#dock-projects"),
  followerCount: document.querySelector("#follower-count"),
  heroBio: document.querySelector("#hero-bio"),
  heroName: document.querySelector("#hero-name"),
  heroRole: document.querySelector("#hero-role"),
  ipIndicator: document.querySelector("#ip-indicator"),
  lastUpdated: document.querySelector("#last-updated"),
  maximizeWindow: document.querySelector("#maximize-window"),
  minimizeWindow: document.querySelector("#minimize-window"),
  projectShortcut: document.querySelector("#projects-shortcut"),
  repoCount: document.querySelector("#repo-count"),
  syncLabel: document.querySelector("#sync-label"),
  toast: document.querySelector("#toast"),
  visitorIp: document.querySelector("#visitor-ip"),
  windowContent: document.querySelector("#window-content"),
  windowLayer: document.querySelector("#window-layer"),
  windowPath: document.querySelector("#window-path"),
  windowTitle: document.querySelector("#window-title"),
};

function safeNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "—";
}

function formatRelativeDate(dateString) {
  if (!dateString) return "Not available";
  const timestamp = Date.parse(dateString);
  if (!Number.isFinite(timestamp)) return "Not available";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function setSyncStatus(message, status = "loading") {
  elements.syncLabel.textContent = message;
  elements.connectionState.dataset.state = status;
}

function showToast(message) {
  window.clearTimeout(state.toastTimeout);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 5200);
}

function loadCache() {
  try {
    const saved = window.localStorage.getItem(CACHE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (!parsed || !parsed.profile || !Array.isArray(parsed.repositories)) return false;
    state.profile = parsed.profile;
    state.repositories = parsed.repositories;
    state.lastUpdated = parsed.lastUpdated || null;
    renderProfile();
    renderDock();
    if (state.activeProject) renderWindow();
    elements.lastUpdated.textContent = state.lastUpdated
      ? `Last synced ${new Date(state.lastUpdated).toLocaleString()}`
      : "Showing saved profile";
    return true;
  } catch (error) {
    console.warn("Could not read the saved GitHub profile cache.", error);
    return false;
  }
}

function saveCache() {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      profile: state.profile,
      repositories: state.repositories,
      lastUpdated: state.lastUpdated,
    }));
  } catch (error) {
    console.warn("Could not save the GitHub profile cache.", error);
  }
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-cache",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const error = new Error(`GitHub returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function arrangeRepositories(repositories) {
  const available = repositories
    .filter((repository) => !repository.fork && !repository.archived)
    .filter((repository) => repository.name.toLowerCase() !== USERNAME.toLowerCase());
  const byName = new Map(available.map((repository) => [repository.name.toLowerCase(), repository]));
  const preferred = PREFERRED_REPOSITORIES
    .map((name) => byName.get(name.toLowerCase()))
    .filter(Boolean);
  const preferredNames = new Set(PREFERRED_REPOSITORIES.map((name) => name.toLowerCase()));
  const recent = available
    .filter((repository) => !preferredNames.has(repository.name.toLowerCase()))
    .sort((left, right) => Date.parse(right.pushed_at || "") - Date.parse(left.pushed_at || ""));
  return [...preferred, ...recent].slice(0, 8);
}

async function refreshGitHub({ silent = false } = {}) {
  if (!navigator.onLine) {
    setSyncStatus(state.lastUpdated ? "Offline · showing saved profile" : "Offline · showing preview", "offline");
    if (!silent) showToast("You’re offline. Showing the most recently saved profile.");
    return;
  }

  setSyncStatus("Syncing GitHub…", "loading");
  try {
    const [profile, repositories] = await Promise.all([
      fetchGitHubJson(`https://api.github.com/users/${USERNAME}`),
      fetchGitHubJson(`https://api.github.com/users/${USERNAME}/repos?type=owner&sort=pushed&per_page=100`),
    ]);
    if (!Array.isArray(repositories)) throw new Error("GitHub returned an unexpected repository list.");

    state.profile = {
      ...FALLBACK_PROFILE,
      name: profile.name || profile.login || FALLBACK_PROFILE.name,
      login: profile.login || USERNAME,
      bio: profile.bio || FALLBACK_PROFILE.bio,
      location: profile.location || "",
      html_url: profile.html_url || FALLBACK_PROFILE.html_url,
      avatar_url: profile.avatar_url || "",
      public_repos: profile.public_repos,
      followers: profile.followers,
    };
    state.repositories = arrangeRepositories(repositories);
    state.lastUpdated = new Date().toISOString();
    renderProfile();
    renderDock();
    if (state.activeProject) renderWindow();
    saveCache();
    setSyncStatus("GitHub synced", "online");
    elements.lastUpdated.textContent = `Last synced ${new Date(state.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    console.error("Could not refresh the GitHub profile.", error);
    const status = error.status === 403 || error.status === 429
      ? "GitHub rate limit · retrying soon"
      : "GitHub unavailable · showing saved data";
    setSyncStatus(status, "error");
    if (!silent) showToast(`${status}. The page will try again in 5 minutes.`);
    if (!state.lastUpdated) {
      renderProfile();
      renderDock();
    }
  }
}

function renderProfile() {
  const profile = state.profile;
  const displayName = profile.name || FALLBACK_PROFILE.name;
  elements.heroName.textContent = displayName;
  elements.cardName.textContent = displayName;
  elements.heroRole.textContent = "Full-Stack Developer · Computer Engineering Student";
  elements.heroBio.textContent = profile.bio || FALLBACK_PROFILE.bio;
  elements.repoCount.textContent = safeNumber(profile.public_repos);
  elements.followerCount.textContent = safeNumber(profile.followers);

  if (profile.avatar_url) {
    elements.avatar.src = profile.avatar_url;
    elements.avatar.hidden = false;
    elements.avatarFallback.hidden = true;
    elements.avatar.onerror = () => {
      elements.avatar.hidden = true;
      elements.avatarFallback.hidden = false;
    };
  } else {
    elements.avatar.hidden = true;
    elements.avatarFallback.hidden = false;
  }
}

function projectGlyph(name) {
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase() || "PR";
}

function renderDock() {
  elements.dockProjects.replaceChildren();
  if (state.repositories.length === 0) {
    const empty = document.createElement("span");
    empty.className = "dock-empty";
    empty.textContent = "No public projects found";
    elements.dockProjects.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.repositories.forEach((repository) => {
    const button = document.createElement("button");
    button.className = "dock-item dock-project";
    button.type = "button";
    button.dataset.project = repository.name;
    button.setAttribute("aria-label", `Open ${repository.name}`);
    button.title = repository.name;

    const icon = document.createElement("span");
    icon.className = "dock-item__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = projectGlyph(repository.name);
    const label = document.createElement("span");
    label.className = "dock-item__label";
    label.textContent = repository.name.replaceAll("_", " ");
    const indicator = document.createElement("span");
    indicator.className = "dock-item__indicator";
    indicator.setAttribute("aria-hidden", "true");
    button.append(icon, label, indicator);
    button.addEventListener("click", () => openProject(repository.name));
    fragment.append(button);
  });
  elements.dockProjects.append(fragment);
  updateDockSelection();
}

function createMeta(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "meta-item";
  const term = document.createElement("span");
  term.textContent = label;
  const description = document.createElement("strong");
  description.textContent = value || "Not available";
  wrapper.append(term, description);
  return wrapper;
}

function createProjectContent(repository) {
  const section = document.createElement("section");
  const kicker = document.createElement("p");
  kicker.className = "project-kicker";
  kicker.textContent = `~/projects/${repository.name}`;

  const heading = document.createElement("div");
  heading.className = "project-heading";
  const glyph = document.createElement("span");
  glyph.className = "project-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = projectGlyph(repository.name);
  const headingCopy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = repository.name.replaceAll("_", " ");
  const subtitle = document.createElement("p");
  subtitle.textContent = repository.language || "Open-source project";
  headingCopy.append(title, subtitle);
  heading.append(glyph, headingCopy);

  const description = document.createElement("p");
  description.className = "project-description";
  description.textContent = repository.description || "No description has been added to this repository yet.";

  const metadata = document.createElement("div");
  metadata.className = "project-meta";
  metadata.append(
    createMeta("Primary language", repository.language || "Not specified"),
    createMeta("Last activity", formatRelativeDate(repository.pushed_at)),
    createMeta("Stars", safeNumber(repository.stargazers_count)),
  );

  const topics = Array.isArray(repository.topics) ? repository.topics.slice(0, 8) : [];
  if (repository.language && !topics.some((topic) => topic.toLowerCase() === repository.language.toLowerCase())) {
    topics.unshift(repository.language);
  }
  if (topics.length > 0) {
    const tags = document.createElement("div");
    tags.className = "project-tags";
    topics.forEach((topic) => {
      const tag = document.createElement("span");
      tag.className = "project-tag";
      tag.textContent = topic;
      tags.append(tag);
    });
    section.append(kicker, heading, description, metadata, tags);
  } else {
    section.append(kicker, heading, description, metadata);
  }

  const actions = document.createElement("div");
  actions.className = "project-actions";
  const repositoryLink = document.createElement("a");
  repositoryLink.className = "project-action";
  repositoryLink.href = repository.html_url;
  repositoryLink.target = "_blank";
  repositoryLink.rel = "noreferrer";
  repositoryLink.textContent = "View repository";
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  repositoryLink.append(arrow);
  actions.append(repositoryLink);

  if (repository.homepage) {
    const liveLink = document.createElement("a");
    liveLink.className = "project-action project-action--secondary";
    liveLink.href = repository.homepage;
    liveLink.target = "_blank";
    liveLink.rel = "noreferrer";
    liveLink.textContent = "Open live project ↗";
    actions.append(liveLink);
  }
  section.append(actions);
  return section;
}

function createProfileContent() {
  const section = document.createElement("section");
  const kicker = document.createElement("p");
  kicker.className = "project-kicker";
  kicker.textContent = "~/home/about.txt";

  const heading = document.createElement("div");
  heading.className = "project-heading";
  const glyph = document.createElement("span");
  glyph.className = "project-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = "DN";
  const headingCopy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = state.profile.name || FALLBACK_PROFILE.name;
  const subtitle = document.createElement("p");
  subtitle.textContent = "Full-Stack Developer · Computer Engineering Student";
  headingCopy.append(title, subtitle);
  heading.append(glyph, headingCopy);

  const aboutTitle = document.createElement("h4");
  aboutTitle.className = "profile-section-title";
  aboutTitle.textContent = "$ cat about.txt";
  const about = document.createElement("p");
  about.className = "profile-about";
  about.textContent = state.profile.bio || FALLBACK_PROFILE.bio;

  const data = document.createElement("div");
  data.className = "profile-data";
  data.append(
    createMeta("Education", "Computer Engineering · AIEM"),
    createMeta("Public projects", safeNumber(state.profile.public_repos)),
    createMeta("Followers", safeNumber(state.profile.followers)),
    createMeta("Currently", "Building web apps end to end"),
  );

  const tags = document.createElement("div");
  tags.className = "project-tags";
  ["TypeScript", "HTML", "CSS", "Express", "SQLite", "Tailwind", "JWT"].forEach((technology) => {
    const tag = document.createElement("span");
    tag.className = "project-tag";
    tag.textContent = technology;
    tags.append(tag);
  });

  const actions = document.createElement("div");
  actions.className = "project-actions";
  const githubLink = document.createElement("a");
  githubLink.className = "project-action";
  githubLink.href = state.profile.html_url || FALLBACK_PROFILE.html_url;
  githubLink.target = "_blank";
  githubLink.rel = "noreferrer";
  githubLink.textContent = "Open GitHub profile ↗";
  actions.append(githubLink);
  section.append(kicker, heading, aboutTitle, about, data, tags, actions);
  return section;
}

function renderWindow() {
  if (state.activeProject === "profile") {
    elements.windowTitle.textContent = "About — Diwyesh Nerkar";
    elements.windowPath.textContent = "~/home/about.txt";
    elements.windowContent.replaceChildren(createProfileContent());
    return;
  }
  const repository = state.repositories.find((item) => item.name === state.activeProject);
  if (!repository) {
    closeAppWindow();
    return;
  }
  elements.windowTitle.textContent = repository.name.replaceAll("_", " ");
  elements.windowPath.textContent = `~/projects/${repository.name}`;
  elements.windowContent.replaceChildren(createProjectContent(repository));
}

function setWindowOpen(isOpen) {
  elements.windowLayer.hidden = !isOpen;
  elements.windowLayer.classList.toggle("is-open", isOpen);
  elements.desktopHint.classList.toggle("is-hidden", isOpen);
  if (isOpen) window.requestAnimationFrame(() => elements.windowContent.focus({ preventScroll: true }));
}

function updateDockSelection() {
  elements.dockAbout.classList.toggle("is-active", state.activeProject === "profile" && !state.isMinimized);
  elements.dockProjects.querySelectorAll(".dock-project").forEach((button) => {
    const active = button.dataset.project === state.activeProject && !state.isMinimized;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function openProject(name) {
  state.activeProject = name;
  state.isMinimized = false;
  elements.windowLayer.classList.remove("is-minimized");
  elements.windowLayer.classList.remove("is-maximized");
  state.isMaximized = false;
  elements.maximizeWindow.setAttribute("aria-label", "Maximize window");
  renderWindow();
  setWindowOpen(true);
  updateDockSelection();
}

function toggleProfileWindow() {
  if (state.activeProject === "profile" && !state.isMinimized) {
    minimizeAppWindow();
    return;
  }
  openProject("profile");
}

function closeAppWindow() {
  state.activeProject = null;
  state.isMinimized = false;
  state.isMaximized = false;
  elements.maximizeWindow.setAttribute("aria-label", "Maximize window");
  elements.windowLayer.classList.remove("is-open", "is-minimized", "is-maximized");
  setWindowOpen(false);
  updateDockSelection();
}

function minimizeAppWindow() {
  if (!state.activeProject) return;
  state.isMinimized = true;
  elements.windowLayer.classList.add("is-minimized");
  updateDockSelection();
}

function toggleMaximize() {
  if (!state.activeProject || state.isMinimized) return;
  state.isMaximized = !state.isMaximized;
  elements.windowLayer.classList.toggle("is-maximized", state.isMaximized);
  elements.maximizeWindow.setAttribute("aria-label", state.isMaximized ? "Restore window" : "Maximize window");
}

function updateClock() {
  elements.clock.textContent = new Intl.DateTimeFormat([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

async function refreshVisitorIp({ silent = false } = {}) {
  if (!navigator.onLine) {
    elements.visitorIp.textContent = "IP unavailable";
    elements.ipIndicator.title = "IP lookup is unavailable while offline.";
    return;
  }
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`IP lookup returned ${response.status}`);
    const result = await response.json();
    if (typeof result.ip !== "string" || result.ip.length > 45) throw new Error("IP lookup returned an invalid address.");
    elements.visitorIp.textContent = result.ip;
    elements.ipIndicator.title = `Your public IP is ${result.ip}. The lookup is handled by ipify.org.`;
  } catch (error) {
    console.warn("Could not look up the visitor IP.", error);
    elements.visitorIp.textContent = "IP unavailable";
    elements.ipIndicator.title = "Could not look up your IP. The lookup is handled by ipify.org.";
    if (!silent) showToast("Could not look up your public IP. Your profile remains available.");
  }
}

function bindEvents() {
  elements.aboutLauncher.addEventListener("click", toggleProfileWindow);
  elements.aboutLink.addEventListener("click", toggleProfileWindow);
  elements.dockAbout.addEventListener("click", toggleProfileWindow);
  elements.projectShortcut.addEventListener("click", () => {
    const first = state.repositories[0];
    if (first) openProject(first.name);
    else showToast("No public projects are available right now.");
  });
  elements.closeWindow.addEventListener("click", closeAppWindow);
  elements.minimizeWindow.addEventListener("click", minimizeAppWindow);
  elements.maximizeWindow.addEventListener("click", toggleMaximize);
  elements.windowLayer.addEventListener("click", (event) => {
    if (event.target === elements.windowLayer) minimizeAppWindow();
  });
  elements.ipIndicator.addEventListener("click", () => {
    showToast("This IP lookup is provided by ipify.org. This page does not store the address.");
  });
  window.addEventListener("online", () => {
    refreshGitHub({ silent: true });
    refreshVisitorIp({ silent: true });
  });
  window.addEventListener("offline", () => {
    setSyncStatus("Offline · showing saved data", "offline");
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.activeProject && !state.isMinimized) {
      minimizeAppWindow();
    }
  });
  bindWindowDragging();
}

function bindWindowDragging() {
  const titlebar = document.querySelector("#window-titlebar");
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let dragging = false;

  titlebar.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".window-controls") || state.isMaximized || window.innerWidth <= 650) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    const rect = elements.appWindow.getBoundingClientRect();
    originX = rect.left + rect.width / 2 - window.innerWidth / 2;
    originY = rect.top + rect.height / 2 - window.innerHeight / 2;
    titlebar.setPointerCapture(event.pointerId);
  });
  titlebar.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    elements.appWindow.style.translate = `${originX + deltaX}px ${originY + deltaY}px`;
  });
  titlebar.addEventListener("pointerup", () => {
    dragging = false;
  });
  titlebar.addEventListener("lostpointercapture", () => {
    dragging = false;
  });
}

function start() {
  bindEvents();
  updateClock();
  window.setInterval(updateClock, 30_000);
  const hasCache = loadCache();
  if (!hasCache) {
    renderProfile();
    renderDock();
  }
  refreshGitHub({ silent: hasCache });
  refreshVisitorIp({ silent: true });
  window.setInterval(() => refreshGitHub({ silent: true }), REFRESH_INTERVAL);
  window.setInterval(() => refreshVisitorIp({ silent: true }), IP_REFRESH_INTERVAL);
}

start();
