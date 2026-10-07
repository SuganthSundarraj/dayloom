"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { focusSeconds, type FocusSession } from "@/lib/organizer/features";

type Permission = NotificationPermission | "unsupported";
function notificationPermission(): Permission {
  return typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    window.isSecureContext
    ? Notification.permission
    : "unsupported";
}
function subscribePermission(listener: () => void) {
  window.addEventListener("focus", listener);
  window.addEventListener("dayloom-notification-permission", listener);
  return () => {
    window.removeEventListener("focus", listener);
    window.removeEventListener("dayloom-notification-permission", listener);
  };
}
export function useFocusAlerts(sessions: FocusSession[]) {
  const audio = useRef<AudioContext | null>(null);
  const notified = useRef(new Set<string>());
  const notification = useRef<Notification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const permission = useSyncExternalStore(
    subscribePermission,
    notificationPermission,
    () => "unsupported" as Permission,
  );
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState<string | null>(null);
  const current = sessions.find((session) => !session.completed_at);

  useEffect(() => {
    return () => {
      notification.current?.close();
      // Teardown cannot recover an already-closed browser audio resource.
      if (audio.current) void audio.current.close().catch(() => {});
    };
  }, []);

  async function enableSound() {
    try {
      if (!audio.current || audio.current.state === "closed")
        audio.current = new AudioContext();
      if (audio.current.state !== "running") await audio.current.resume();
      const ready = audio.current.state === "running";
      setSoundReady(ready);
      if (!ready) setMessage("Sound is blocked. Use Test sound to try again.");
      return ready;
    } catch {
      setSoundReady(false);
      setMessage("Sound is unavailable. You will still see the timer alert.");
      return false;
    }
  }

  const chime = useCallback(() => {
    const context = audio.current;
    if (!context || context.state !== "running") {
      setMessage("Sound needs enabling after a reload. Use Test sound.");
      return;
    }
    try {
      [660, 880, 660].forEach((frequency, index) => {
        const tone = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.35;
        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        tone.connect(gain);
        gain.connect(context.destination);
        tone.onended = () => {
          tone.disconnect();
          gain.disconnect();
        };
        tone.start(start);
        tone.stop(start + 0.32);
      });
    } catch {
      setMessage("The sound could not play. The timer alert is still visible.");
    }
  }, []);

  async function testSound() {
    if (await enableSound()) chime();
  }
  async function enableNotifications() {
    if (typeof Notification === "undefined" || !window.isSecureContext) {
      setMessage("Desktop notifications are unavailable in this browser.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      window.dispatchEvent(new Event("dayloom-notification-permission"));
      setMessage(
        result === "granted"
          ? "Desktop notifications enabled. Keep this tab open."
          : "Notifications were not allowed. Sound and the in-app alert still work.",
      );
    } catch {
      setMessage(
        "Notifications could not be enabled. Use sound and the in-app alert.",
      );
    }
  }

  useEffect(() => {
    if (!current) {
      notification.current?.close();
      notification.current = null;
      return;
    }
    function check() {
      if (
        !current ||
        focusSeconds(current, Date.now()) < current.target_minutes * 60
      )
        return;
      setExpired(current.id);
      if (notified.current.has(current.id)) return;
      notified.current.add(current.id);
      const key = `dayloom-focus-alert:${current.id}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "sent");
      } catch {
        // Storage restrictions must not prevent an alert in this mounted app.
      }
      if (soundEnabled) chime();
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          notification.current?.close();
          const notice = new Notification("Dayloom — Time’s up", {
            body: "Your focus timer has ended. Return to Dayloom to finish your session.",
            tag: `dayloom-focus-${current.id}`,
            requireInteraction: true,
          });
          notice.onclick = () => {
            window.focus();
            notice.close();
          };
          notice.onerror = () =>
            setMessage(
              "Desktop notification delivery failed. The timer alert is still visible.",
            );
          notification.current = notice;
        } catch {
          setMessage(
            "This browser could not show a desktop notification. The timer alert is still visible.",
          );
        }
      }
    }
    const initialCheck = setTimeout(check, 0);
    const timer = setInterval(check, 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      clearTimeout(initialCheck);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [current, soundEnabled, chime]);

  useEffect(() => {
    if (!expired || expired !== current?.id) return;
    const title = document.title;
    document.title = "Time’s up — Dayloom";
    return () => {
      document.title = title;
    };
  }, [expired, current?.id]);

  return {
    soundEnabled,
    setSoundEnabled,
    soundReady,
    permission,
    message,
    expired: expired === current?.id,
    enableSound,
    testSound,
    enableNotifications,
  };
}
export type FocusAlerts = ReturnType<typeof useFocusAlerts>;
