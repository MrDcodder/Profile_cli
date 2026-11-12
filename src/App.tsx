import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactElement } from "react";

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
const ROLE = "Full-Stack Developer · Computer Engineering Student";

interface Profile {
  name: string;
  login: string;
  bio: string;
  location: string;
  html_url: string;
  avatar_url: string;
  public_repos: number | null;
  followers: number | null;
}

interface Repository {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
}

interface ProfileCache {
  profile: Profile;
  repositories: Repository[];
  lastUpdated: string | null;
}

type WindowType = "profile" | "project" | "repos" | "terminal";
interface AppWindow {
  id: string;
  type: WindowType;
  name?: string;
  minimized: boolean;
  maximized: boolean;
  x: number;
  y: number;
  zIndex: number;
}
type SyncState = { message: string; status: "loading" | "online" | "offline" | "error" };

const FALLBACK_PROFILE: Profile = {
  name: "Diwyesh Nerkar",
  login: USERNAME,
  bio: "Full-stack developer and Computer Engineering student at AIEM. I build web apps end to end: interfaces, APIs, auth, and databases.",
  location: "AIEM",
  html_url: `https://github.com/${USERNAME}`,
  avatar_url: "",
  public_repos: null,
  followers: null,
};

const FALLBACK_REPOSITORIES: Repository[] = [
  {
    name: "Mini_Social_Media_App_URITOMO",
    description: "Full-stack social app with profiles, posts, messaging, search, and notifications.",
    language: "TypeScript",
    html_url: `https://github.com/${USERNAME}/Mini_Social_Media_App_URITOMO`,
    homepage: null,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["Express", "SQLite", "JWT", "Tailwind"],
    fork: false,
    archived: false,
  },
  {
    name: "E-Commerce_Full_stack",
    description: "Full-stack store with product listings, a cart, authentication, and order management.",
    language: "TypeScript",
    html_url: `https://github.com/${USERNAME}/E-Commerce_Full_stack`,
    homepage: null,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["TypeScript", "Express", "SQLite"],
    fork: false,
    archived: false,
  },
  {
    name: "E-commerce_Site",
    description: "Electronics storefront project with a product-browsing experience and backend.",
    language: "JavaScript",
    html_url: `https://github.com/${USERNAME}/E-commerce_Site`,
    homepage: null,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["HTML", "CSS", "JavaScript"],
    fork: false,
    archived: false,
  },
  {
    name: "BridgeAura_Inernship_Project",
    description: "Internship project at BridgeAura by Fluxatic Global.",
    language: "TypeScript",
    html_url: `https://github.com/${USERNAME}/BridgeAura_Inernship_Project`,
    homepage: null,
    stargazers_count: 0,
    pushed_at: null,
    topics: ["TypeScript"],
    fork: false,
    archived: false,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseProfile(value: unknown): Profile {
  if (!isRecord(value)) throw new Error("GitHub returned an invalid profile.");

  return {
    ...FALLBACK_PROFILE,
    name: readString(value.name, readString(value.login, FALLBACK_PROFILE.name)),
    login: readString(value.login, USERNAME),
    bio: readString(value.bio, FALLBACK_PROFILE.bio) || FALLBACK_PROFILE.bio,
    location: readString(value.location),
    html_url: readString(value.html_url, FALLBACK_PROFILE.html_url),
    avatar_url: readString(value.avatar_url),
    public_repos: readCount(value.public_repos),
    followers: readCount(value.followers),
  };
}

function parseRepository(value: unknown): Repository | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.html_url !== "string") {
    return null;
  }

  return {
    name: value.name,
    description: typeof value.description === "string" ? value.description : null,
    language: typeof value.language === "string" ? value.language : null,
    html_url: value.html_url,
    homepage: typeof value.homepage === "string" && value.homepage ? value.homepage : null,
    stargazers_count: readCount(value.stargazers_count) ?? 0,
    pushed_at: typeof value.pushed_at === "string" ? value.pushed_at : null,
    topics: Array.isArray(value.topics)
      ? value.topics.filter((topic): topic is string => typeof topic === "string")
      : [],
    fork: value.fork === true,
    archived: value.archived === true,
  };
}

function readCache(): ProfileCache | null {
  try {
    const saved = window.localStorage.getItem(CACHE_KEY);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (!isRecord(parsed) || !isRecord(parsed.profile) || !Array.isArray(parsed.repositories)) return null;

    return {
      profile: parseProfile(parsed.profile),
      repositories: parsed.repositories
        .map(parseRepository)
        .filter((repository): repository is Repository => repository !== null),
      lastUpdated: typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : null,
    };
  } catch (error) {
    console.warn("Could not read the saved GitHub profile cache.", error);
    return null;
  }
}

function saveCache(cache: ProfileCache): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("Could not save the GitHub profile cache.", error);
  }
}

class GitHubRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GitHubRequestError";
  }
}

async function fetchGitHubJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-cache",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new GitHubRequestError(`GitHub returned ${response.status}`, response.status);
  return response.json();
}

function arrangeRepositories(repositories: Repository[]): Repository[] {
  const available = repositories;
  const byName = new Map(available.map((repository) => [repository.name.toLowerCase(), repository]));
  const preferred = PREFERRED_REPOSITORIES
    .map((name) => byName.get(name.toLowerCase()))
    .filter((repository): repository is Repository => repository !== undefined);
  const preferredNames = new Set(PREFERRED_REPOSITORIES.map((name) => name.toLowerCase()));
  const recent = available
    .filter((repository) => !preferredNames.has(repository.name.toLowerCase()))
    .sort((left, right) => Date.parse(right.pushed_at || "") - Date.parse(left.pushed_at || ""));
  return [...preferred, ...recent];
}

function formatNumber(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat().format(value);
}

function formatRelativeDate(dateString: string | null): string {
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

function projectGlyph(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "PR";
}

function projectLabel(name: string): string {
  return name.replaceAll("_", " ");
}

function MetaItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}

function ProjectContent({ repository }: { repository: Repository }): ReactElement {
  const topics = [...repository.topics].slice(0, 8);
  if (
    repository.language &&
    !topics.some((topic) => topic.toLowerCase() === repository.language?.toLowerCase())
  ) {
    topics.unshift(repository.language);
  }

  return (
    <section>
      <p className="project-kicker">~/projects/{repository.name}</p>
      <div className="project-heading">
        <span className="project-glyph" aria-hidden="true">{projectGlyph(repository.name)}</span>
        <div>
          <h3>{projectLabel(repository.name)}</h3>
          <p>{repository.language || "Open-source project"}</p>
        </div>
      </div>
      <p className="project-description">
        {repository.description || "No description has been added to this repository yet."}
      </p>
      <div className="project-meta">
        <MetaItem label="Primary language" value={repository.language || "Not specified"} />
        <MetaItem label="Last activity" value={formatRelativeDate(repository.pushed_at)} />
        <MetaItem label="Stars" value={formatNumber(repository.stargazers_count)} />
      </div>
      {topics.length > 0 && (
        <div className="project-tags">
          {topics.map((topic) => <span className="project-tag" key={topic}>{topic}</span>)}
        </div>
      )}
      <div className="project-actions">
        <a className="project-action" href={repository.html_url} target="_blank" rel="noreferrer">
          View repository <span aria-hidden="true">↗</span>
        </a>
        {repository.homepage && (
          <a
            className="project-action project-action--secondary"
            href={repository.homepage}
            target="_blank"
            rel="noreferrer"
          >
            Open live project ↗
          </a>
        )}
      </div>
    </section>
  );
}

function ProfileContent({
  profile,
}: {
  profile: Profile;
}): ReactElement {
  return (
    <section>
      <p className="project-kicker">~/home/about.txt</p>
      <div className="project-heading">
        <span className="project-glyph" aria-hidden="true">DN</span>
        <div>
          <h3>{profile.name || FALLBACK_PROFILE.name}</h3>
          <p>{ROLE}</p>
        </div>
      </div>
      <h4 className="profile-section-title">$ cat about.txt</h4>
      <p className="profile-about">{profile.bio || FALLBACK_PROFILE.bio}</p>
      <div className="profile-data">
        <MetaItem label="Education" value="Computer Engineering · AIEM" />
        <MetaItem label="Public projects" value={formatNumber(profile.public_repos)} />
        <MetaItem label="Followers" value={formatNumber(profile.followers)} />
        <MetaItem label="Currently" value="Building web apps end to end" />
      </div>
      <div className="project-tags">
        {["TypeScript", "HTML", "CSS", "Express", "SQLite", "Tailwind", "JWT"].map((technology) => (
          <span className="project-tag" key={technology}>{technology}</span>
        ))}
      </div>
      <div className="project-actions">
        <a className="project-action" href={profile.html_url} target="_blank" rel="noreferrer">
          Open GitHub profile ↗
        </a>
      </div>
    </section>
  );
}

function RepositoryDrawer({
  repositories,
  onOpenProject,
}: {
  repositories: Repository[];
  onOpenProject: (name: string) => void;
}): ReactElement {
  return (
    <section>
      <p className="project-kicker">~/projects · repository index</p>
      <div className="project-heading">
        <span className="project-glyph" aria-hidden="true">RE</span>
        <div>
          <h3>All repositories</h3>
          <p>{repositories.length} public repositories</p>
        </div>
      </div>
      {repositories.length === 0 ? (
        <p className="empty-state">No public repositories are available right now.</p>
      ) : (
        <div className="repo-grid">
          {repositories.map((repository) => (
            <button
              className="repo-card"
              key={repository.name}
              type="button"
              onClick={() => onOpenProject(repository.name)}
            >
              <span className="repo-card__glyph" aria-hidden="true">{projectGlyph(repository.name)}</span>
              <span className="repo-card__copy">
                <strong>{projectLabel(repository.name)}</strong>
                <span>{repository.description || "No description provided."}</span>
                <span className="repo-card__language">
                  {repository.language || "Open source"}
                  {repository.fork ? " · fork" : ""}
                  {repository.archived ? " · archived" : ""}
                </span>
              </span>
              <span className="repo-card__arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Terminal({
  profile,
  repositories,
  onOpenProject,
}: {
  profile: Profile;
  repositories: Repository[];
  onOpenProject: (name: string) => void;
}): ReactElement {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [output, setOutput] = useState<string[]>([
    "Welcome to MrDcodder OS 1.0",
    "Type /help to see available commands.",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const runCommand = (rawCommand: string) => {
    const command = rawCommand.trim();
    if (!command) return;
    setHistory((previous) => [...previous, command]);
    setHistoryIndex(-1);

    const [verb = "", ...args] = command.split(/\s+/);
    const normalizedVerb = verb.toLowerCase();
    const argument = args.join(" ");
    const normalizedArgument = argument.toLowerCase();
    let response: string[];

    switch (normalizedVerb) {
      case "/help":
      case "help":
        response = [
          "Available commands:",
          "/help, help       Show this command list",
          "clear             Clear the terminal",
          "pwd               Print the current directory",
          "ls                List home directory files",
          "whoami            Show the profile username",
          "date              Show the current date and time",
          "cat about.txt     Read the profile bio",
          "cat skills.txt    List technologies",
          "repos             List public repositories",
          "open <repo>       Open a project window by name",
          "github            Show the GitHub profile URL",
          "ip                Explain the visitor IP lookup",
          "echo <text>       Print text",
          "neofetch          Show profile system information",
        ];
        break;
      case "clear":
        setOutput([]);
        setInput("");
        return;
      case "pwd":
        response = ["~/home"];
        break;
      case "ls":
        response = ["about.txt  skills.txt  projects/  README.md"];
        break;
      case "whoami":
        response = [`${profile.login} — ${profile.name || FALLBACK_PROFILE.name}`];
        break;
      case "date":
        response = [new Date().toString()];
        break;
      case "cat":
        if (normalizedArgument === "about.txt") {
          response = [profile.bio || FALLBACK_PROFILE.bio];
        } else if (normalizedArgument === "skills.txt") {
          response = ["TypeScript · JavaScript · React · Express · SQLite · Tailwind CSS · JWT"];
        } else {
          response = [`cat: ${argument || "(missing file)"}: file not found. Try about.txt or skills.txt.`];
        }
        break;
      case "repos":
        response = repositories.length
          ? repositories.map((repository) => `${repository.name} — ${repository.description || "No description"}`)
          : ["No public repositories are available."];
        break;
      case "open": {
        const repository = repositories.find((item) =>
          item.name.toLowerCase() === normalizedArgument ||
          projectLabel(item.name).toLowerCase() === normalizedArgument
        );
        if (repository) {
          onOpenProject(repository.name);
          response = [`Opening ${projectLabel(repository.name)}…`];
        } else {
          response = [`open: ${argument || "(missing repository)"}: repository not found. Run repos to see names.`];
        }
        break;
      }
      case "github":
        response = [`https://github.com/${profile.login || USERNAME}`];
        break;
      case "ip":
        response = ["The public IP shown in the status bar is fetched from ipify.org and is not stored by this page."];
        break;
      case "echo":
        response = [argument];
        break;
      case "neofetch":
        response = [
          `OS: MrDcodder OS 1.0`,
          `Host: ${profile.name || FALLBACK_PROFILE.name}`,
          `User: ${profile.login || USERNAME}`,
          `Role: ${ROLE}`,
          `Repos: ${repositories.length} public projects`,
          "Stack: React · TypeScript · Express · SQLite",
        ];
        break;
      default:
        response = [`${verb}: command not found. Type /help for available commands.`];
    }

    setOutput((previous) => [...previous, `diwyesh@profile:~/home$ ${command}`, ...response]);
    setInput("");
  };

  return (
    <div
      className="terminal"
      onClick={(event) => {
        if (event.target !== inputRef.current) inputRef.current?.focus();
      }}
    >
      <div className="terminal__cwd" aria-label="Current directory">~/home</div>
      <div className="terminal__output" ref={outputRef} aria-live="polite">
        {output.map((line, index) => (
          <div className={line.startsWith("diwyesh@profile:") ? "terminal__command" : ""} key={`${index}-${line}`}>
            {line || "\u00a0"}
          </div>
        ))}
      </div>
      <form
        className="terminal__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          runCommand(input);
        }}
      >
        <label htmlFor="terminal-input">diwyesh@profile:~/home$</label>
        <input
          id="terminal-input"
          ref={inputRef}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={input}
          aria-label="Terminal command"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              const next = Math.min(history.length - 1, historyIndex + 1);
              setHistoryIndex(next);
              setInput(history[history.length - 1 - next] || "");
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              const next = Math.max(-1, historyIndex - 1);
              setHistoryIndex(next);
              setInput(next < 0 ? "" : history[history.length - 1 - next] || "");
            }
          }}
        />
      </form>
    </div>
  );
}

function App(): ReactElement {
  const [initialCache] = useState(readCache);
  const [profile, setProfile] = useState(initialCache?.profile ?? FALLBACK_PROFILE);
  const [repositories, setRepositories] = useState(initialCache?.repositories ?? FALLBACK_REPOSITORIES);
  const [windows, setWindows] = useState<AppWindow[]>([]);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({ message: "Connecting to GitHub…", status: "loading" });
  const [visitorIp, setVisitorIp] = useState("Finding IP…");
  const [ipTitle, setIpTitle] = useState("Your public IP address");
  const [clock, setClock] = useState("");
  const [toast, setToast] = useState("");
  const dragRef = useRef<{
    windowId: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const nextZIndexRef = useRef(1);
  const toastTimerRef = useRef<number | null>(null);
  const lastUpdatedRef = useRef(initialCache?.lastUpdated ?? null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 5200);
  }, []);

  const refreshGitHub = useCallback(async (silent = false) => {
    if (!navigator.onLine) {
      setSync({
        message: lastUpdatedRef.current ? "Offline · showing saved profile" : "Offline · showing preview",
        status: "offline",
      });
      if (!silent) showToast("You’re offline. Showing the most recently saved profile.");
      return;
    }

    setSync({ message: "Syncing GitHub…", status: "loading" });
    try {
      const [profileResult, repositoryResult] = await Promise.all([
        fetchGitHubJson(`https://api.github.com/users/${USERNAME}`),
        fetchGitHubJson(`https://api.github.com/users/${USERNAME}/repos?type=owner&sort=pushed&per_page=100`),
      ]);
      if (!Array.isArray(repositoryResult)) {
        throw new Error("GitHub returned an unexpected repository list.");
      }

      const nextProfile = parseProfile(profileResult);
      const nextRepositories = arrangeRepositories(
        repositoryResult
          .map(parseRepository)
          .filter((repository): repository is Repository => repository !== null),
      );
      const nextLastUpdated = new Date().toISOString();
      const nextCache = {
        profile: nextProfile,
        repositories: nextRepositories,
        lastUpdated: nextLastUpdated,
      };

      setProfile(nextProfile);
      setRepositories(nextRepositories);
      lastUpdatedRef.current = nextLastUpdated;
      saveCache(nextCache);
      setSync({ message: "GitHub synced", status: "online" });
    } catch (error) {
      console.error("Could not refresh the GitHub profile.", error);
      const rateLimited =
        error instanceof GitHubRequestError && (error.status === 403 || error.status === 429);
      const message = rateLimited
        ? "GitHub rate limit · retrying soon"
        : "GitHub unavailable · showing saved data";
      setSync({ message, status: "error" });
      if (!silent) showToast(`${message}. The page will try again in 5 minutes.`);
    }
  }, [showToast]);

  const refreshVisitorIp = useCallback(async (silent = false) => {
    if (!navigator.onLine) {
      setVisitorIp("IP unavailable");
      setIpTitle("IP lookup is unavailable while offline.");
      return;
    }

    try {
      const response = await fetch("https://api.ipify.org?format=json", {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`IP lookup returned ${response.status}`);
      const result: unknown = await response.json();
      if (!isRecord(result) || typeof result.ip !== "string" || result.ip.length > 45) {
        throw new Error("IP lookup returned an invalid address.");
      }
      setVisitorIp(result.ip);
      setIpTitle(`Your public IP is ${result.ip}. The lookup is handled by ipify.org.`);
    } catch (error) {
      console.warn("Could not look up the visitor IP.", error);
      setVisitorIp("IP unavailable");
      setIpTitle("Could not look up your IP. The lookup is handled by ipify.org.");
      if (!silent) showToast("Could not look up your public IP. Your profile remains available.");
    }
  }, [showToast]);

  useEffect(() => {
    const updateClock = () => {
      setClock(new Intl.DateTimeFormat([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()));
    };
    updateClock();
    const clockInterval = window.setInterval(updateClock, 30_000);
    const githubInterval = window.setInterval(() => void refreshGitHub(true), REFRESH_INTERVAL);
    const ipInterval = window.setInterval(() => void refreshVisitorIp(true), IP_REFRESH_INTERVAL);
    const handleOnline = () => {
      void refreshGitHub(true);
      void refreshVisitorIp(true);
    };
    const handleOffline = () => setSync({ message: "Offline · showing saved data", status: "offline" });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void refreshGitHub(Boolean(initialCache));
    void refreshVisitorIp(true);

    return () => {
      window.clearInterval(clockInterval);
      window.clearInterval(githubInterval);
      window.clearInterval(ipInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, [initialCache, refreshGitHub, refreshVisitorIp]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !focusedWindowId) return;
      const focused = windows.find((item) => item.id === focusedWindowId);
      if (focused && !focused.minimized) minimizeWindow(focused.id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedWindowId, windows]);

  const openAppWindow = (type: WindowType, name?: string) => {
    const id = type === "project" ? `project:${name}` : type;
    const zIndex = nextZIndexRef.current++;
    setWindows((previous) => {
      const existing = previous.find((item) => item.id === id);
      if (existing) {
        return previous.map((item) => item.id === id
          ? { ...item, minimized: false, maximized: false, zIndex }
          : item);
      }
      const offsetIndex = previous.length % 6;
      return [...previous, {
        id,
        type,
        name,
        minimized: false,
        maximized: false,
        x: offsetIndex * 15,
        y: offsetIndex * 14,
        zIndex,
      }];
    });
    setFocusedWindowId(id);
  };

  const focusWindow = (id: string) => {
    const zIndex = nextZIndexRef.current++;
    setFocusedWindowId(id);
    setWindows((previous) => previous.map((item) =>
      item.id === id ? { ...item, zIndex } : item
    ));
  };

  const updateWindow = (id: string, changes: Partial<AppWindow>) => {
    setWindows((previous) => previous.map((item) =>
      item.id === id ? { ...item, ...changes } : item
    ));
  };

  const closeWindow = (id: string) => {
    setWindows((previous) => previous.filter((item) => item.id !== id));
    if (focusedWindowId === id) {
      const next = windows
        .filter((item) => item.id !== id && !item.minimized)
        .sort((left, right) => right.zIndex - left.zIndex)[0];
      setFocusedWindowId(next?.id ?? null);
    }
  };

  const minimizeWindow = (id: string) => {
    updateWindow(id, { minimized: true });
    if (focusedWindowId === id) {
      const next = windows
        .filter((item) => item.id !== id && !item.minimized)
        .sort((left, right) => right.zIndex - left.zIndex)[0];
      setFocusedWindowId(next?.id ?? null);
    }
  };

  const restoreWindow = (id: string) => {
    const zIndex = nextZIndexRef.current++;
    updateWindow(id, { minimized: false, zIndex });
    setFocusedWindowId(id);
  };

  const handleWindowPointerDown = (id: string, event: PointerEvent<HTMLElement>) => {
    focusWindow(id);
    const active = windows.find((item) => item.id === id);
    if (
      !active ||
      active.maximized ||
      window.innerWidth <= 650 ||
      (event.target instanceof Element && event.target.closest(".window-controls"))
    ) return;
    dragRef.current = {
      windowId: id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: active.x,
      originY: active.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWindowPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = drag.originX + event.clientX - drag.startX;
    const y = drag.originY + event.clientY - drag.startY;
    updateWindow(drag.windowId, { x, y });
  };

  const openProfile = () => openAppWindow("profile");
  const openRepositoryDrawer = () => openAppWindow("repos");
  const openTerminal = () => openAppWindow("terminal");
  const openProject = (name: string) => openAppWindow("project", name);
  const anyWindowOpen = windows.some((item) => !item.minimized);
  return (
    <main className="monitor-frame" aria-label="Retro desktop monitor">
      <div className="monitor-casing">
        <div className="monitor-screen">
          <div className="desktop" aria-label="Diwyesh's portfolio desktop">
      <header className="topbar">
        <button className="topbar__activity" type="button" onClick={openProfile}>
          <span className="activity-mark" aria-hidden="true">◈</span>
          <span>Activities</span>
        </button>
        <div className="topbar__workspace" aria-label="Current workspace">
          <span className="workspace-dot" />
          <span>Workspace 1</span>
        </div>
        <div className="topbar__system">
          <span className="connection-state" data-state={sync.status}>
            <span className="status-dot" aria-hidden="true" />
            <span>{sync.message}</span>
          </span>
          <time className="topbar__clock">{clock}</time>
          <button
            className="ip-indicator"
            type="button"
            title={ipTitle}
            onClick={() => showToast("This IP lookup is provided by ipify.org. This page does not store the address.")}
          >
            <span className="ip-indicator__icon" aria-hidden="true">⌁</span>
            <span>{visitorIp}</span>
          </button>
        </div>
      </header>

      <section className="desktop-content" aria-label="Desktop">
        <div className="desktop-copy">
          <p className="eyebrow"><span className="prompt">~/home</span> &nbsp;·&nbsp; welcome</p>
          <h1>Hey, I’m <span>{profile.name || FALLBACK_PROFILE.name}</span><span className="cursor" aria-hidden="true" /></h1>
          <p className="desktop-copy__role">{ROLE}</p>
          <p className="desktop-copy__bio">{profile.bio || FALLBACK_PROFILE.bio}</p>
          <button className="text-link" type="button" onClick={openProfile}>
            <span aria-hidden="true">cat</span> about.txt <span aria-hidden="true">↗</span>
          </button>
        </div>

        <div className="desktop-shortcuts" aria-label="Desktop shortcuts">
          <button
            className="shortcut"
            type="button"
            onClick={openRepositoryDrawer}
          >
            <span className="shortcut__icon shortcut__icon--folder" aria-hidden="true">▰</span>
            <span>Projects</span>
          </button>
          <a className="shortcut" href={`https://github.com/${USERNAME}`} target="_blank" rel="noreferrer">
            <span className="shortcut__icon shortcut__icon--github" aria-hidden="true">⌘</span>
            <span>GitHub</span>
          </a>
        </div>
      </section>

      {windows.map((appWindow) => {
        const repository = appWindow.type === "project"
          ? repositories.find((item) => item.name === appWindow.name)
          : undefined;
        const title = appWindow.type === "profile"
          ? `About — ${profile.name || FALLBACK_PROFILE.name}`
          : appWindow.type === "repos"
            ? "Repository Drawer"
            : appWindow.type === "terminal"
              ? "Terminal"
              : repository
                ? projectLabel(repository.name)
                : "Project";
        const path = appWindow.type === "profile"
          ? "~/home/about.txt"
          : appWindow.type === "repos"
            ? "~/projects"
            : appWindow.type === "terminal"
              ? "~/home/terminal"
              : `~/projects/${appWindow.name}`;

        return (
          <section
            className={[
              "window-layer",
              appWindow.minimized ? "is-minimized" : "is-open",
              appWindow.maximized ? "is-maximized" : "",
              focusedWindowId === appWindow.id ? "is-focused" : "",
            ].filter(Boolean).join(" ")}
            key={appWindow.id}
            aria-label={`${title} window`}
            aria-hidden={appWindow.minimized}
            style={{ zIndex: appWindow.zIndex }}
          >
            <article
              className="app-window"
              aria-labelledby={`window-title-${appWindow.id}`}
              onPointerDownCapture={() => focusWindow(appWindow.id)}
              style={appWindow.maximized ? undefined : { translate: `${appWindow.x}px ${appWindow.y}px` }}
            >
              <header
                className="window-titlebar"
                onPointerDown={(event) => handleWindowPointerDown(appWindow.id, event)}
                onPointerMove={handleWindowPointerMove}
                onPointerUp={() => { dragRef.current = null; }}
                onLostPointerCapture={() => { dragRef.current = null; }}
              >
                <div className="window-titlebar__file">
                  <span className="folder-mini" aria-hidden="true">▰</span>
                  <span>{path}</span>
                </div>
                <h2 id={`window-title-${appWindow.id}`}>{title}</h2>
                <div className="window-controls" aria-label="Window controls">
                  <button
                    className="window-control window-control--minimize"
                    type="button"
                    aria-label="Minimize window"
                    onClick={() => minimizeWindow(appWindow.id)}
                  ><span /></button>
                  <button
                    className="window-control window-control--maximize"
                    type="button"
                    aria-label={appWindow.maximized ? "Restore window" : "Maximize window"}
                    onClick={() => updateWindow(appWindow.id, { maximized: !appWindow.maximized })}
                  ><span /></button>
                  <button
                    className="window-control window-control--close"
                    type="button"
                    aria-label="Close window"
                    onClick={() => closeWindow(appWindow.id)}
                  ><span /></button>
                </div>
              </header>
              <div className={`window-content${appWindow.type === "terminal" ? " window-content--terminal" : ""}`}>
                {appWindow.type === "profile" ? (
                  <ProfileContent profile={profile} />
                ) : appWindow.type === "repos" ? (
                  <RepositoryDrawer repositories={repositories} onOpenProject={openProject} />
                ) : appWindow.type === "terminal" ? (
                  <Terminal profile={profile} repositories={repositories} onOpenProject={openProject} />
                ) : repository ? (
                  <ProjectContent repository={repository} />
                ) : (
                  <p className="empty-state">This project is no longer available.</p>
                )}
              </div>
            </article>
          </section>
        );
      })}

      <div className={`desktop-hint${anyWindowOpen ? " is-hidden" : ""}`} aria-live="polite">
        <span className="hint-key">TIP</span>
        Select an app in the dock to explore
      </div>

      <nav className="dock" aria-label="Desktop applications">
        <button
          className={`dock-item dock-item--home${windows.some((item) => item.type === "profile" && !item.minimized) ? " is-active" : ""}`}
          type="button"
          aria-label="Open profile"
          aria-pressed={windows.some((item) => item.type === "profile" && !item.minimized)}
          onClick={openProfile}
        >
          <span className="dock-item__icon" aria-hidden="true">◈</span>
          <span className="dock-item__label">Profile</span>
          <span className="dock-item__indicator" aria-hidden="true" />
        </button>
        <span className="dock-divider" aria-hidden="true" />
        <div className="dock-projects" aria-label="Projects">
          {repositories.length === 0 ? (
            <span className="dock-empty">No public projects found</span>
          ) : repositories.slice(0, 4).map((repository) => {
            const projectWindow = windows.find((item) => item.id === `project:${repository.name}`);
            const isActive = Boolean(projectWindow && !projectWindow.minimized);
            return (
              <button
                className={`dock-item dock-project${isActive ? " is-active" : ""}`}
                key={repository.name}
                type="button"
                aria-label={`Open ${repository.name}`}
                aria-pressed={isActive}
                title={repository.name}
                onClick={() => projectWindow ? restoreWindow(projectWindow.id) : openProject(repository.name)}
              >
                <span className="dock-item__icon" aria-hidden="true">{projectGlyph(repository.name)}</span>
                <span className="dock-item__label">{projectLabel(repository.name)}</span>
                <span className="dock-item__indicator" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <span className="dock-divider" aria-hidden="true" />
        <button
          className={`dock-item dock-item--repos${windows.some((item) => item.type === "repos" && !item.minimized) ? " is-active" : ""}`}
          type="button"
          aria-label="Open repositories"
          onClick={openRepositoryDrawer}
        >
          <span className="dock-item__icon" aria-hidden="true">▤</span>
          <span className="dock-item__label">repo&apos;s</span>
          <span className="dock-item__indicator" aria-hidden="true" />
        </button>
        <button
          className={`dock-item dock-item--terminal${windows.some((item) => item.type === "terminal" && !item.minimized) ? " is-active" : ""}`}
          type="button"
          aria-label="Open terminal"
          onClick={openTerminal}
        >
          <span className="dock-item__icon" aria-hidden="true">&gt;_</span>
          <span className="dock-item__label">Terminal</span>
          <span className="dock-item__indicator" aria-hidden="true" />
        </button>
      </nav>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
          </div>
        </div>
        <div className="monitor-bezel">
          <span className="monitor-brand">M R D C O D D E R</span>
          <div className="monitor-controls" aria-hidden="true">
            <span />
            <span />
            <span className="monitor-power" />
          </div>
        </div>
      </div>
      <div className="monitor-neck" aria-hidden="true" />
      <div className="monitor-base" aria-hidden="true" />
    </main>
  );
}

export default App;
