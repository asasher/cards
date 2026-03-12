import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api";
import BrandMark from "../components/BrandMark";
import { persistPlayerName, resolveInitialPlayerName } from "../lib/lipReadName";

export const Route = createFileRoute("/")({ ssr: false, component: ManyCardsHome });

let _convexClient: ConvexReactClient | null = null;

const PLAYER_TOKEN_STORAGE_KEY = "cards.lipread.playerToken";
const LIP_ROOM_STORAGE_KEY = "cards.lip.room";
const SELECTED_GAME_STORAGE_KEY = "cards.selectedGame";
const GAME_QUERY_PARAM = "game";
const JOIN_QUERY_PARAM = "join";
const LEGACY_ROOM_QUERY_PARAM = "room";
const WWW_SWIPE_THRESHOLD = 48;

const PALETTE = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  ink: "#141414",
};

const UI = {
  mono: "font-['DM_Mono']",
  serif: "font-['Cormorant_Garamond']",
  shell: "mx-auto min-h-screen max-w-[680px] px-6 pb-[100px] text-[#141414]",
  card: "rounded-2xl border border-[#E8E7E4] bg-white",
  divider: "h-px bg-[#E8E7E4]",
  kicker: "font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#9B9992]",
  label: "font-['DM_Mono'] text-[10px] uppercase tracking-[0.14em] text-[#9B9992]",
  meta: "font-['DM_Mono'] text-[10px] tracking-[0.12em] text-[#9B9992]",
};

type GK = "lip-reading" | "want-will-wont";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function gc() {
  const u = import.meta.env.VITE_CONVEX_URL;
  if (!u) return null;
  return (_convexClient ??= new ConvexReactClient(u));
}

function sg(k: string) {
  return typeof window !== "undefined" ? localStorage.getItem(k) : null;
}

function ss(k: string, v: string) {
  if (typeof window !== "undefined") localStorage.setItem(k, v);
}

function sd(k: string) {
  if (typeof window !== "undefined") localStorage.removeItem(k);
}

function getToken() {
  const existing = sg(PLAYER_TOKEN_STORAGE_KEY);
  if (existing && existing.length >= 8) return existing;
  const token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  ss(PLAYER_TOKEN_STORAGE_KEY, token);
  return token;
}

function norm(s: string) {
  return s.trim().toUpperCase();
}

function em(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function isGameKey(value: string | null): value is GK {
  return value === "lip-reading" || value === "want-will-wont";
}

export function resolveInitialRoomInput(
  storageGet: (key: string) => string | null = sg,
  locationSearch = typeof window === "undefined" ? "" : window.location.search,
) {
  const searchParams = new URLSearchParams(locationSearch);
  const roomFromSearch =
    searchParams.get(JOIN_QUERY_PARAM) ?? searchParams.get(LEGACY_ROOM_QUERY_PARAM);

  if (roomFromSearch && roomFromSearch.trim()) {
    return norm(roomFromSearch);
  }

  return storageGet(LIP_ROOM_STORAGE_KEY) ?? "";
}

export function resolveInitialGame(
  storageGet: (key: string) => string | null = sg,
  locationSearch = typeof window === "undefined" ? "" : window.location.search,
) {
  const searchGame = new URLSearchParams(locationSearch).get(GAME_QUERY_PARAM);
  if (isGameKey(searchGame)) {
    return searchGame;
  }

  const storedGame = storageGet(SELECTED_GAME_STORAGE_KEY);
  return isGameKey(storedGame) ? storedGame : null;
}

export function buildInviteUrl(
  code: string,
  game: GK = "lip-reading",
  currentLocation: Pick<Location, "href"> | null = typeof window === "undefined"
    ? null
    : window.location,
) {
  const normalizedCode = norm(code);
  if (!normalizedCode) {
    return "";
  }

  if (!currentLocation) {
    return `/?${JOIN_QUERY_PARAM}=${normalizedCode}&${GAME_QUERY_PARAM}=${game}`;
  }

  const inviteUrl = new URL(currentLocation.href);
  inviteUrl.searchParams.set(JOIN_QUERY_PARAM, normalizedCode);
  inviteUrl.searchParams.set(GAME_QUERY_PARAM, game);
  return inviteUrl.toString();
}

function ManyCardsHome() {
  const client = gc();
  if (!client) {
    return (
      <div className={cx(UI.mono, "p-10 text-[13px] text-[#141414]")}>Missing VITE_CONVEX_URL</div>
    );
  }

  return (
    <ConvexProvider client={client}>
      <AppRoot />
    </ConvexProvider>
  );
}

function AppRoot() {
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const urlJoin = norm(params.get(JOIN_QUERY_PARAM) ?? params.get(LEGACY_ROOM_QUERY_PARAM) ?? "");
  const urlGame = params.get(GAME_QUERY_PARAM) ?? "";

  const [game, setGame] = useState<GK | null>(() => resolveInitialGame());

  useEffect(() => {
    if (urlJoin || urlGame) {
      const url = new URL(window.location.href);
      url.searchParams.delete(JOIN_QUERY_PARAM);
      url.searchParams.delete(LEGACY_ROOM_QUERY_PARAM);
      url.searchParams.delete(GAME_QUERY_PARAM);
      window.history.replaceState({}, "", url.toString());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    game ? ss(SELECTED_GAME_STORAGE_KEY, game) : sd(SELECTED_GAME_STORAGE_KEY);
  }, [game]);

  if (!game) return <Home onSelect={setGame} />;
  if (game === "want-will-wont") return <WWWGame onBack={() => setGame(null)} joinCode={urlJoin} />;
  return <LipGame onBack={() => setGame(null)} joinCode={urlJoin} />;
}

function NavLink({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        UI.mono,
        "group relative bg-transparent px-0 py-1 text-[12px] uppercase tracking-[0.08em] text-[#9B9992] transition-colors duration-200 hover:text-[#141414]",
        className,
      )}
    >
      {children}
      <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[#9B9992] transition-transform duration-300 group-hover:scale-x-100" />
    </button>
  );
}

function Tag({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "success" | "muted";
}) {
  const tones = {
    accent: "bg-[rgba(201,106,58,0.08)] text-[#C96A3A]",
    success: "bg-[rgba(61,154,96,0.10)] text-[#3D9A60]",
    muted: "bg-[rgba(200,199,194,0.18)] text-[#C8C7C2]",
  };

  return (
    <span
      className={cx(
        UI.mono,
        "inline-flex rounded-full px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function WaitingDots() {
  return (
    <div className="flex items-center gap-[5px]">
      <div className="size-[5px] rounded-full bg-[#C8C7C2] animate-dot-pulse [animation-delay:0s]" />
      <div className="size-[5px] rounded-full bg-[#C8C7C2] animate-dot-pulse [animation-delay:0.2s]" />
      <div className="size-[5px] rounded-full bg-[#C8C7C2] animate-dot-pulse [animation-delay:0.4s]" />
    </div>
  );
}

function ProgressLine({
  value,
  max,
  tone = "accent",
}: {
  value: number;
  max: number;
  tone?: "accent" | "ink";
}) {
  const segments = 20;
  const filled = max > 0 ? Math.round((value / max) * segments) : 0;
  const activeClass = tone === "ink" ? "bg-[#141414]" : "bg-[#C96A3A]";

  return (
    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
      {Array.from({ length: segments }).map((_, index) => (
        <div
          key={index}
          className={cx(
            "h-0.5 rounded-full transition-colors duration-500",
            index < filled ? activeClass : "bg-[#E8E7E4]",
          )}
        />
      ))}
    </div>
  );
}

function AnimNum({ value, className }: { value: number; className?: string }) {
  const [key, setKey] = useState(0);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      setKey((current) => current + 1);
      prev.current = value;
    }
  }, [value]);

  return (
    <span key={key} className={cx("inline-block animate-tick-up", className)}>
      {value}
    </span>
  );
}

function Card({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className={cx(UI.card, className)} onClick={onClick}>
      {children}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-9 px-3.5 text-[12px]",
    md: "h-11 px-5 text-[13px]",
    lg: "h-[52px] px-7 text-[14px]",
  };

  const variants = {
    primary: "border border-transparent bg-[#141414] text-[#FAFAF8] hover:bg-[#242424]",
    secondary: "border border-transparent bg-[#F2F1EF] text-[#141414] hover:bg-[#ebe8e4]",
    ghost:
      "border border-[#E8E7E4] bg-transparent text-[#9B9992] hover:bg-[#F2F1EF] hover:text-[#141414]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        UI.mono,
        "rounded-[10px] tracking-[0.04em] transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.975] disabled:cursor-not-allowed disabled:opacity-35",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  maxLength,
  onKeyDown,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      onKeyDown={onKeyDown}
      className={cx(
        UI.mono,
        "h-11 w-full rounded-[10px] border border-[#E8E7E4] bg-[#F2F1EF] px-[14px] text-[15px] text-[#141414] transition duration-200 placeholder:text-[#C8C7C2] focus:border-[#C96A3A] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(201,106,58,0.15)]",
        className,
      )}
    />
  );
}

function Divider({ className }: { className?: string }) {
  return <div className={cx(UI.divider, className)} />;
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div
      className={cx(
        UI.mono,
        "mt-3 rounded-lg bg-[rgba(201,106,58,0.08)] px-3 py-2.5 text-[12px] text-[#C96A3A] animate-fade-soft",
      )}
    >
      {msg}
    </div>
  );
}

function Home({ onSelect }: { onSelect: (g: GK) => void }) {
  return (
    <div className={cx(UI.shell, UI.serif)}>
      <div className="animate-stage-1 flex flex-wrap items-end justify-between gap-4 pb-12 pt-16">
        <div className="flex items-center gap-[18px]">
          <BrandMark size={74} className="drop-shadow-[0_14px_22px_rgba(20,20,20,0.08)]" />
          <div>
            <div className="mb-2.5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#9B9992]">
              Card Games
            </div>
            <h1 className="m-0 text-[clamp(48px,10vw,88px)] font-light leading-[0.9] tracking-[-0.02em]">
              Many
              <br />
              <em>Cards</em>
            </h1>
          </div>
        </div>
        <div className="font-['DM_Mono'] text-[10px] leading-[1.8] tracking-[0.12em] text-[#C8C7C2]">
          Two players
          <br />
          One room
          <br />
          Endless fun
        </div>
      </div>

      <Divider className="animate-stage-2" />

      <div className="animate-stage-3 mt-6 grid gap-3 pb-12">
        <Card
          onClick={() => onSelect("lip-reading")}
          className="group cursor-pointer px-7 py-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.07)]"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Tag>Game 01</Tag>
              <div className="mt-2.5 text-[34px] font-normal leading-none tracking-[-0.01em]">
                Lip Read
              </div>
            </div>
            <ArrowCircle />
          </div>
          <p className="m-0 font-['DM_Mono'] text-[12px] leading-[1.8] text-[#9B9992]">
            One player mouths words in silence. The other reads their lips and scores points against
            the clock.
          </p>
          <Divider className="my-4" />
          <div className="flex gap-6">
            {[
              ["2", "Players"],
              ["60s", "Per round"],
              ["Speed", "Type"],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="font-['DM_Mono'] text-[14px] font-medium text-[#141414]">
                  {value}
                </div>
                <div className="mt-px font-['DM_Mono'] text-[10px] tracking-[0.08em] text-[#9B9992]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          onClick={() => onSelect("want-will-wont")}
          className="group cursor-pointer px-7 py-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.07)]"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Tag>Game 02</Tag>
              <div className="mt-2.5 text-[34px] font-normal leading-none tracking-[-0.01em]">
                Want / Will / Won&apos;t
              </div>
            </div>
            <ArrowCircle />
          </div>
          <p className="m-0 font-['DM_Mono'] text-[12px] leading-[1.8] text-[#9B9992]">
            Swipe activity cards left, up, or right. Outcomes are revealed when both players have
            responded.
          </p>
          <Divider className="my-4" />
          <div className="flex gap-6">
            {[
              ["2", "Players"],
              ["30", "Cards"],
              ["Reveal", "Type"],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="font-['DM_Mono'] text-[14px] font-medium text-[#141414]">
                  {value}
                </div>
                <div className="mt-px font-['DM_Mono'] text-[10px] tracking-[0.08em] text-[#9B9992]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ArrowCircle() {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E8E7E4] bg-transparent transition duration-200 group-hover:border-[#C96A3A] group-hover:bg-[rgba(201,106,58,0.08)]">
      <span className="block font-['DM_Mono'] text-[16px] text-[#C8C7C2] transition duration-200 group-hover:translate-x-px group-hover:text-[#C96A3A]">
        →
      </span>
    </div>
  );
}

function Shell({
  title,
  subtitle,
  onBack,
  onExit,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onExit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cx(UI.shell, UI.serif)}>
      <div className="animate-stage-1 sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#FAFAF8]/95 pb-5 pt-7 backdrop-blur-[2px]">
        <NavLink onClick={onBack}>← Back</NavLink>
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark size={24} alt="" />
          <div className="text-left">
            <div className="text-[20px] font-normal tracking-[-0.01em]">{title}</div>
            {subtitle && (
              <div className="mt-0.5 font-['DM_Mono'] text-[10px] tracking-[0.15em] text-[#9B9992]">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <NavLink onClick={onExit}>Leave</NavLink>
      </div>
      <Divider className="animate-stage-1" />
      <div className="pt-7">{children}</div>
    </div>
  );
}

function QRInvite({ code, game }: { code: string; game: GK }) {
  const inviteUrl = buildInviteUrl(code, game);

  return (
    <div className="animate-scale-soft flex flex-col items-center gap-5">
      <div className="rounded-xl border border-[#E8E7E4] bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <QRCodeSVG
          value={inviteUrl || code}
          size={180}
          bgColor={PALETTE.surface}
          fgColor={PALETTE.ink}
          level="M"
        />
      </div>
      <div className="text-center">
        <div className="mb-1.5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#9B9992]">
          Show this to your partner
        </div>
        <div className="text-[28px] font-light tracking-[0.08em] text-[#141414]">{code}</div>
      </div>
      {inviteUrl ? (
        <div className="max-w-[320px] text-center">
          <div className="mb-2 font-['DM_Mono'] text-[11px] leading-[1.7] text-[#9B9992]">
            Scan this QR or open the share link on another phone to join the same room.
          </div>
          <a
            href={inviteUrl}
            aria-label="Join room via share link"
            className="block break-words font-['DM_Mono'] text-[11px] leading-[1.7] text-[#C96A3A]"
          >
            {inviteUrl}
          </a>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <WaitingDots />
        <span className="font-['DM_Mono'] text-[11px] tracking-[0.1em] text-[#9B9992]">
          Waiting for partner
        </span>
      </div>
    </div>
  );
}

type CombinedEntryPanelProps = {
  name: string;
  roomInput: string;
  roomCode: string;
  inviteUrl: string;
  feedback: string;
  joinedName: string;
  inviteStatus: string;
  playersCount: number;
  workingAction: string;
  nameChangesApplyNextTime: boolean;
  onNameChange: (value: string) => void;
  onRoomInputChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onLeaveRoom: () => void;
};

export function CombinedEntryPanel({
  name,
  roomInput,
  roomCode,
  inviteUrl,
  feedback,
  joinedName,
  inviteStatus,
  playersCount,
  workingAction,
  nameChangesApplyNextTime,
  onNameChange,
  onRoomInputChange,
  onCreate,
  onJoin,
  onLeaveRoom,
}: CombinedEntryPanelProps) {
  const hasInvite = roomCode.length > 0;

  return (
    <div
      className={cx(
        "grid items-start gap-4",
        hasInvite ? "md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]" : "grid-cols-1",
      )}
    >
      <Card className="animate-stage-2 px-6 py-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1.5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.14em] text-[#9B9992]">
              Lip Read
            </div>
            <div className="text-[34px] font-normal leading-none">
              {hasInvite ? "Invite or wait" : "Create or join"}
            </div>
          </div>
          {hasInvite ? <Tag>{playersCount}/2 players</Tag> : null}
        </div>

        <div className={cx(UI.label, "mb-3")}>Your name</div>
        <Field
          value={name}
          onChange={onNameChange}
          placeholder="Player name"
          maxLength={24}
          className="mb-[18px]"
        />

        {hasInvite ? (
          <>
            <div className="mb-[14px] flex flex-wrap items-center gap-2">
              <Tag>{inviteStatus}</Tag>
              <span className="font-['DM_Mono'] text-[11px] text-[#9B9992]">Room {roomCode}</span>
            </div>
            <div className="mb-2 text-[24px] leading-[1.1]">
              {joinedName ? `${joinedName} is ready.` : "Waiting in room."}
            </div>
            <div className="mb-[18px] font-['DM_Mono'] text-[11px] leading-[1.7] text-[#9B9992]">
              Keep this screen open while your partner joins from the QR or share link.
            </div>
            {nameChangesApplyNextTime ? (
              <div className="mb-[18px] font-['DM_Mono'] text-[11px] leading-[1.7] text-[#9B9992]">
                Name changes here will apply the next time you create or join a room.
              </div>
            ) : null}
            <Btn
              variant="secondary"
              size="lg"
              disabled={workingAction === "leave"}
              onClick={onLeaveRoom}
              className="w-full"
            >
              {workingAction === "leave" ? "Leaving…" : "Exit room"}
            </Btn>
          </>
        ) : (
          <>
            <Btn
              variant="primary"
              size="lg"
              disabled={workingAction === "create"}
              onClick={onCreate}
              className="mb-[18px] w-full"
            >
              {workingAction === "create" ? "Creating…" : "Create room"}
            </Btn>

            <Divider className="mb-[18px]" />

            <div className={cx(UI.label, "mb-3")}>Join with a code</div>
            <Field
              value={roomInput}
              onChange={(value) => onRoomInputChange(norm(value))}
              placeholder="Enter room code"
              maxLength={8}
              className="mb-[14px]"
            />
            <Btn
              variant="secondary"
              size="lg"
              disabled={workingAction === "join"}
              onClick={onJoin}
              className="w-full"
            >
              {workingAction === "join" ? "Joining…" : "Join with code"}
            </Btn>
          </>
        )}

        {feedback ? <ErrorNote msg={feedback} /> : null}
      </Card>

      {hasInvite ? (
        <Card className="animate-stage-3 px-[22px] py-6">
          <div className="mb-2 font-['DM_Mono'] text-[10px] uppercase tracking-[0.14em] text-[#9B9992]">
            Invite a friend
          </div>
          <div className="mb-2.5 text-[34px] font-light leading-none text-[#141414]">
            {roomCode}
          </div>
          <div className="mb-4 font-['DM_Mono'] text-[11px] leading-[1.7] text-[#9B9992]">
            Scan this QR or open the share link on another phone to join the same Lip Read room.
          </div>
          <div
            aria-label="Join room QR"
            className="mb-[14px] flex justify-center rounded-xl border border-[#E8E7E4] bg-[#F2F1EF] p-4"
          >
            <QRCodeSVG
              value={inviteUrl || roomCode}
              size={180}
              bgColor="#F2F1EF"
              fgColor={PALETTE.ink}
              level="M"
            />
          </div>
          <a
            href={inviteUrl}
            aria-label="Join room via share link"
            className="block break-words font-['DM_Mono'] text-[11px] leading-[1.7] text-[#C96A3A]"
          >
            {inviteUrl}
          </a>
        </Card>
      ) : null}
    </div>
  );
}

function HostEntry({
  name,
  setName,
  working,
  feedback,
  onReady,
}: {
  name: string;
  setName: (v: string) => void;
  working: boolean;
  feedback: string;
  onReady: () => void;
}) {
  return (
    <Card className="animate-stage-2 px-7 py-8">
      <div className={cx(UI.label, "mb-3")}>Your name</div>
      <Field
        value={name}
        onChange={setName}
        placeholder="Enter your name"
        maxLength={24}
        className="mb-5"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") onReady();
        }}
      />
      <Btn
        variant="primary"
        size="lg"
        disabled={working || !name.trim()}
        onClick={onReady}
        className="w-full"
      >
        {working ? "..." : "Ready →"}
      </Btn>
      {feedback && <ErrorNote msg={feedback} />}
    </Card>
  );
}

function JoinEntry({
  name,
  setName,
  joinCode,
  working,
  feedback,
  onJoin,
}: {
  name: string;
  setName: (v: string) => void;
  joinCode: string;
  working: boolean;
  feedback: string;
  onJoin: () => void;
}) {
  return (
    <Card className="animate-stage-2 px-7 py-8">
      <div className="mb-1 font-['DM_Mono'] text-[10px] uppercase tracking-[0.14em] text-[#9B9992]">
        Joining room
      </div>
      <div className="mb-5 text-[32px] font-light tracking-[0.06em] text-[#141414]">{joinCode}</div>
      <div className={cx(UI.label, "mb-3")}>Your name</div>
      <Field
        value={name}
        onChange={setName}
        placeholder="Enter your name"
        maxLength={24}
        className="mb-5"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") onJoin();
        }}
      />
      <Btn
        variant="primary"
        size="lg"
        disabled={working || !name.trim()}
        onClick={onJoin}
        className="w-full"
      >
        {working ? "..." : "Join game →"}
      </Btn>
      {feedback && <ErrorNote msg={feedback} />}
    </Card>
  );
}

export type WWWSwipeDecision = "want" | "will" | "wont";

export function resolveWWWSwipeDecision(
  deltaX: number,
  deltaY: number,
  threshold = WWW_SWIPE_THRESHOLD,
): WWWSwipeDecision | null {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < threshold && absY < threshold) {
    return null;
  }

  if (absY > absX) {
    return deltaY <= -threshold ? "want" : null;
  }

  if (deltaX <= -threshold) {
    return "wont";
  }

  if (deltaX >= threshold) {
    return "will";
  }

  return null;
}

export function resolveWWWSwipeSubmission(
  canSwipe: boolean,
  deltaX: number,
  deltaY: number,
  threshold = WWW_SWIPE_THRESHOLD,
): WWWSwipeDecision | null {
  if (!canSwipe) {
    return null;
  }

  return resolveWWWSwipeDecision(deltaX, deltaY, threshold);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function softClamp(value: number, limit: number, overshootFactor = 0.35) {
  if (Math.abs(value) <= limit) {
    return value;
  }

  return Math.sign(value) * (limit + (Math.abs(value) - limit) * overshootFactor);
}

export function resolveWWWSwipePreviewDecision(
  deltaX: number,
  deltaY: number,
  previewThreshold = 8,
): WWWSwipeDecision | null {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < previewThreshold && absY < previewThreshold) {
    return null;
  }

  if (absY > absX) {
    return deltaY <= -previewThreshold ? "want" : null;
  }

  if (deltaX <= -previewThreshold) {
    return "wont";
  }

  if (deltaX >= previewThreshold) {
    return "will";
  }

  return null;
}

export function getWWWSwipeFeedback(
  deltaX: number,
  deltaY: number,
  threshold = WWW_SWIPE_THRESHOLD,
) {
  const previewDecision = resolveWWWSwipePreviewDecision(deltaX, deltaY);
  const committedDecision = resolveWWWSwipeDecision(deltaX, deltaY, threshold);
  const dominantDistance =
    previewDecision === "want" ? Math.abs(Math.min(deltaY, 0)) : Math.abs(deltaX);
  const progress = clamp(dominantDistance / threshold, 0, 1);

  return {
    previewDecision,
    committedDecision,
    cue:
      previewDecision === "wont"
        ? "← Won't"
        : previewDecision === "want"
          ? "↑ Want"
          : previewDecision === "will"
            ? "→ Will"
            : null,
    progress,
    translateX: softClamp(deltaX, 220),
    translateY: deltaY < 0 ? softClamp(deltaY, 220) : softClamp(deltaY, 96, 0.25),
    rotate: clamp(deltaX / 9, -14, 14),
    scale: 1 - progress * 0.04,
    opacity: 1 - progress * 0.06,
  };
}

const WWW_DECISION_OPTIONS = [
  { decision: "wont" as const, label: "Won't", direction: "←" },
  { decision: "want" as const, label: "Want", direction: "↑" },
  { decision: "will" as const, label: "Will", direction: "→" },
];

export function WWWDecisionControls({
  canSubmitDecision,
  showHint,
  working,
  onDecision,
}: {
  canSubmitDecision: boolean;
  showHint: boolean;
  working: boolean;
  onDecision: (decision: WWWSwipeDecision) => void;
}) {
  return (
    <div className="animate-stage-4 mb-5">
      {showHint ? (
        <div className="mb-3 text-center font-['DM_Mono'] text-[10px] tracking-[0.08em] text-[#9B9992]">
          Swipe the card, or tap a choice below.
        </div>
      ) : null}

      <div role="group" aria-label="Decision choices" className="grid grid-cols-3 gap-2.5">
        {WWW_DECISION_OPTIONS.map(({ decision, label, direction }) => {
          const accent = decision === "want";
          return (
            <button
              key={decision}
              disabled={!canSubmitDecision}
              onClick={() => onDecision(decision)}
              className={cx(
                "flex h-[72px] flex-col items-center justify-center gap-[5px] rounded-xl border transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[3px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none",
                accent
                  ? "border-[rgba(201,106,58,0.15)] bg-[rgba(201,106,58,0.08)] text-[#C96A3A]"
                  : "border-[#E8E7E4] bg-[#F2F1EF] text-[#141414]",
              )}
            >
              <span className="text-[22px] font-light leading-none">{direction}</span>
              <span className="font-['DM_Mono'] text-[11px] uppercase tracking-[0.08em]">
                {working ? "..." : label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WWWSwipeCardFace({
  activeCardId,
  activeCardText,
  canSwipe,
  dragFeedback,
  isDragging,
}: {
  activeCardId: string;
  activeCardText: string;
  canSwipe: boolean;
  dragFeedback: ReturnType<typeof getWWWSwipeFeedback>;
  isDragging: boolean;
}) {
  const previewOption =
    WWW_DECISION_OPTIONS.find((option) => option.decision === dragFeedback.previewDecision) ?? null;
  const accentPreview = previewOption?.decision === "want";

  return (
    <div key={activeCardId} className="animate-scale-soft w-full max-w-[520px]">
      <div
        className={cx(
          "relative w-full rounded-[18px] px-7 py-8",
          previewOption
            ? accentPreview
              ? "border border-[rgba(201,106,58,0.15)] bg-[rgba(201,106,58,0.08)]"
              : "border border-[#E8E7E4] bg-[#F2F1EF]"
            : "border border-[#E8E7E4] bg-white",
        )}
        style={{
          boxShadow: isDragging
            ? `0 ${18 + dragFeedback.progress * 8}px ${36 + dragFeedback.progress * 12}px rgba(0,0,0,${
                0.1 + dragFeedback.progress * 0.08
              })`
            : "0 8px 24px rgba(0,0,0,0.05)",
          transform: `translate3d(${dragFeedback.translateX}px, ${dragFeedback.translateY}px, 0) rotate(${dragFeedback.rotate}deg) scale(${dragFeedback.scale})`,
          opacity: dragFeedback.opacity,
          willChange: canSwipe
            ? "transform, box-shadow, background, border-color, opacity"
            : undefined,
          transition: isDragging
            ? "none"
            : "transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease, background 0.22s ease, border-color 0.22s ease, opacity 0.22s ease",
        }}
      >
        {dragFeedback.cue ? (
          <div
            className={cx(
              "animate-fade-soft absolute right-[14px] top-[14px] rounded-full border bg-white px-[10px] py-[6px] font-['DM_Mono'] text-[10px] tracking-[0.08em]",
              accentPreview
                ? "border-[rgba(201,106,58,0.15)] text-[#C96A3A]"
                : "border-[#E8E7E4] text-[#9B9992]",
            )}
          >
            {dragFeedback.cue}
          </div>
        ) : null}

        <div className="mb-5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#C8C7C2]">
          Activity card
        </div>
        <div className="max-w-[420px] text-[clamp(24px,5vw,48px)] font-light leading-[1.2] text-[#141414]">
          {activeCardText}
        </div>
      </div>
    </div>
  );
}

export function WWWSwipeActionCard({
  activeCardId,
  activeCardText,
  canSwipe,
  onDecision,
}: {
  activeCardId: string;
  activeCardText: string;
  canSwipe: boolean;
  onDecision: (decision: WWWSwipeDecision) => void;
}) {
  const pointerStart = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragFeedback = getWWWSwipeFeedback(dragOffset.x, dragOffset.y);
  const isDragging = dragOffset.x !== 0 || dragOffset.y !== 0;

  const clearPointer = () => {
    pointerStart.current = null;
    setDragOffset({ x: 0, y: 0 });
  };

  const releasePointer = (element: HTMLDivElement, pointerId: number) => {
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture?.(pointerId);
    }
  };

  const commitSwipe = (pointerId: number, clientX: number, clientY: number) => {
    const start = pointerStart.current;
    if (!start || start.pointerId !== pointerId) {
      return;
    }

    clearPointer();

    const decision = resolveWWWSwipeSubmission(
      canSwipe,
      clientX - start.clientX,
      clientY - start.clientY,
    );
    if (decision) {
      onDecision(decision);
    }
  };

  return (
    <div
      aria-disabled={!canSwipe}
      aria-label="Swipe activity card"
      onLostPointerCapture={clearPointer}
      onPointerCancel={(event) => {
        clearPointer();
        releasePointer(event.currentTarget, event.pointerId);
      }}
      onPointerDown={(event) => {
        if (!canSwipe) {
          return;
        }

        event.preventDefault();
        pointerStart.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        setDragOffset({ x: 0, y: 0 });
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (!start || start.pointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        setDragOffset({
          x: event.clientX - start.clientX,
          y: event.clientY - start.clientY,
        });
      }}
      onPointerUp={(event) => {
        commitSwipe(event.pointerId, event.clientX, event.clientY);
        releasePointer(event.currentTarget, event.pointerId);
      }}
      className={cx(
        "flex w-full justify-center",
        canSwipe
          ? isDragging
            ? "cursor-grabbing select-none touch-none"
            : "cursor-grab select-none touch-none"
          : "cursor-default",
      )}
    >
      <WWWSwipeCardFace
        activeCardId={activeCardId}
        activeCardText={activeCardText}
        canSwipe={canSwipe}
        dragFeedback={dragFeedback}
        isDragging={isDragging}
      />
    </div>
  );
}

function PlayerProgressCard({
  label,
  name,
  cur,
  total,
}: {
  label: string;
  name: string;
  cur: number;
  total: number;
}) {
  return (
    <Card className="px-[18px] py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="font-['DM_Mono'] text-[10px] uppercase tracking-[0.12em] text-[#9B9992]">
          {label}
        </div>
        <div className="font-['DM_Mono'] text-[12px] text-[#9B9992]">
          <AnimNum value={cur} /> <span className="text-[#C8C7C2]">/ {total}</span>
        </div>
      </div>
      <ProgressLine value={cur} max={total} />
      <div className="mt-2 text-[16px] font-normal text-[#141414]">{name}</div>
    </Card>
  );
}

function WWWGame({ onBack, joinCode = "" }: { onBack: () => void; joinCode?: string }) {
  const [token] = useState(getToken);
  const [name, setName] = useState(() => sg("cards.name") ?? "");
  const [activeCode, setActiveCode] = useState(() => sg("cards.www.room") ?? "");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [outcome, setOutcome] = useState<{
    text: string;
    match: boolean;
    my: string;
    their: string;
  } | null>(null);

  const createSession = useMutation(api.wantWillWont.createSession);
  const joinSession = useMutation(api.wantWillWont.joinSession);
  const leaveSession = useMutation(api.wantWillWont.leaveSession);
  const heartbeatPresence = useMutation(api.wantWillWont.heartbeatPresence);
  const submitSwipe = useMutation(api.wantWillWont.submitSwipe);
  const resetRound = useMutation(api.wantWillWont.resetRound);
  const ensureCards = useMutation(api.wantWillWont.ensureCardsInitialized);

  const code = norm(activeCode);
  const state = useQuery(
    api.wantWillWont.getState,
    code && token ? { code, playerToken: token } : "skip",
  );

  useEffect(() => {
    if (name) ss("cards.name", name);
  }, [name]);

  useEffect(() => {
    code ? ss("cards.www.room", code) : sd("cards.www.room");
  }, [code]);

  useEffect(() => {
    void ensureCards({}).catch(() => {});
  }, [ensureCards]);

  useEffect(() => {
    if (!state?.session.id || !code) return;
    const id = state.session.id;
    const ping = () =>
      void heartbeatPresence({ sessionId: id, playerToken: token }).catch(() => {});
    ping();
    const timer = setInterval(ping, 8000);
    return () => clearInterval(timer);
  }, [state?.session.id, code, token, heartbeatPresence]);

  useEffect(() => {
    if (code && state === null) {
      setFeedback("Session not found.");
      setActiveCode("");
      sd("cards.www.room");
    }
  }, [code, state]);

  const onLeave = () => {
    const current = code;
    setActiveCode("");
    sd("cards.www.room");
    if (current) void leaveSession({ code: current, playerToken: token }).catch(() => {});
  };

  const onSwipe = async (decision: WWWSwipeDecision) => {
    if (!code || !state?.activeCardId || !canSubmitDecision) return;
    const cardText = state.activeCardText ?? "";
    setWorking(true);
    try {
      const result = await submitSwipe({ code, playerToken: token, decision });
      if (result.outcome) {
        setOutcome({
          text: cardText,
          match: result.outcome.isMatch,
          my: result.outcome.myDecision,
          their: result.outcome.otherDecision,
        });
        setTimeout(() => setOutcome(null), 4000);
      }
    } catch (e) {
      setFeedback(em(e));
    } finally {
      setWorking(false);
    }
  };

  const me = state?.me;
  const other = state?.players.find((player) => !player.isMe) ?? null;
  const canAct = !!state && !!me && !me.done && !!state.activeCardId;
  const canSubmitDecision = canAct && !working;
  const playerCount = state?.players.length ?? 0;

  if (!code) {
    if (joinCode) {
      return (
        <Shell title="Want / Will / Won't" onBack={onBack} onExit={onBack}>
          <JoinEntry
            name={name}
            setName={setName}
            joinCode={joinCode}
            working={working}
            feedback={feedback}
            onJoin={async () => {
              if (!name.trim()) {
                setFeedback("Please enter your name.");
                return;
              }
              setWorking(true);
              setFeedback("");
              try {
                const result = await joinSession({
                  code: joinCode,
                  name: name.trim(),
                  playerToken: token,
                });
                setActiveCode(result.code);
              } catch (e) {
                setFeedback(em(e));
              } finally {
                setWorking(false);
              }
            }}
          />
        </Shell>
      );
    }

    return (
      <Shell title="Want / Will / Won't" onBack={onBack} onExit={onBack}>
        <HostEntry
          name={name}
          setName={setName}
          working={working}
          feedback={feedback}
          onReady={async () => {
            if (!name.trim()) {
              setFeedback("Please enter your name.");
              return;
            }
            setWorking(true);
            setFeedback("");
            try {
              const result = await createSession({ name: name.trim(), playerToken: token });
              setActiveCode(result.code);
            } catch (e) {
              setFeedback(em(e));
            } finally {
              setWorking(false);
            }
          }}
        />
      </Shell>
    );
  }

  if (playerCount < 2 && state) {
    return (
      <Shell
        title="Want / Will / Won't"
        subtitle={`Room · ${code}`}
        onBack={onBack}
        onExit={onLeave}
      >
        <div className="animate-stage-2 pt-6">
          <QRInvite code={code} game="want-will-wont" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Want / Will / Won't" subtitle={`Room · ${code}`} onBack={onBack} onExit={onLeave}>
      <div className="animate-stage-2 mb-5 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <PlayerProgressCard
          label="You"
          name={me?.name ?? "—"}
          cur={me?.deckCursor ?? 0}
          total={me?.totalCards ?? 0}
        />
        <PlayerProgressCard
          label="Partner"
          name={other?.name ?? "—"}
          cur={other?.deckCursor ?? 0}
          total={other?.totalCards ?? 0}
        />
      </div>

      <Card className="animate-stage-3 mb-4 flex min-h-[200px] flex-col items-center justify-center px-8 py-12 text-center">
        {!state ? (
          <WaitingDots />
        ) : me?.done ? (
          <div className="animate-scale-soft">
            <div className="mb-3 font-['DM_Mono'] text-[10px] uppercase tracking-[0.2em] text-[#9B9992]">
              {state.allDone ? "Session complete" : "Waiting for partner"}
            </div>
            {state.allDone ? (
              <div className="text-[32px] font-light">All cards reviewed.</div>
            ) : (
              <WaitingDots />
            )}
          </div>
        ) : (
          <WWWSwipeActionCard
            activeCardId={String(state.activeCardId)}
            activeCardText={state.activeCardText ?? "Stand by..."}
            canSwipe={canSubmitDecision}
            onDecision={(decision) => {
              void onSwipe(decision);
            }}
          />
        )}
      </Card>

      {outcome && (
        <div
          className={cx(
            "animate-pop-soft mb-4 flex items-center gap-[14px] rounded-xl px-5 py-4",
            outcome.match
              ? "border border-[#C6E8D2] bg-[#F0F9F4]"
              : "border border-[#E8E7E4] bg-[#F2F1EF]",
          )}
        >
          <div
            className={cx(
              "size-2 shrink-0 rounded-full",
              outcome.match ? "bg-[#3D9A60]" : "bg-[#C8C7C2]",
            )}
          />
          <div>
            <div
              className={cx(
                "text-[18px] font-normal",
                outcome.match ? "text-[#2A7048]" : "text-[#141414]",
              )}
            >
              {outcome.match ? "Match!" : "No match"}
            </div>
            <div className="mt-0.5 font-['DM_Mono'] text-[10px] tracking-[0.08em] text-[#9B9992]">
              You: {outcome.my} · Them: {outcome.their} · {outcome.text}
            </div>
          </div>
        </div>
      )}

      {!me?.done && (
        <WWWDecisionControls
          canSubmitDecision={canSubmitDecision}
          showHint={canAct}
          working={working}
          onDecision={(decision) => {
            void onSwipe(decision);
          }}
        />
      )}

      {(state?.outcomes.length ?? 0) > 0 && (
        <Card className="animate-stage-5 overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <div className="font-['DM_Mono'] text-[10px] uppercase tracking-[0.14em] text-[#9B9992]">
              Results
            </div>
            <div className="font-['DM_Mono'] text-[10px] text-[#C8C7C2]">
              {state?.outcomes.filter((item) => item.isMatch).length ?? 0} matches
            </div>
          </div>
          <Divider />
          {state!.outcomes.slice(0, 6).map((item, index) => (
            <div
              key={index}
              className={cx(
                "flex items-center justify-between gap-4 px-5 py-[11px]",
                index < Math.min(state!.outcomes.length, 6) - 1 && "border-b border-[#E8E7E4]",
              )}
            >
              <span className="text-[16px] font-normal">{item.cardText}</span>
              <Tag tone={item.isMatch ? "success" : "muted"}>{item.isMatch ? "match" : "miss"}</Tag>
            </div>
          ))}
          {state?.allDone && state.me.isHost && (
            <div className="px-5 py-4">
              <Btn
                variant="secondary"
                size="md"
                className="w-full"
                onClick={async () => {
                  try {
                    await resetRound({ code, playerToken: token });
                  } catch (e) {
                    setFeedback(em(e));
                  }
                }}
              >
                Play again
              </Btn>
            </div>
          )}
        </Card>
      )}

      {feedback && <ErrorNote msg={feedback} />}
    </Shell>
  );
}

function LipGame({ onBack, joinCode = "" }: { onBack: () => void; joinCode?: string }) {
  const [token] = useState(getToken);
  const [name, setName] = useState(resolveInitialPlayerName);
  const [roomInput, setRoomInput] = useState(() => joinCode || resolveInitialRoomInput());
  const [activeCode, setActiveCode] = useState(() => sg(LIP_ROOM_STORAGE_KEY) ?? "");
  const [workingAction, setWorkingAction] = useState("");
  const [feedback, setFeedback] = useState("");
  const [now, setNow] = useState(Date.now());

  const createSession = useMutation(api.lipReading.createSession);
  const joinSession = useMutation(api.lipReading.joinSession);
  const leaveSession = useMutation(api.lipReading.leaveSession);
  const heartbeatPresence = useMutation(api.lipReading.heartbeatPresence);
  const startRound = useMutation(api.lipReading.startRound);
  const markCardResult = useMutation(api.lipReading.markCardResult);
  const ensureCards = useMutation(api.lipReading.ensureCardsInitialized);

  const code = norm(activeCode);
  const state = useQuery(
    api.lipReading.getState,
    code && token ? { code, playerToken: token } : "skip",
  );

  useEffect(() => {
    void ensureCards({}).catch(() => {});
  }, [ensureCards]);

  useEffect(() => {
    persistPlayerName(name);
  }, [name]);

  useEffect(() => {
    code ? ss(LIP_ROOM_STORAGE_KEY, code) : sd(LIP_ROOM_STORAGE_KEY);
  }, [code]);

  useEffect(() => {
    if (!joinCode) {
      return;
    }

    setRoomInput((current) => current || norm(joinCode));
  }, [joinCode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!state?.session?.id || !code) return;
    const id = state.session.id;
    const ping = () =>
      void heartbeatPresence({ sessionId: id, playerToken: token }).catch(() => {});
    ping();
    const timer = setInterval(ping, 8000);
    return () => clearInterval(timer);
  }, [state?.session?.id, code, token, heartbeatPresence]);

  useEffect(() => {
    if (code && state === null) {
      setFeedback("Session not found.");
      setActiveCode("");
      sd(LIP_ROOM_STORAGE_KEY);
    }
  }, [code, state]);

  const clearRoom = () => {
    setActiveCode("");
    sd(LIP_ROOM_STORAGE_KEY);
  };

  const players = state?.players ?? [];
  const session = state?.session;
  const isMyTurn = session?.turnToken === token;
  const timeLeft = session?.roundEndsAt
    ? Math.max(0, Math.ceil((session.roundEndsAt - now) / 1000))
    : null;
  const urgent = timeLeft !== null && timeLeft <= 10;
  const inviteUrl = useMemo(() => buildInviteUrl(code, "lip-reading"), [code]);
  const showCombinedEntryScreen = !code || players.length < 2;
  const joinedName = state?.me?.name ?? name.trim();
  const inviteStatus = players.length === 0 ? "Setting up room" : "Waiting for player 2";
  const nameChangesApplyNextTime = Boolean(
    state?.me?.name && name.trim() && state.me.name !== name.trim(),
  );

  const onLeaveRoom = async () => {
    const currentCode = code;
    clearRoom();
    if (!currentCode) {
      return;
    }

    setWorkingAction("leave");
    try {
      await leaveSession({ code: currentCode, playerToken: token });
    } catch (error) {
      setFeedback(em(error));
    } finally {
      setWorkingAction("");
    }
  };

  const onCreate = async () => {
    if (!name.trim()) {
      setFeedback("Please enter your name.");
      return;
    }

    setWorkingAction("create");
    setFeedback("");
    try {
      const result = await createSession({ name: name.trim(), playerToken: token });
      setActiveCode(result.code);
      setRoomInput(result.code);
    } catch (error) {
      setFeedback(em(error));
    } finally {
      setWorkingAction("");
    }
  };

  const onJoin = async () => {
    const normalizedInput = norm(roomInput || joinCode);
    if (!name.trim()) {
      setFeedback("Please enter your name.");
      return;
    }

    if (!normalizedInput) {
      setFeedback("Enter a room code.");
      return;
    }

    setWorkingAction("join");
    setFeedback("");
    try {
      const result = await joinSession({
        code: normalizedInput,
        name: name.trim(),
        playerToken: token,
      });
      setActiveCode(result.code);
      setRoomInput(result.code);
    } catch (error) {
      setFeedback(em(error));
    } finally {
      setWorkingAction("");
    }
  };

  if (showCombinedEntryScreen) {
    return (
      <Shell
        title="Lip Read"
        subtitle={code ? `Room · ${code}` : undefined}
        onBack={onBack}
        onExit={code ? () => void onLeaveRoom() : onBack}
      >
        <CombinedEntryPanel
          name={name}
          roomInput={roomInput}
          roomCode={code}
          inviteUrl={inviteUrl}
          feedback={feedback}
          joinedName={joinedName}
          inviteStatus={inviteStatus}
          playersCount={Math.max(players.length, code ? 1 : 0)}
          workingAction={workingAction}
          nameChangesApplyNextTime={nameChangesApplyNextTime}
          onNameChange={setName}
          onRoomInputChange={setRoomInput}
          onCreate={() => void onCreate()}
          onJoin={() => void onJoin()}
          onLeaveRoom={() => {
            void onLeaveRoom();
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell
      title="Lip Read"
      subtitle={`Room · ${code}`}
      onBack={onBack}
      onExit={() => {
        void onLeaveRoom();
      }}
    >
      <div className="animate-stage-2 mb-5 flex flex-wrap gap-3">
        {players.map((player) => (
          <Card key={player.token} className="min-w-[130px] flex-1 px-5 py-[18px]">
            <div className="mb-1.5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.12em] text-[#9B9992]">
              {player.token === token ? "You" : "Opponent"}
            </div>
            <div
              className={cx(
                "text-[52px] font-light leading-none",
                player.token === token ? "text-[#C96A3A]" : "text-[#141414]",
              )}
            >
              <AnimNum value={player.score} />
            </div>
            <div className="mt-1 font-['DM_Mono'] text-[12px] text-[#9B9992]">{player.name}</div>
          </Card>
        ))}
      </div>

      {timeLeft !== null && session?.phase === "round" && (
        <div className="animate-stage-3 mb-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="font-['DM_Mono'] text-[10px] uppercase tracking-[0.12em] text-[#9B9992]">
              Time
            </span>
            <span
              className={cx(
                "font-['DM_Mono'] text-[14px] font-medium transition-colors duration-500",
                urgent ? "text-[#C96A3A]" : "text-[#141414]",
              )}
            >
              {timeLeft}s
            </span>
          </div>
          <ProgressLine value={timeLeft} max={60} tone={urgent ? "accent" : "ink"} />
        </div>
      )}

      <Card
        className={cx(
          "animate-stage-3 mb-4 flex min-h-[240px] flex-col items-center justify-center px-8 py-12 text-center transition-colors duration-300",
          urgent ? "border-[#F0CEC2] bg-[#FFF8F5]" : "border-[#E8E7E4] bg-white",
        )}
      >
        {!session ? (
          <WaitingDots />
        ) : session.phase === "lobby" ? (
          <div className="animate-scale-soft">
            <div className="mb-4 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#9B9992]">
              {players.length < 2 ? "Waiting for player 2" : "Both players ready"}
            </div>
            {players.length < 2 ? (
              <WaitingDots />
            ) : state?.me?.isHost ? (
              <Btn
                variant="primary"
                size="lg"
                onClick={async () => {
                  try {
                    await startRound({ code, playerToken: token });
                  } catch (e) {
                    setFeedback(em(e));
                  }
                }}
              >
                Start round
              </Btn>
            ) : (
              <div className="text-[20px] font-light italic text-[#9B9992]">
                Waiting for host...
              </div>
            )}
          </div>
        ) : session.phase === "round" ? (
          <div key={session.phase} className="animate-scale-soft">
            {isMyTurn ? (
              <>
                <div
                  className={cx(
                    "mb-5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] transition-colors duration-300",
                    urgent ? "text-[#C96A3A]" : "text-[#9B9992]",
                  )}
                >
                  Mouth this — no sound
                </div>
                <div
                  className={cx(
                    "mb-8 text-[clamp(36px,7vw,72px)] font-light leading-[1.1] transition-colors duration-300",
                    urgent ? "text-[#C96A3A]" : "text-[#141414]",
                  )}
                >
                  {state?.activeCardText ?? ""}
                </div>
                <div className="flex gap-2.5">
                  <Btn
                    variant="primary"
                    size="lg"
                    onClick={async () => {
                      try {
                        await markCardResult({ code, playerToken: token, result: "correct" });
                      } catch (e) {
                        setFeedback(em(e));
                      }
                    }}
                  >
                    Correct
                  </Btn>
                  <Btn
                    variant="ghost"
                    size="lg"
                    onClick={async () => {
                      try {
                        await markCardResult({ code, playerToken: token, result: "skip" });
                      } catch (e) {
                        setFeedback(em(e));
                      }
                    }}
                  >
                    Skip
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <div className="mb-5 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#9B9992]">
                  Watch & lip read
                </div>
                <div className="text-[28px] font-light italic text-[#9B9992]">
                  Your partner is mouthing a word...
                </div>
                <div className="mt-6">
                  <WaitingDots />
                </div>
              </>
            )}
          </div>
        ) : (
          <div key="done" className="animate-scale-soft">
            <div className="mb-3 font-['DM_Mono'] text-[10px] uppercase tracking-[0.18em] text-[#9B9992]">
              Round complete
            </div>
            <div className="mb-2 text-[36px] font-light">
              {[...players].sort((a, b) => b.score - a.score)[0]?.name ?? "?"} is leading
            </div>
            {state?.me?.isHost && (
              <Btn
                variant="secondary"
                size="lg"
                className="mt-2"
                onClick={async () => {
                  try {
                    await startRound({ code, playerToken: token });
                  } catch (e) {
                    setFeedback(em(e));
                  }
                }}
              >
                Next round
              </Btn>
            )}
          </div>
        )}
      </Card>

      {feedback && <ErrorNote msg={feedback} />}
    </Shell>
  );
}
