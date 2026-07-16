"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateVideoProgress } from "../actions/updateVideoProgress";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          events: {
            onStateChange?: (event: { data: number; target: YTPlayerLike }) => void;
            onReady?: (event: { target: YTPlayerLike }) => void;
          };
        },
      ) => YTPlayerLike;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerLike {
  getCurrentTime: () => number;
  getDuration: () => number;
}

const PING_INTERVAL_MS = 10_000;

/**
 * Player embutido do YouTube (vídeo não listado — nunca exibido como link
 * de destaque, ver doc 02 §4). Usa a IFrame Player API oficial e envia
 * progresso ao servidor periodicamente; o servidor decide "concluído",
 * nunca o cliente.
 */
export function VideoPlayer({
  youtubeVideoId,
  enrollmentId,
  contentId,
  initialPercent,
  initialCompleted,
}: {
  youtubeVideoId: string;
  enrollmentId: string;
  contentId: string;
  initialPercent: number;
  initialCompleted: boolean;
}) {
  const containerId = `youtube-player-${contentId}`;
  const playerRef = useRef<YTPlayerLike | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [percent, setPercent] = useState(initialPercent);
  const [completed, setCompleted] = useState(initialCompleted);

  const sendProgress = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    const positionSeconds = player.getCurrentTime();
    const durationSeconds = player.getDuration();
    if (!durationSeconds) return;

    const result = await updateVideoProgress({
      enrollmentId,
      contentId,
      positionSeconds,
      durationSeconds,
    });

    if (result.ok) {
      if (typeof result.percent === "number") setPercent(result.percent);
      if (typeof result.completed === "boolean") setCompleted(result.completed);
    }
  }, [enrollmentId, contentId]);

  useEffect(() => {
    function createPlayer() {
      if (!window.YT) return;
      playerRef.current = new window.YT.Player(containerId, {
        videoId: youtubeVideoId,
        events: {
          onStateChange: (event) => {
            const YT = window.YT;
            if (!YT) return;
            if (event.data === YT.PlayerState.PLAYING) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(sendProgress, PING_INTERVAL_MS);
            } else {
              if (intervalRef.current) clearInterval(intervalRef.current);
              void sendProgress();
            }
          },
        },
      });
    }

    if (window.YT) {
      createPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [containerId, youtubeVideoId, sendProgress]);

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-md)] bg-black">
        <div id={containerId} className="size-full" />
      </div>
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        {completed ? (
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Concluído
          </span>
        ) : (
          <span>Progresso: {percent}%</span>
        )}
      </div>
    </div>
  );
}
