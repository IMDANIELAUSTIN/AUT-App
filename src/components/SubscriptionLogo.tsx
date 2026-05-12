import {
  siApplemusic,
  siCashapp,
  siCoinbase,
  siDropbox,
  siGoogle,
  siGooglepay,
  siHbo,
  siHbomax,
  siIcloud,
  siMax,
  siNetflix,
  siNotion,
  siParamountplus,
  siPaypal,
  siRobinhood,
  siSpectrum,
  siSpotify,
  siUber,
  siUbereats,
  siVenmo,
  siVerizon,
  siYoutube,
  siYoutubemusic,
  siZoom,
  type SimpleIcon,
} from "simple-icons";

type LogoEntry = {
  match: RegExp;
  icon?: SimpleIcon;
  custom?: "amazon" | "chatgpt" | "disney" | "hulu" | "walmart";
};

const LOGOS: LogoEntry[] = [
  { match: /chatgpt|openai/i, custom: "chatgpt" },
  { match: /amazon|prime/i, custom: "amazon" },
  { match: /apple\s*music|itunes/i, icon: siApplemusic },
  { match: /icloud/i, icon: siIcloud },
  { match: /google\s*pay/i, icon: siGooglepay },
  { match: /google|gemini|youtube\s*tv/i, icon: siGoogle },
  { match: /coinbase/i, icon: siCoinbase },
  { match: /spectrum/i, icon: siSpectrum },
  { match: /netflix/i, icon: siNetflix },
  { match: /spotify/i, icon: siSpotify },
  { match: /youtube\s*music/i, icon: siYoutubemusic },
  { match: /youtube/i, icon: siYoutube },
  { match: /dropbox/i, icon: siDropbox },
  { match: /notion/i, icon: siNotion },
  { match: /zoom/i, icon: siZoom },
  { match: /paypal/i, icon: siPaypal },
  { match: /venmo/i, icon: siVenmo },
  { match: /cash\s*app|cashapp/i, icon: siCashapp },
  { match: /uber\s*eats/i, icon: siUbereats },
  { match: /uber/i, icon: siUber },
  { match: /robinhood/i, icon: siRobinhood },
  { match: /verizon/i, icon: siVerizon },
  { match: /hbo\s*max/i, icon: siHbomax },
  { match: /\bmax\b/i, icon: siMax },
  { match: /hbo/i, icon: siHbo },
  { match: /paramount/i, icon: siParamountplus },
  { match: /disney/i, custom: "disney" },
  { match: /hulu/i, custom: "hulu" },
  { match: /walmart/i, custom: "walmart" },
];

export function SubscriptionLogo({ name, className }: { name: string; className?: string }) {
  const entry = LOGOS.find((item) => item.match.test(name));

  if (entry?.icon) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d={entry.icon.path} />
      </svg>
    );
  }

  if (entry?.custom) {
    return <CustomLogo kind={entry.custom} className={className} />;
  }

  return <GenericLogo className={className} />;
}

function CustomLogo({
  kind,
  className,
}: {
  kind: NonNullable<LogoEntry["custom"]>;
  className?: string;
}) {
  if (kind === "chatgpt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
        <path
          d="M12 3.5c2.1 0 3.4 1.1 4.2 2.6 1.7.2 3.2 1.4 3.8 3.1.6 1.9-.1 3.5-1.3 4.6.2 1.8-.6 3.6-2.2 4.6-1.7 1-3.4.8-4.8-.1-1.6.8-3.5.6-4.9-.7-1.4-1.2-1.9-2.9-1.5-4.4-1.1-1.3-1.5-3.1-.8-4.8.7-1.7 2.2-2.6 3.8-2.8.8-1.3 2-2.1 3.7-2.1Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8.3 5.7 12 7.8l3.8-1.7M19 13.8l-3.6-2.1v-4M15.6 18.3v-4.2L19 12M8.5 17.8l3.7-2.1 3.5 2M5.1 10.3l3.6 2.1v4M12 7.8v4.4l-3.6 2"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "amazon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
        <path
          d="M6.5 15.2c3.1 2 7.2 2.2 10.9.3"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M15.9 14.4h3.2v3.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.3 11.4c.2-2.1 1.7-3.4 3.8-3.4 2.3 0 3.7 1.2 3.7 3.3v4.3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "disney") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
        <path
          d="M4 13.2c3.4-5.7 11.7-7 16-2.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M6.5 15.5h10.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M16.9 11.9v7.2M13.3 15.5h7.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "hulu") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
        <path
          d="M5 8v8M9 8v8M5 12h4M13 8v8h4M20 8v8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M12 4.2v15.6M4.2 12h15.6M6.5 6.5l11 11M17.5 6.5l-11 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenericLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <rect x="5" y="5" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
